// btoa/atob operate on Latin1 and mangle anything outside it (emoji,
// accented characters, ...). These go through UTF-8 bytes explicitly, which
// is what the GitHub Contents API expects/returns for file content.

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToUtf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
