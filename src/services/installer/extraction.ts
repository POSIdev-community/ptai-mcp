import { execFile, spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { NodeErrorCode } from '../../shared/io-constants.js';
import { getBundleDir } from '../../utils/paths.js';
import { Platform } from '../../utils/platform-constants.js';
import { type BundleProcessSpawner, type BundleRunner, type ExtractionProgressHandler } from './models.js';

const MAX_CLEANUP_ATTEMPTS = 3;

const execFileAsync = promisify(execFile);

const defaultBundleRunner = execFileAsync as unknown as BundleRunner;

const supportedArchivePlatforms: ReadonlySet<NodeJS.Platform> = new Set([Platform.Windows, Platform.Linux]);

export async function unpackBundle(
  archivePath: string,
  bundleDir = getBundleDir(),
  run: BundleRunner = defaultBundleRunner,
  onProgress?: ExtractionProgressHandler,
  spawnProcess: BundleProcessSpawner = spawn,
): Promise<void> {
  if (process.platform === Platform.MacOS) {
    await run('open', ['-W', archivePath]);

    return;
  }

  if (!supportedArchivePlatforms.has(process.platform)) {
    throw new Error(`Unsupported OS: ${process.platform}`);
  }

  await prepareBundleDirectory(bundleDir);

  if (process.platform === Platform.Windows) {
    if (run === defaultBundleRunner) {
      await extractWindowsZip(archivePath, bundleDir, onProgress, spawnProcess);

      return;
    }

    const quotePowerShell = (value: string) => `'${value.replaceAll("'", "''")}'`;
    const command = [
      'Expand-Archive',
      '-LiteralPath',
      quotePowerShell(archivePath),
      '-DestinationPath',
      quotePowerShell(bundleDir),
      '-Force',
    ].join(' ');

    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true });

    return;
  }

  if (process.platform === Platform.Linux) {
    await run('tar', [
      '--exclude=shared_variables',
      '--exclude=shared_variables.*',
      '-xzf',
      archivePath,
      '-C',
      bundleDir,
    ]);

    return;
  }

  throw new Error(`Unsupported OS: ${process.platform}`);
}

/** Keep the shared AIE session and its lock at the same path/inode while
 * replacing analyzer binaries. AIE-only sign-in can predate bundle installation. */
export async function prepareBundleDirectory(bundleDir: string): Promise<void> {
  const root = path.resolve(bundleDir);

  if (root === path.parse(root).root) {
    throw new Error('Refusing to replace a filesystem root.');
  }

  try {
    if ((await fsp.lstat(root)).isSymbolicLink()) {
      throw new Error('Bundle directory must not be a symbolic link.');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== NodeErrorCode.NotFound) {
      throw error;
    }
  }

  await fsp.mkdir(root, { recursive: true });
  const preserved = new Set(['shared_variables', 'shared_variables.session-lock', 'shared_variables.node-lock']);

  for (const entry of await fsp.readdir(root, { withFileTypes: true })) {
    if (preserved.has(entry.name.toLowerCase())) {
      continue;
    }

    const target = path.resolve(root, entry.name);

    if (path.dirname(target) !== root) {
      throw new Error('Refusing unsafe bundle cleanup.');
    }

    await removeDirectoryWithRetry(target);
  }
}

async function extractWindowsZip(
  archivePath: string,
  bundleDir: string,
  onProgress?: ExtractionProgressHandler,
  spawnProcess: BundleProcessSpawner = spawn,
): Promise<void> {
  const command = windowsZipCommand(archivePath, bundleDir);

  await new Promise<void>((resolve, reject) => {
    const child = spawnProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      const lines = stdout.split(/\r?\n/);
      stdout = lines.pop() ?? '';

      for (const line of lines) {
        const match = /^PTAI_PROGRESS:(\d+):(\d+)$/.exec(line.trim());

        if (match) {
          onProgress?.({ extracted: Number(match[1]), total: Number(match[2]) });
        }
      }
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        const match = /^PTAI_PROGRESS:(\d+):(\d+)$/.exec(stdout.trim());

        if (match) {
          onProgress?.({ extracted: Number(match[1]), total: Number(match[2]) });
        }

        resolve();
      } else {
        reject(new Error(`Windows archive extraction failed${stderr.trim() ? `: ${stderr.trim()}` : ''}.`));
      }
    });
  });
}

async function removeDirectoryWithRetry(directoryPath: string): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CLEANUP_ATTEMPTS; attempt += 1) {
    try {
      await fsp.rm(directoryPath, { recursive: true, force: true });

      return;
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException).code;

      if (
        !['EBUSY', NodeErrorCode.PermissionDenied, NodeErrorCode.OperationNotPermitted].includes(code ?? '') ||
        attempt === MAX_CLEANUP_ATTEMPTS
      ) {
        break;
      }

      await delay(500);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function windowsZipCommand(archivePath: string, bundleDir: string): string {
  const quotePowerShell = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const archive = quotePowerShell(archivePath);
  const destination = quotePowerShell(bundleDir);
  const command = [
    '$ErrorActionPreference = "Stop";',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem;',
    `$archive = [System.IO.Compression.ZipFile]::OpenRead(${archive});`,
    `try { $destination = [System.IO.Path]::GetFullPath(${destination});`,
    '  $files = @($archive.Entries | Where-Object { -not [string]::IsNullOrEmpty($_.Name) });',
    '  $total = $files.Count; $extracted = 0;',
    '  foreach ($entry in $files) {',
    '    $relative = $entry.FullName.Replace("/", [System.IO.Path]::DirectorySeparatorChar);',
    '    $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($destination, $relative));',
    '    if (-not $target.StartsWith($destination + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe archive path: $($entry.FullName)"; }',
    '    if ([System.IO.Path]::GetDirectoryName($target).Equals($destination, [System.StringComparison]::OrdinalIgnoreCase) -and [System.IO.Path]::GetFileName($target) -like "shared_variables*") { continue; }',
    '    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null;',
    '    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true);',
    '    $extracted++; Write-Output ("PTAI_PROGRESS:{0}:{1}" -f $extracted, $total);',
    '  }',
    '} finally { $archive.Dispose(); }',
  ].join(' ');

  return command;
}
