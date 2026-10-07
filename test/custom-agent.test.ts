import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  customAgentGuide,
  openCustomAgentGuide,
  removeCustomAgentGuide,
  writeCustomAgentGuide,
} from '../src/agents/customAgent.js';

afterEach(() => vi.restoreAllMocks());

describe('custom agent guide', () => {
  it('contains MCP, hooks, exit-code, and rules guidance', () => {
    const guide = customAgentGuide();

    expect(guide).toContain('"ptai_analyzer"');
    expect(guide).toContain('@posidev-community/ptai-mcp", "start"');
    expect(guide).toContain('start hook-start --format plain');
    expect(guide).toContain('start hook --format plain');
    expect(guide).toContain('exit code `2`');
    expect(guide).toContain('PT AI Security Rules');
  });

  it('opens the guide with the platform launcher', async () => {
    const run = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');

    await openCustomAgentGuide(run);

    expect(run).toHaveBeenCalledWith('xdg-open', [expect.stringContaining('PT_AI_Custom_Agent_Setup.md')]);
    platform.mockRestore();
  });

  it('writes and removes the generated guide idempotently', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-custom-guide-'));
    const guidePath = path.join(root, 'nested', 'guide.md');

    expect(await writeCustomAgentGuide(guidePath)).toBe(guidePath);
    expect(await fs.readFile(guidePath, 'utf8')).toContain('# PT AI MCP: custom agent setup');
    expect(await removeCustomAgentGuide(guidePath)).toBe(true);
    expect(await removeCustomAgentGuide(guidePath)).toBe(false);

    await fs.rm(root, { recursive: true, force: true });
  });

  it('does not hide unexpected guide removal failures', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ptai-custom-guide-error-'));

    await expect(removeCustomAgentGuide(root)).rejects.toThrow();

    await fs.rm(root, { recursive: true, force: true });
  });

  it.each([
    ['win32', 'rundll32.exe'],
    ['darwin', 'open'],
  ])('uses the %s system opener', async (platformName, executable) => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue(platformName as NodeJS.Platform);
    const run = vi.fn(async () => undefined);

    await openCustomAgentGuide(run);

    expect(run).toHaveBeenCalledWith(executable, expect.any(Array));
  });
});
