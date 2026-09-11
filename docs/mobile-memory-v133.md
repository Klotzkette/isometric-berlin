# Mobile source-memory reduction — v1.0.33

Pipeline step 10. An iPhone 13 report describes loading followed by a page reset.
Memory pressure is a plausible cause, not a reproduced device diagnosis.

The mobile worker now retains losslessly serialized districts and decodes only
the requested district (at most 240 buildings). All 29,658 deferred building
records and 124 district identities remain available. Decoded records are
released after construction. Eviction/rebuilding, coverage and draw distance
are unchanged.

Ordinary ground construction uses chunked Float64 run storage with scalar
writes, avoiding hundreds of thousands of retained objects and a duplicate
list. Graded terrain retains its original shared records. Persistent street
and Schwellenraum samplers retain grid scalars and elevation samples instead
of the unrelated ground source graph.

## Measurements and checks

`bun scripts/benchmark-mobile-source-memory.ts` from `src/app` measures live
JavaScriptCore heap after collection, excluding the common baseline:

| Building source storage | Bytes |
| --- | ---: |
| Decoded city districts | 26,207,946 |
| Packed districts | 6,740,911 |
| Saved | 19,467,035 |

This removes approximately 735,000 live source objects. Decoding one district
adds about 143 KB in this sample. A separate real-source ground storage probe
with 172,339 runs reduced temporary live heap from 9.87 MB to 5.69 MB.
These are allocation measurements, not total browser/process or iPhone RAM.

Tests round-trip every building field and district boundary, compare complete
geometry buffer hashes for near/middle/outer districts, and preserve the
v1.0.32 matrix/colour hash for 165,495 ground slabs. Existing grading, collision,
worker acknowledgement, navigation and rendering tests pass. The production
build, Python suite, release readiness and downloadable package checks pass.
Browser checks cover all five modes with WebKit/iPhone SE and Chrome/Pixel 5
profiles; a Chrome iPhone 13 profile also starts successfully.

Geometry, colours, detail, resolution, draw distance and movement are unchanged.
No physical iPhone was available. Browser profile tests cannot guarantee that
iOS will never terminate a page under system memory pressure.
