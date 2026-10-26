/** Network liveness only: unchanged packets are still decoded and published serially. */
export const SURROUNDING_TRANSPORT_IDLE_MS = 15_000;

export class SurroundingTransportTimeout extends Error {
  constructor() {
    super("Surrounding-city transfer stopped making progress; retrying after the normal cooldown");
    this.name = "SurroundingTransportTimeout";
  }
}

const abortError = (): DOMException => new DOMException("Aborted", "AbortError");

/** Cancellation is best effort; a broken underlying source must not hold the queue. */
function cancelBody(body: ReadableStream<Uint8Array> | null): void {
  if (body) void body.cancel().catch(() => undefined);
}

/** A separate transport signal distinguishes a timed-out request from view/disposal
 * cancellation. No watchdog runs while parsing JSON or constructing geometry.
 * Reads are unbuffered here: the existing consumer owns all byte reservations. */
export async function fetchSurroundingTransport(
  fetcher: typeof fetch, url: URL, signal: AbortSignal,
  init: RequestInit = {}, idleMs = SURROUNDING_TRANSPORT_IDLE_MS,
): Promise<{ body: ReadableStream<Uint8Array>; headers: Headers }> {
  const network = new AbortController();
  const timeoutMs = Number.isFinite(idleMs) && idleMs > 0 ? idleMs : SURROUNDING_TRANSPORT_IDLE_MS;
  const wait = <T>(operation: Promise<T>, late?: (value: T) => void): Promise<T> => new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok: boolean, value: unknown): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", aborted);
      if (ok) resolve(value as T); else reject(value);
    };
    const aborted = (): void => {
      network.abort();
      finish(false, abortError());
    };
    const timer = setTimeout(() => {
      network.abort();
      finish(false, new SurroundingTransportTimeout());
    }, timeoutMs);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    operation.then(value => {
      if (settled) { late?.(value); return; }
      finish(true, value);
    }, error => finish(false, error));
  });
  let response: Response;
  try {
    if (signal.aborted) throw abortError();
    response = await wait(fetcher(url, { ...init, signal: network.signal }), value => cancelBody(value.body));
  } catch (error) {
    network.abort();
    throw error;
  }
  if (!response.ok || !response.body) {
    network.abort();
    cancelBody(response.body);
    throw new Error(`Surrounding-city data HTTP ${response.status}`);
  }
  const reader = response.body.getReader();
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    network.abort();
    void reader.cancel().catch(() => undefined);
    // releaseLock may reject an outstanding read; wait() already handles it.
    reader.releaseLock();
  };
  const body = new ReadableStream<Uint8Array>({
    async pull(output) {
      try {
        if (signal.aborted) throw abortError();
        // Empty chunks are not progress. Keep one deadline until an actual
        // byte or EOF arrives, before any gzip/JSON decoding.
        const nonempty = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
          let next: ReadableStreamReadResult<Uint8Array>;
          do { next = await reader.read(); } while (!next.done && next.value.byteLength === 0);
          return next;
        };
        const next = await wait(nonempty());
        if (next.done) { closed = true; reader.releaseLock(); output.close(); }
        else output.enqueue(next.value);
      } catch (error) {
        close();
        output.error(error);
      }
    },
    cancel() { close(); },
  }, { highWaterMark: 0 });
  return { body, headers: response.headers };
}
