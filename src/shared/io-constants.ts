export const RedirectPolicy = { Reject: 'error', Follow: 'follow' } as const;
export const ProcessStdio = { Inherit: 'inherit', Pipe: 'pipe', Ignore: 'ignore' } as const;
export const WriteMode = { Append: 'a', Overwrite: 'w' } as const;
export const NodeErrorCode = {
  NotFound: 'ENOENT',
  PermissionDenied: 'EACCES',
  OperationNotPermitted: 'EPERM',
} as const;
