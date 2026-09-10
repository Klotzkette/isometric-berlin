/** A single in-flight district bounds build/transfer memory during fast travel. */
export class BuildingDetailWorker {
  private wanted: readonly string[] = [];
  private resident = new Set<string>();
  private revision = 0;
  private running = false;
  private current: string | null = null;
  private stopped = false;

  constructor(private readonly callbacks: {
    build: (id: string) => Promise<void>;
    settled: (revision: number) => void;
    failed: (error: unknown) => void;
  }) {}

  update(
    wanted: readonly string[],
    retained: readonly string[],
    revision: number,
  ): void {
    if (this.stopped || revision < this.revision) return;
    this.revision = revision;
    this.wanted = [...new Set(wanted)];
    this.resident = new Set(retained);
    if (this.current) this.resident.add(this.current);
    if (!this.running) void this.run();
  }

  stop(): void { this.stopped = true; }

  private async run(): Promise<void> {
    this.running = true;
    try {
      while (!this.stopped) {
        const next = this.wanted.find((id) => !this.resident.has(id));
        if (!next) {
          this.callbacks.settled(this.revision);
          break;
        }
        this.current = next;
        // The callback resolves only when the viewer acknowledged the upload.
        // A changed view replaces the remaining queue at this await boundary.
        await this.callbacks.build(next);
        this.resident.add(next);
        this.current = null;
      }
    } catch (error) {
      // Cancellation can reject the old realm's outstanding transfer. Its
      // replacement view must not receive a spurious construction failure.
      if (!this.stopped) {
        this.stopped = true;
        this.callbacks.failed(error);
      }
    } finally {
      this.current = null;
      this.running = false;
    }
  }
}
