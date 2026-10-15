import { describe, expect, it, vi } from 'vitest';
import { statusCommand } from '../src/commands/status.js';
import { logger } from '../src/utils/logger.js';
import { getPackageName, getPackageVersion } from '../src/utils/packageMetadata.js';

describe('status command', () => {
  it('prints bundle and agent status', async () => {
    // Arrange
    const output: string[] = [];
    const log = vi.spyOn(logger, 'info').mockImplementation((line: string) => output.push(line));

    // Act
    await statusCommand();

    // Assert
    expect(output).toContain('PT AI MCP status');
    expect(output.some((line) => line === `Package:     ${getPackageName()} v${getPackageVersion()}`)).toBe(true);
    expect(output).toContain('Analyzer bundle');
    expect(output.some((line) => line.startsWith('  Location:'))).toBe(true);
    expect(output.some((line) => line.startsWith('  Expected:'))).toBe(true);
    expect(output.some((line) => line === 'Detected agents' || line.startsWith('Agents: unsupported'))).toBe(true);
    log.mockRestore();
  });

  it('lists agents on Linux instead of reporting unsupported', async () => {
    // Arrange
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    const output: string[] = [];
    const log = vi.spyOn(logger, 'info').mockImplementation((line: string) => output.push(line));

    // Act
    await statusCommand();

    // Assert — Linux is now supported, so we should see the "Agents:" header instead of "unsupported"
    expect(output.some((line) => line === 'Detected agents')).toBe(true);
    expect(output.some((line) => line.includes('Cursor'))).toBe(true);
    log.mockRestore();
    platform.mockRestore();
  });
});
