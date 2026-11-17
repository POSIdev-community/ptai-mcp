export const HttpMethod = { Get: 'GET', Head: 'HEAD', Post: 'POST' } as const;
export const HttpHeader = {
  Authorization: 'Authorization',
  ContentType: 'Content-Type',
  ContentLength: 'Content-Length',
} as const;
export const MediaType = { Json: 'application/json', Text: 'text/plain' } as const;
