export type ShortcutChord = {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
};

const ARROW_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

/** Keep browser chords intact while reserving Option/Alt + arrows for 3D orbit. */
export function isReservedBrowserChord(chord: ShortcutChord): boolean {
  const isAltArrow = chord.altKey && ARROW_KEYS.has(chord.key);
  return chord.ctrlKey || chord.metaKey || (chord.altKey && !isAltArrow);
}
