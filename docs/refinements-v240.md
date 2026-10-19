# Staatsoper Unter den Linden and Hotel de Rome — v1.0.140 / Step 10

This revision refines only the two named existing buildings at Bebelplatz.
The complete measured sources, adjacent university/library, all earlier city
coverage, six modes, seven flight starts and 93-stop tour remain authoritative.

## Architectural corrections

- Staatsoper Unter den Linden: source-bound north portico and classical facade
  articulation replace audited earlier generic decoration. Measured building
  bodies and roof hierarchy remain intact. [Source and ownership evidence](staatsoper-v240.md).
- Hotel de Rome: the projecting middle front is distinguished from the taller
  main envelope. Column and cornice heights, arched ground openings, framed
  upper windows and stone detailing follow the existing measured source and
  reference views. The courtyard stays open. [Source and preservation evidence](hotel-de-rome-v240.md).

Facade subdivisions and material hues are procedural recognition estimates,
not a new facade survey. No photographs, photographic textures or new runtime
network dependency are introduced. Full drawn detail is shared by mobile and
desktop; the native interpretation remains independently orthogonal.

## Validation

- 11 focused Python tests and 33 selected Bun tests pass, including exact
  facade transfer, native source-shell equality, neighbouring-model hashes,
  cancellation and bounded geometry.
- Repository Ruff formatting/checks and the production TypeScript/Vite build
  pass. No live residency limit is raised.
- Full Python run: 1,522 passed, four skipped and two transient failures while
  the final Hotel receipt and v140 package were being completed. The Hotel/HU
  preservation test passes in the final focused run; release readiness and
  the full local-package smoke check also pass against the completed v140 artifacts.

- Mobile WebKit with iPhone 13 emulation completes 21 views across day, night,
  snow, flood, Schwellenraum, native and back to day with zero JavaScript errors,
  context losses or resets. Views cover both revised buildings and wide zoom.
  Peak measured GPU-buffer allocations: 303,610,354 bytes. This is not a
  whole-browser process-memory measurement or a guarantee for every real phone.
- The complete local package contains 916,705,248 bytes and fits the unchanged
  875 MiB archive limit. All previous packets remain; no live limit is raised.
- Desktop Chrome passes the same 21-view sweep through all six modes and back
  to day, with zero errors, graphics-context losses or resets. Its measured
  GPU-buffer allocation peak is 666,318,078 bytes during the independent native
  world; returning to drawn releases that world. Close views of both revised
  facades were visually inspected alongside the isolated before/after previews.

Both downloadable archives were uploaded and their GitHub-reported SHA-256
digests match the locally checked files in `releases/SHA256SUMS-v1.0.140.txt`.
