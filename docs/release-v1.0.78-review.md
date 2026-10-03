# v1.0.78: choose the world before loading

Step 10 adds an explicit startup selection on every visit and reload. Day,
Night, Snow, Schwellenraum, Underwater and Minecraft can be selected before
pressing **Start Berlin**. A valid theme link preselects its mode without
bypassing the chooser. Language selection and the existing opening sights
remain available.

The entire viewer component mounts only after Start. Selecting cards therefore
does not run its global keyboard handlers, create audio contexts or request the
lazy renderer and city data. The chooser uses the existing lightweight backdrop,
accessible native radio inputs and a scrollable layout for narrow/short screens.

Night starts with lights on even when a previous visit stored lights off. Snow
starts with the existing snowstorm enabled. Underwater starts at 3 metres;
the existing 6/21-metre controls remain available after loading. Subsequent
mode changes retain the existing navigation and toggle behaviour. Audio starts
on the first interaction inside the mounted viewer.

No city geometry, weather effect, building detail, resolution, material,
view distance or source asset is changed by this release.

## Validation

`scripts/smoke_startup_mode_selection.py` exercises fresh desktop Chrome and
iPhone-profile WebKit contexts. It checks the absence of renderer/mesh requests
and audio work before Start, the first runtime's actual mode and defaults,
reload selection, language, and reachable controls at 320×568 and 568×320.
Existing continuity, startup-memory and cold-start probes now use the visible
Start control; they do not bypass it through a production debug API.

Completed checks:

- Production TypeScript/Vite build and startup bundle budget.
- 81 focused Bun tests (613 assertions) for startup, modes, night lighting,
  snow effects and audio lifecycle/activation.
- Full Python suite: 846 passed; two existing CRS-fixture warnings.
- Repository-wide Ruff format/check, release readiness and local-package smoke.
- Chrome held-key audio regression: both W flight and arrow-key looking remain
  continuous when audio activates after the startup chooser.
- All five requested initial modes passed in fresh Chrome desktop and WebKit
  iPhone 13 profiles (ten starts): correct first mode/defaults, no startup errors
  or context loss, and no renderer, scene fetch or audio creation before Start.
- Narrow portrait and landscape control bounds, internal text wrapping, German
  selection and refresh gates passed. WebKit reports cancelled surrounding-city
  fetches from the retired document after reload; the smoke records these as
  navigation-abort diagnostics and independently verifies that the new chooser
  document makes no world fetches. Live-viewer errors remain test failures.
- Chrome Day startup-memory smoke passed with consumed core payload roots
  released after GC; timing now begins at the explicit Start action.

Browser device profiles exercise WebKit and touch behaviour; they do not certify
physical iPhone memory limits or establish that crashes are impossible.
