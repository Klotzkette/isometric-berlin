export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type JsonFetchOptions = {
  attempts?: number;
  fetcher?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const RETRY_DELAY_MS = 220;

function abortError(reason?: unknown): Error {
  return reason instanceof Error
    ? reason
    : new DOMException("Request aborted", "AbortError");
}

function retryDelay(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal.reason));
      return;
    }
    let timeout = 0;
    const onAbort = (): void => {
      globalThis.clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError(signal?.reason));
    };
    timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, RETRY_DELAY_MS);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Fetch JSON with a finite wait and one clean retry on transient failures. */
export async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  {
    attempts = 2,
    fetcher = globalThis.fetch.bind(globalThis),
    signal,
    timeoutMs = 45_000,
  }: JsonFetchOptions = {},
): Promise<T> {
  let lastError: unknown = new Error("Request failed");
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    if (signal?.aborted) {
      throw abortError(signal.reason);
    }
    const controller = new AbortController();
    const forwardAbort = (): void => controller.abort(signal?.reason);
    signal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = globalThis.setTimeout(
      () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
      timeoutMs,
    );
    try {
      const response = await fetcher(input, {
        cache: "default",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return (await response.json()) as T;
    } catch (error: unknown) {
      if (signal?.aborted) {
        throw abortError(signal.reason);
      }
      lastError = error;
    } finally {
      globalThis.clearTimeout(timeout);
      signal?.removeEventListener("abort", forwardAbort);
    }
    if (attempt + 1 < attempts) {
      await retryDelay(signal);
    }
  }
  throw lastError;
}
