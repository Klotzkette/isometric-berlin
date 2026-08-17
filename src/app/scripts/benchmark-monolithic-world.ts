/** Reference runner for the historical synchronous city build. */

type MonolithicResult = {
  build_ms: number;
  steady_state: {
    asphalt_sha256: string | null;
    draw_calls: number;
    geometry_mib: number;
    object3d: number;
    renderables: number;
    vertices: number;
  };
};

let peakRss = process.memoryUsage.rss();
const memoryTimer = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage.rss());
}, 20);
const worker = new Worker(
  new URL("./benchmark-monolithic-world.worker.ts", import.meta.url).href,
  { name: "monolithic-world-benchmark", type: "module" },
);
const result = await new Promise<MonolithicResult>((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(new Error("Monolithic benchmark timed out")),
    60_000,
  );
  worker.onmessage = (event: MessageEvent<MonolithicResult>) => {
    clearTimeout(timeout);
    resolve(event.data);
  };
  worker.onerror = (event) => {
    clearTimeout(timeout);
    reject(event.error ?? new Error(event.message));
  };
});
clearInterval(memoryTimer);
peakRss = Math.max(peakRss, process.memoryUsage.rss());
worker.terminate();
console.log(
  JSON.stringify(
    {
      ...result,
      peak_rss_mib: Number((peakRss / 1024 / 1024).toFixed(1)),
    },
    null,
    2,
  ),
);
