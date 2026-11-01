type EncodedPart = {
  positions: string;
  colors: string;
  indices: string;
};
type Fingerprint = EncodedPart & { value: number };

// Weak source ownership dies with the decoded packet. Retain only references
// to its three immutable strings, never another copy or a visited-city cache.
const fingerprints = new WeakMap<object, Fingerprint>();

/** The existing FNV-1a receipt, including its original 65,536-character yields.
 * Consecutive material/geometry guards may share this exact source identity.
 * A kind adapter can use the original part as owner without cloning strings;
 * every lookup still compares all three actual inputs, detecting mutation.
 * An interrupted hash is never published as a complete receipt. */
export function* surroundingPacketFingerprint(
  part: EncodedPart, owner: object = part,
): Generator<void, number> {
  const { positions, colors, indices } = part;
  const previous = fingerprints.get(owner);
  if (previous?.positions === positions && previous.colors === colors && previous.indices === indices)
    return previous.value;
  let value = 2166136261;
  for (const text of [positions, colors, indices]) {
    for (let start = 0; start < text.length; start += 65_536) {
      const end = Math.min(text.length, start + 65_536);
      for (let at = start; at < end; at++)
        value = Math.imul(value ^ text.charCodeAt(at), 16777619) >>> 0;
      yield;
    }
  }
  fingerprints.set(owner, { positions, colors, indices, value });
  return value;
}
