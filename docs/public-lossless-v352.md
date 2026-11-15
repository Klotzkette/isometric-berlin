# Finite lossless public packet offset

The v1.0.232 public build re-encodes 48 literal existing gzip packet paths with
the already installed `@gfx/zopfli 1.0.15`, one iteration. It saves **2,180,970
bytes**. Every decompressed byte is identical to both the v1.0.231 source and
public baseline. No geometry, colour, navigation, source ownership, ordering,
renderer mode or runtime limit changes.

`src/app/publicLosslessV352Sources.json` pins every old/new encoded SHA-256, the
complete decoded hash/length, exact descriptor and bounds. Its own SHA-256 is
`eea9eae4051b5ecf05bcb64a5aadfec690a90ba15f4a27280da2337e1752daeb`.
`bun scripts/reproduce-public-gzip-v352.ts --out /detached/output` reproduces the
finite set; `--verify-dir` verifies an existing candidate without writing it.
The tool rejects any repository destination and any source/public divergence.

Only the detached public staging tree receives the new gzip bytes and matching
descriptor byte count/hash. All other manifest values are preserved exactly.
Original repository packets and complete offline packages retain their original
representation; the public and offline decoded content remains identical.
Previous lossless derivatives and immutable source receipts are retained.
