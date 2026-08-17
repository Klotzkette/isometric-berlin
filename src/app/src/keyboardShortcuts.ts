export type ShortcutChord = {
  altKey: boolean;
  code?: string;
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

/** Recognise Space independently of keyboard layout and legacy browser keys. */
export function isPedestrianJumpKey(
  chord: Pick<ShortcutChord, "code" | "key">,
): boolean {
  return (
    chord.code === "Space" ||
    chord.key === " " ||
    chord.key === "Space" ||
    chord.key === "Spacebar"
  );
}
