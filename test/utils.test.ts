import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  downloadBundle,
  createInsecureTestRequest,
  findInstallerUrl,
  getInstallerUrl,
  isTlsCertificateError,
  unpackBundle,
  type RequestFunction,
} from '../src/utils/downloader.js';
import {
  appendRules,
  deleteStandaloneRules,
  getRulesContent,
  removeRules,
  writeStandaloneRules,
} from '../src/agents/rules.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('downloader metadata', () => {
  it('builds the production installer URL with numeric version routing', () => {
    // Arrange
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    const version = '2.10.0.1396-feature-as-7163-openai-api';
    const domain = 'example.test';

    // Act
    const url = getInstallerUrl(version, domain);

    // Assert
    expect(url).toBe(
      'https://example.test/api/v6/products/AI.INFRASTRUCTURE.INSTALLATOR.zip/2.10.0.1396/download/AI.INFRASTRUCTURE.INSTALLATOR.2.10.0.1396-feature-as-7163-openai-api.zip',
    );

    platform.mockRestore();
  });

  it('falls back from the production endpoint to the test endpoint', async () => {
    // Arrange
    const seen: string[] = [];
    const request: RequestFunction = async (url) => {
      const urlStr = url.toString();
      seen.push(urlStr);
      return new Response(null, { status: urlStr.includes('flus-test') ? 200 : 404 });
    };

    // Act
    const url = await findInstallerUrl('1.0.0', undefined, request);

    // Assert
    expect(url).toContain('flus-test.ptsecurity.ru');
    expect(seen).toHaveLength(2);
  });

  it('asks before using the test endpoint when its certificate is not trusted', async () => {
    // Arrange
    const strictRequest: RequestFunction = async (url) => {
      if (url.toString().includes('flus-test')) {
        throw Object.assign(new Error('fetch failed'), { cause: { code: 'SELF_SIGNED_CERT_IN_CHAIN' } });
      }
      return new Response(null, { status: 404 });
    };
    const insecureRequest = vi.fn<RequestFunction>(async () => new Response(null, { status: 200 }));
    const confirm = vi.fn(async () => true);

    // Act
    const url = await findInstallerUrl('1.0.0', undefined, strictRequest, {
      confirmInsecureTestTls: confirm,
      insecureTestRequest: insecureRequest,
    });

    // Assert
    expect(url).toContain('flus-test.ptsecurity.ru');
    expect(confirm).toHaveBeenCalledOnce();
    expect(insecureRequest).toHaveBeenCalledOnce();
  });

  it('cancels the test endpoint when insecure TLS is not approved', async () => {
    // Arrange
    const request: RequestFunction = async (url) => {
      if (url.toString().includes('flus-test')) {
        throw Object.assign(new Error('fetch failed'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' });
      }
      return new Response(null, { status: 404 });
    };

    // Act & Assert
    await expect(
      findInstallerUrl('1.0.0', undefined, request, { confirmInsecureTestTls: async () => false }),
    ).rejects.toThrow('Certificate verification was not disabled');
  });

  it('recognizes nested TLS certificate errors', () => {
    expect(isTlsCertificateError({ cause: { code: 'CERT_HAS_EXPIRED' } })).toBe(true);
    expect(isTlsCertificateError(new Error('ordinary failure'))).toBe(false);
  });

  it('streams an approved insecure test request without changing global TLS settings', async () => {
    // Arrange
    const response = Readable.from([Buffer.from('payload')]) as Readable & {
      statusCode?: number;
      statusMessage?: string;
      headers: Record<string, string>;
    };
    response.statusCode = 200;
    response.statusMessage = 'OK';
    response.headers = { 'content-length': '7' };
    const request = vi.fn((_url: unknown, _options: unknown, callback: (response: unknown) => void) => {
      const client = new EventEmitter() as EventEmitter & {
        end: () => void;
        destroy: (error?: Error) => void;
      };
      client.end = () => queueMicrotask(() => callback(response));
      client.destroy = (error) => {
        if (error) client.emit('error', error);
      };
      return client;
    });
    const requestFn = createInsecureTestRequest(request as never);

    // Act
    const result = await requestFn('https://flus-test.ptsecurity.ru/bundle.zip', {
      method: 'GET',
      headers: { Range: 'bytes=0-' },
    });

    // Assert
    expect(await result.text()).toBe('payload');
    expect(request).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ rejectUnauthorized: false, method: 'GET' }),
      expect.any(Function),
    );
  });

  it('rejects insecure requests outside the test endpoint', async () => {
    const requestFn = createInsecureTestRequest();
    await expect(requestFn('https://example.test/bundle.zip')).rejects.toThrow('restricted');
  });

  it('downloads a fresh archive and reports progress', async () => {
    // Arrange
    const payload = Buffer.from('hello world');
    const request: RequestFunction = async (_url, init) => {
      const stream = init?.method === 'HEAD' ? Readable.from([]) : Readable.from([payload]);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(payload.length) }),
        body: stream,
      } as unknown as Response;
    };
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-download-'));
    const archivePath = path.join(root, 'bundle.zip');
    const progress: number[] = [];

    // Act
    const result = await downloadBundle({
      version: '1.0.0',
      url: 'https://test.invalid/bundle.zip',
      outputPath: archivePath,
      request,
      onProgress: ({ downloaded }) => progress.push(downloaded),
    });

    // Assert
    expect(result.archivePath).toBe(archivePath);
    expect(await fs.readFile(archivePath)).toEqual(payload);
    expect(progress.at(-1)).toBe(payload.length);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('resumes a partial archive when the server honors Range', async () => {
    // Arrange
    const payload = Buffer.from('hello world');
    const request: RequestFunction = async (_url, init) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': String(payload.length) }),
          body: Readable.from([]),
        } as unknown as Response;
      }
      const range = (init?.headers as Record<string, string>)?.['Range'];
      const offset = Number.parseInt(range?.match(/bytes=(\d+)-/)?.[1] ?? '0', 10);
      return {
        ok: true,
        status: offset > 0 ? 206 : 200,
        headers: new Headers({ 'content-length': String(payload.length - offset) }),
        body: Readable.from([payload.subarray(offset)]),
      } as unknown as Response;
    };
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-resume-'));
    const archivePath = path.join(root, 'bundle.zip');
    await fs.writeFile(archivePath, payload.subarray(0, 5));

    // Act
    await downloadBundle({
      version: '1.0.0',
      url: 'https://test.invalid/bundle.zip',
      outputPath: archivePath,
      request,
    });

    // Assert
    expect(await fs.readFile(archivePath)).toEqual(payload);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('restarts a partial archive when the server ignores Range', async () => {
    // Arrange
    const payload = Buffer.from('complete payload');
    const request: RequestFunction = async (_url, init) => {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(payload.length) }),
        body: Readable.from(init?.method === 'HEAD' ? [] : [payload]),
      } as unknown as Response;
    };
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-restart-'));
    const archivePath = path.join(root, 'bundle.zip');
    await fs.writeFile(archivePath, Buffer.from('partial'));

    // Act
    await downloadBundle({
      version: '1.0.0',
      url: 'https://test.invalid/bundle.zip',
      outputPath: archivePath,
      request,
    });

    // Assert
    expect(await fs.readFile(archivePath)).toEqual(payload);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('retries a transient download error', async () => {
    // Arrange
    const payload = Buffer.from('retry payload');
    let gets = 0;
    const request: RequestFunction = async (_url, init) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': String(payload.length) }),
          body: Readable.from([]),
        } as unknown as Response;
      }
      gets += 1;
      if (gets < 3) throw new Error('temporary failure');
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(payload.length) }),
        body: Readable.from([payload]),
      } as unknown as Response;
    };
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-retry-'));
    const archivePath = path.join(root, 'bundle.zip');

    // Act
    await downloadBundle({
      version: '1.0.0',
      url: 'https://test.invalid/bundle.zip',
      outputPath: archivePath,
      request,
    });

    // Assert
    expect(gets).toBe(3);
    expect(await fs.readFile(archivePath)).toEqual(payload);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  }, 10000);

  it('stops retrying when the download is aborted', async () => {
    // Arrange
    const controller = new AbortController();
    controller.abort();
    const request: RequestFunction = async () => {
      throw new Error('aborted');
    };

    // Act & Assert
    await expect(
      downloadBundle({ version: '1.0.0', url: 'https://test.invalid/bundle.zip', signal: controller.signal, request }),
    ).rejects.toThrow('aborted');
  });

  it('skips a download when the existing archive has the expected size', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-existing-'));
    const archivePath = path.join(root, 'bundle.zip');
    await fs.writeFile(archivePath, 'same');
    let getCalls = 0;
    const request: RequestFunction = async (_url, init) => {
      if (init?.method === 'GET') getCalls += 1;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '4' }),
        body: Readable.from([]),
      } as unknown as Response;
    };

    // Act
    await downloadBundle({
      version: '1.0.0',
      url: 'https://test.invalid/bundle.zip',
      outputPath: archivePath,
      request,
    });

    // Assert
    expect(getCalls).toBe(0);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('rejects HTTP errors', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-errors-'));
    const archivePath = path.join(root, 'bundle.zip');
    const badStatus: RequestFunction = async (_url, init) => {
      const status = init?.method === 'HEAD' ? 404 : 500;
      return { ok: false, status, headers: new Headers(), body: Readable.from([]) } as unknown as Response;
    };

    // Act & Assert
    await expect(
      downloadBundle({
        version: '1.0.0',
        url: 'https://test.invalid/bundle.zip',
        outputPath: archivePath,
        request: badStatus,
      }),
    ).rejects.toThrow('HTTP 404');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('rejects size mismatches', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-mismatch-'));
    const archivePath = path.join(root, 'bundle.zip');
    const mismatch: RequestFunction = async (_url, init) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': init?.method === 'HEAD' ? '10' : '3' }),
        body: Readable.from(init?.method === 'HEAD' ? [] : [Buffer.from('bad')]),
      }) as unknown as Response;

    // Act & Assert
    await expect(
      downloadBundle({
        version: '1.0.0',
        url: 'https://test.invalid/bundle.zip',
        outputPath: archivePath,
        request: mismatch,
      }),
    ).rejects.toThrow('size mismatch');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('aborts while writing a response stream', async () => {
    // Arrange
    const controller = new AbortController();
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-download-abort-'));
    const archivePath = path.join(root, 'bundle.zip');
    const payload = Buffer.from('abort me');
    const request: RequestFunction = async (_url, init) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': String(payload.length) }),
          body: Readable.from([]),
        } as unknown as Response;
      }
      const body = new Readable({ read() {} });
      setTimeout(() => body.push(payload), 0);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(payload.length) }),
        body,
      } as unknown as Response;
    };

    // Act & Assert
    await expect(
      downloadBundle({
        version: '1.0.0',
        url: 'https://test.invalid/bundle.zip',
        outputPath: archivePath,
        signal: controller.signal,
        request,
        onProgress: () => controller.abort(),
      }),
    ).rejects.toThrow('Installer download aborted');

    await fs.rm(root, { recursive: true, force: true });
  });

  it('writes a web-stream response body', async () => {
    // Arrange
    const payload = Buffer.from('web stream payload');
    const request: RequestFunction = async (_url, init) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(payload.length) }),
        body:
          init?.method === 'HEAD'
            ? Readable.from([])
            : new ReadableStream({
                start(controller) {
                  controller.enqueue(payload);
                  controller.close();
                },
              }),
      }) as unknown as Response;
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-web-stream-'));
    const archivePath = path.join(root, 'bundle.zip');

    // Act
    await downloadBundle({
      version: '1.0.0',
      url: 'https://test.invalid/bundle.zip',
      outputPath: archivePath,
      request,
    });

    // Assert
    expect(await fs.readFile(archivePath)).toEqual(payload);
    await fs.rm(root, { recursive: true, force: true });
  });
});

describe('bundle unpacking', () => {
  it('uses the macOS extraction command', async () => {
    // Arrange
    const run = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');

    // Act
    await unpackBundle('/tmp/a.zip', '/tmp/bundle', run);

    // Assert
    expect(run).toHaveBeenCalledWith('open', ['/tmp/a.zip']);

    // Cleanup
    platform.mockRestore();
  });

  it('uses the Linux extraction command', async () => {
    // Arrange
    const run = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');

    // Act
    await unpackBundle('/tmp/a.tgz', '/tmp/bundle', run);

    // Assert
    expect(run).toHaveBeenCalledWith('tar', ['-xzf', '/tmp/a.tgz', '-C', '/tmp/bundle']);

    // Cleanup
    platform.mockRestore();
  });

  it('uses the Windows extraction command', async () => {
    // Arrange
    const run = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');

    // Act
    await unpackBundle("C:\\a'b.zip", 'C:\\bundle', run);

    // Assert
    expect(run).toHaveBeenCalledWith(
      'powershell.exe',
      expect.arrayContaining(['-Command', expect.stringContaining("'C:\\a''b.zip'")]),
      { windowsHide: true },
    );

    // Cleanup
    platform.mockRestore();
  });

  it('rejects unsupported OS', async () => {
    // Arrange
    const run = vi.fn();
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('freebsd');

    // Act & Assert
    await expect(unpackBundle('/tmp/a.zip', '/tmp/bundle', run)).rejects.toThrow('Unsupported OS');

    // Cleanup
    platform.mockRestore();
  });
});

describe('agent rules', () => {
  it('appends rules once', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-rules-'));
    const markdown = path.join(root, 'AGENTS.md');
    await fs.writeFile(markdown, '# Existing rules\n');

    // Act
    await appendRules(markdown);

    // Assert
    const content = await fs.readFile(markdown, 'utf8');
    expect(content).toContain('PT Application Inspector');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('is idempotent when appending rules', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-rules-'));
    const markdown = path.join(root, 'AGENTS.md');
    await fs.writeFile(markdown, '# Existing rules\n');
    await appendRules(markdown);
    const first = await fs.readFile(markdown, 'utf8');

    // Act
    await appendRules(markdown);

    // Assert
    expect(await fs.readFile(markdown, 'utf8')).toBe(first);

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('removes only the marked section', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-rules-'));
    const markdown = path.join(root, 'AGENTS.md');
    await fs.writeFile(markdown, '# Existing rules\n');
    await appendRules(markdown);

    // Act
    await removeRules(markdown);

    // Assert
    expect(await fs.readFile(markdown, 'utf8')).toBe('# Existing rules\n');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('writes standalone rules', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-rules-'));
    const standalone = path.join(root, 'rules', 'pt_ai_security.mdc');

    // Act
    await writeStandaloneRules(standalone);

    // Assert
    expect(await fs.readFile(standalone, 'utf8')).toContain('alwaysApply: true');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('handles missing and unrelated rule files idempotently', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-rules-edge-'));
    const missing = path.join(root, 'missing.md');

    // Act
    await removeRules(missing);

    // Assert
    await expect(deleteStandaloneRules(missing)).resolves.not.toThrow();

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('does not overwrite unrelated plain text files', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-rules-edge-'));
    const plain = path.join(root, 'plain.md');
    await fs.writeFile(plain, 'plain text\n');

    // Act
    await removeRules(plain);

    // Assert
    expect(await fs.readFile(plain, 'utf8')).toBe('plain text\n');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });

  it('re-writes standalone rules idempotently', async () => {
    // Arrange
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-mcp-rules-edge-'));
    const standalone = path.join(root, 'rules.md');
    await writeStandaloneRules(standalone);

    // Act
    await writeStandaloneRules(standalone);

    // Assert
    expect(getRulesContent()).toContain('PT Application Inspector');

    // Cleanup
    await fs.rm(root, { recursive: true, force: true });
  });
});
