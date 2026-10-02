type Entry<T> = {
  value: T;
  previous: Entry<T> | null;
  next: Entry<T> | null;
  consideredView: number;
};

/**
 * Upload candidates in insertion order, with constant-time ordinary-render
 * removal and look-ahead rotation. Render order differs from insertion order;
 * array indexOf/splice makes a first view quadratic in the city object count.
 * The view counter leaves already-considered far candidates dormant until the
 * camera changes, without copying the queue or retaining detached subtrees.
 */
export class SceneGpuWarmupQueue<T> {
  private readonly entries = new Map<T, Entry<T>>();
  private head: Entry<T> | null = null;
  private tail: Entry<T> | null = null;
  private view = 0;
  private pending = 0;

  get length(): number { return this.entries.size; }
  get pendingCount(): number { return this.pending; }
  get first(): T | undefined { return this.head?.value; }
  has(value: T): boolean { return this.entries.has(value); }

  private detach(entry: Entry<T>): void {
    if (entry.previous) entry.previous.next = entry.next;
    else this.head = entry.next;
    if (entry.next) entry.next.previous = entry.previous;
    else this.tail = entry.previous;
    entry.previous = null;
    entry.next = null;
  }

  private append(entry: Entry<T>): void {
    entry.previous = this.tail;
    if (this.tail) this.tail.next = entry;
    else this.head = entry;
    this.tail = entry;
  }

  add(value: T): void {
    if (this.entries.has(value)) return;
    const entry: Entry<T> = { value, previous: null, next: null, consideredView: -1 };
    this.entries.set(value, entry);
    this.append(entry);
    this.pending++;
  }

  delete(value: T): void {
    const entry = this.entries.get(value);
    if (!entry) return;
    if (entry.consideredView !== this.view) this.pending--;
    this.detach(entry);
    this.entries.delete(value);
  }

  /** Revisit all current candidates without copying or walking the queue. */
  refreshView(): void {
    this.view++;
    this.pending = this.entries.size;
  }

  /** Keep an off-view candidate eligible, after the unexamined candidates. */
  rotate(value: T): void {
    const entry = this.entries.get(value);
    if (!entry) return;
    if (entry.consideredView !== this.view) {
      entry.consideredView = this.view;
      this.pending--;
    }
    this.detach(entry);
    this.append(entry);
  }

  clear(): void {
    this.entries.clear();
    this.head = null;
    this.tail = null;
    this.pending = 0;
  }
}
