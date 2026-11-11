import { validation } from '../../shared/errors.js';

export function serverUrl(input: string): string {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    return validation('AIE server_url must be an absolute HTTPS URL.');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    validation('AIE server_url must be an HTTPS origin without credentials, path, query or fragment.');
  }

  return url.origin;
}
