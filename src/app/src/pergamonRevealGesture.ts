/** A tap is independent of orbit/look controls. Consume once: window and canvas
 * both receive pointerup. A second finger, cancellation or a drag cancels it. */
export class PergamonRevealGesture {
  private candidate: { id: number; x: number; y: number; at: number; travel: number } | null = null;
  private pointers = new Set<number>();
  down(id: number, x: number, y: number, at: number, primary: boolean): void {
    this.pointers.add(id);
    this.candidate = primary && this.pointers.size === 1
      ? { id, x, y, at, travel: 0 } : null;
  }
  move(id: number, x: number, y: number): void {
    const c = this.candidate;
    if (c?.id === id) c.travel = Math.max(c.travel, Math.hypot(x - c.x, y - c.y));
  }
  up(id: number, x: number, y: number, at: number): boolean {
    this.move(id, x, y);
    const c = this.candidate;
    this.pointers.delete(id);
    if (c?.id !== id) return false;
    this.candidate = null;
    return c.travel <= 7 && at - c.at <= 600 && this.pointers.size === 0;
  }
  cancel(): void { this.candidate = null; this.pointers.clear(); }
}
