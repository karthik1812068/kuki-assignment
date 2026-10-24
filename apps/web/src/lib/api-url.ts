export function publicApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function serverApiUrl(): string {
  return process.env.API_INTERNAL_URL ?? publicApiUrl();
}
