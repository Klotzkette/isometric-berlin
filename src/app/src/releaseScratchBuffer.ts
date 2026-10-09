/** Retire owned buffers after their last read, or after exact restoration is installed.
 * Detachment lets the engine release backing storage without waiting for a
 * later GC cycle. Never pass a borrowed source buffer or an aliased live view. */
export function releaseScratchBuffer(buffer: ArrayBuffer | undefined): void {
  if (!buffer || buffer.byteLength < 65536) return;
  try {
    const transferable = buffer as ArrayBuffer & { transfer?: (length: number) => ArrayBuffer };
    if (typeof transferable.transfer === "function") transferable.transfer(0);
    else if (typeof structuredClone === "function") structuredClone(null, { transfer: [buffer] });
  } catch {
    // Older engines may not support detachment; ordinary GC remains correct.
  }
}
