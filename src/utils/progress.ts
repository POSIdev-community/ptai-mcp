const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = unitIndex === 0 || value >= 10 ? value.toFixed(0) : value.toFixed(2);
  return `${rounded} ${BYTE_UNITS[unitIndex]}`;
}

export function formatTransfer(downloaded: number, total: number): string {
  return total > 0 ? `${formatBytes(downloaded)} / ${formatBytes(total)}` : formatBytes(downloaded);
}
