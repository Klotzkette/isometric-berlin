/** Decode directly to owned bytes where supported, without an intermediate
 * binary string or per-byte JS callback. Older engines retain the original
 * atob conversion, including its permissive padding and error behavior. */
export function decodeBase64Bytes(encoded: string): Uint8Array<ArrayBuffer> {
  const fromBase64 = (Uint8Array as typeof Uint8Array & {
    fromBase64?: (value: string) => Uint8Array<ArrayBuffer>;
  }).fromBase64;
  if (typeof fromBase64 === "function") {
    try {
      return fromBase64(encoded);
    } catch {
      // Older implementations can reject input accepted by atob. Preserve the
      // established decoder rather than changing the source acceptance rules.
    }
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
