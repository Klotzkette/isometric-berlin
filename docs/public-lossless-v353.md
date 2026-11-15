# Finite lossless public packet offset

The v1.0.233 public build re-encodes 64 literal existing gzip packet paths with
the installed `@gfx/zopfli 1.0.15`, one iteration. It saves **1,787,501 bytes**.
All complete decompressed bytes equal both source `68aafb0a` and published
`15bec985`. This changes no geometry, colour, navigation, ordering, bounds,
source owner, renderer mode, loading policy or runtime limit.

`src/app/publicLosslessV353Sources.json` pins each original and new encoded
SHA-256, complete decoded hash and length, exact descriptor and chunk bounds.
Its SHA-256 is `238f17e5a98113a220bc10b8af16471db8429182ff38d12071cb067806f5a38c`.
The selection excludes all V351/V352 packaging offsets, the older V193–V196
selections, and the changing Nikolaiviertel `4_0` owners.

From `src/app`, run:

```sh
bun scripts/reproduce-public-gzip-v353.ts --out /detached/output
bun scripts/reproduce-public-gzip-v353.ts --verify-dir /detached/output
```

`--reproduce-check /detached/output` recomputes the pinned output without writing.
The verifier checks every complete original source/public/current byte form
and the old manifest descriptor before validating or reproducing the selected
outputs. A changed input or output fails closed. Output inside the repository
is rejected. The finite tool is offline and is not imported by the viewer.

Only detached public staging receives the alternate gzip bytes. Its manifest
changes only the selected descriptor byte lengths and SHA-256 values; all
other fields are retained. The package-manifest digest of that manifest must
be refreshed, all selected paths checked over HTTP, and the complete public
tree measured below the unchanged 1,000,000,000-byte ceiling. Query-string
packet cache keys already include each descriptor hash.

Repository packets and complete offline packages retain their original gzip
representation. The public/offline decoded geometry is therefore identical.
No reference photograph or source evidence is removed.
