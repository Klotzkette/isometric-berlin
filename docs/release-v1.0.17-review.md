# v1.0.17 review and verification

Pipeline step 10. Add source-backed recognition detail to the diplomatic
quarter, Robert-Koch-Platz and the Bendlerblock court while retaining the
existing LoD2 shells and current rendering performance.

## Validation

- Complete frontend: all 1,824 tests passed across 231 files, with 7,030,547
  assertions (377.87 seconds).
- All 361 Python tests passed on the final package (33.26 seconds). Ruff
  formatting and lint passed.
- TypeScript, production build, release readiness and local-package smoke
  passed.
- The new static detail is merged into one solid and one ink drawable. No
  source records, catalogue places or map bounds were removed.

The downloadable ZIP is 36,302,968 bytes and the viewer archive is 35,722,962
bytes. SHA-256: `a016b8495676f4a56aaf383e1c8e6c6f82a039bed70c74b57f4a95854ef334c9`
for the ZIP and `1577d599dee242a89686139481a5797ebd8426eadc6413a337eb78c0955e8247`
for the viewer archive.
