# Faster high-flight background loading — v1.0.112 / Step 10

The owner requested quicker city construction in the background at higher flight
altitudes, preserving all existing visual detail. Baseline: v1.0.111,
`18c7d34d0f7a7b504494e64a2e0956a8a0468974`.

## Changes

The surrounding-city loader previously waited for each complete download,
inflation, JSON parse, geometry build and publication before requesting the next
packet. A wide view may request hundreds of existing packets, multiplying even
moderate network round-trip latency.

The foreground packet still starts first. Up to two upcoming packets can now
transfer during its work. Their combined reservations are limited to 4 MiB;
reservations account for both packed bytes and possible HTTP-decoded gzip sizes.
Larger packets keep the existing single foreground path. The new buffer holds
only transport bytes, never a second prefetched JSON tree or geometry scene.
Inflation, JSON parsing, cooperative construction and publication remain serial.
The same validated decoder consumes either live or buffered bytes. The retained
fallback inflater also uses this path, including browsers without
`DecompressionStream` and hosts that already decode HTTP gzip.

Turning away, hiding the view, changing geometry families or disposing cancels
obsolete prefetches. Aborted or stale responses cannot publish. There is no
visited-city cache, no quality tier switch, no additional resident model budget
and no change to source packets, geometry, colours, roofs, details or navigation.
The prior visible-tile preservation rule and 24 MiB offscreen residency target
remain: this target is not an upper bound on all visible geometry or process RAM.

After the initial view, speculative transfers require an ID to be wanted in
both the previous and current visibility scan. A newly exposed region starts
its foreground request immediately; extra lookahead becomes eligible on its
next continuing-visibility scan (nominally 250 ms). Even without another scan,
the foreground queue continues to completion. This avoids extra speculative
downloads for regions only briefly glimpsed during rapid turns.

The core worker handoff now rejects obsolete/duplicate building transfers before
constructing Three objects from them. It preserves the existing complete source
shell or attached detail and sends the same acknowledgement. Failed ACKs and
missing-world recovery retain their prior handling. This avoids wasted work and
garbage collection after quick camera moves; it does not omit requested detail.
GPU-warmup scheduling, controls, view range and all architectural content remain
unchanged.

## Verification

- Production TypeScript/Vite build passed.
- Loader, lossless decoding/colour and obsolete-transfer tests: 46 passed, 746
  assertions across `surrounding-city.test.ts`, `surrounding-city-v177-decode.test.ts`,
  `surrounding-city-colour-v184.test.ts` and `progressive-obsolete-transfer.test.ts`.
- Worker handoff and source-coverage integration: 36 passed, 1,652 assertions
  across `progressive-obsolete-transfer.test.ts`, `progressive-attachment.test.ts`,
  `building-detail-worker.test.ts` and the 16 matching production preview
  lifecycle cases in `progressive-building-coverage.test.ts`.
- Surrounding pedestrian/transfer integration: 7 passed, 84 assertions across
  `surrounding-pedestrian.test.ts` and `progressive-obsolete-transfer.test.ts`.
- Complete static package: 873,301,847 bytes (832.845542 MiB), only 2,145 bytes
  larger than v111 and within the unchanged 833 MiB ceiling.

The full Python run completed with 1,261 passed, four skipped and six temporary
directory setup errors caused by the local disk-space failure. After cleanup,
all six selected retries passed (1.46 s): 1,267 tests passed across the complete
run and its environment-error retries. The two existing CRS-fixture warnings
remain unchanged. No test assertion failed.

Release-readiness and Ruff pass. During archive creation the local workstation
ran out of disk space. The generated `dist` and package data were independently
SHA-256 compared against all 3,834 public source files, then atomically replaced
with independent APFS clones of those identical files. This changes physical
duplication only; all files remain regular, complete files. The prepared Pages
commit changes no `mesh/` or `dzi/` file and deletes no old hashed asset.

The browser harness uses the same reachable high-altitude poses (within the
existing orbit-distance bound), a rapid fly/turn route and Day/Minecraft
transitions. It measures first new visible chunk and settled work independently.
A separate installed-Chrome run adds 60 ms latency via CDP, without bandwidth or
CPU throttling; these timings are an emulation, not a claim about a particular
phone or connection. WebKit uses a mobile iPhone profile, not physical hardware.

### Fixed high-flight comparison

The definitive Chrome comparisons run serially while the CPU-intensive Python
suite is paused. Each browser starts in a fresh context; ordinary cache is
retained across the three consecutive poses. These are single paired runs, not
repeated statistical benchmarks. Settlement measures the surrounding-city
loader, not completion of the independent core-detail worker. Screenshots are
therefore not proof that every core detail has finished building.

With 60 ms emulated network latency (no bandwidth or CPU throttling):

| High view | v111 settled | v112 settled |
| --- | ---: | ---: |
| Mitte | 31.69 s | 20.69 s |
| Spandau | 3.64 s | 2.35 s |
| Köpenick | 53.92 s | 19.79 s |

All three final visible IDs, resident counts, geometry bytes and buffer counts
match exactly. Both runs made 987 requests, without page errors, aborted
requests or context loss. Chrome reports the same 55 pre-existing
`Texture/Sampler-Mismatch` GL warnings in both versions; their source and
performance contribution were not isolated, and GPU warmup remains unchanged.

With no added latency, the same three views settled in 22.05 → 16.67 s,
1.73 → 1.56 s and 7.34 → 7.17 s respectively. The extreme city-spanning turn
route plus settlement took 20.22 → 23.13 s, with 399 → 421 requests. This
includes 48 automation calls, motion, frame work and final settlement, not only
loading after the route ends. The continuing-visibility guard reduces the first
candidate's 454 requests to 421, aborts from five to two (baseline: two), and the
largest sampling gap from 636 ms to 519 ms (baseline: 513 ms). It does not establish
a universal speedup for rapid turns; this is a bounded latency optimization,
with the largest demonstrated benefit in wide, continuing high-altitude views.

The original unloaded-network audit also confirms retirement parity: an earlier
completion in Spandau briefly retains 132 packets before the unchanged 1.8 s
grace expires, then returns to the exact baseline 67 packets / 13,816,128 bytes /
188 buffers. This is earlier completion before ordinary offscreen retirement,
not additional retained detail or an increased residency limit.

### Mobile WebKit functional checks

The final candidate's first seven full-route phases match all baseline visible
IDs, resident geometry bytes, buffer counts and packet counts. Its final PNG
write hit the same workstation disk-space failure; this was not a browser or
renderer crash. After freeing generated copies, a focused Day → Minecraft → Day
run completed all three phases and both camera-preserving transitions with zero
page errors, warnings or context loss. Its exact baseline counts also match:
Day 89 packets / 90,625,476 bytes / 205 buffers; Minecraft 89 packets /
27,717,702 bytes / 160 buffers. No mobile speedup or physical-iPhone crash-free
guarantee is inferred from these functional checks.
