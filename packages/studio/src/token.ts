/** A random token for this run of the development server: 32 bytes, hexadecimal. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Compare a token in constant time, so that the time taken does not tell how much of it was right. */
export function sameToken(expected: string, given: string | null): boolean {
  if (given === null || given.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ given.charCodeAt(index);
  }
  return difference === 0;
}
