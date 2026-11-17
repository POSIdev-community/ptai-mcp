export const Platform = {
  Windows: 'win32',
  MacOS: 'darwin',
  Linux: 'linux',
} as const satisfies Record<string, NodeJS.Platform>;
