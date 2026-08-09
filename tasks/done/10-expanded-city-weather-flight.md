# Task 10 — Expanded city, all-weather modes, fullscreen and tunnel flight

**Pipeline step:** 1–10
**Status:** done in v0.65.0

## Scope

Extend the bounded central-Berlin scene north to Europacity/DKB, south to
Anhalter Bahnhof/Kochstraße and west to Charlottenburger Tor. Keep the same
measured coordinate frame in Day, Night, Minecraft and Snowstorm; add moderate
rain, responsive fullscreen and a guided two-direction Tiergartentunnel flight.

## Result

- The visible presentation radius grows exactly 100 m, from 5,030 m to
  5,130 m. The task-10 data hull is x −2880…1410 and z −2600…1890; an 880 m
  paper-only ring closes the composition without claiming survey coverage.
- The landmark inventory grows to 73 and adds Hamburger Bahnhof/Rieckhallen,
  Sozialgericht, Europacity/KPMG/DKB, Kulturforum details, Café am Neuen See,
  Spanish Embassy, Charlottenburger Tor, Anhalter Bahnhof and the WELT balloon.
- Snowstorm uses bounded instanced flakes, drifts and snowploughs. Rain remains
  independent. Minecraft adds one batched group of roaming Creepers and Zombies.
- Fullscreen has a native desktop path and an iOS-safe pseudo-fullscreen path.
  Guided tunnel flights enter the correct tube in either direction and expose
  the approximate route's road, lights and ventilation cues.
- LoD2/OSM/official placement remains authoritative. DKB future-campus massing,
  WELT lettering and other recognition accents are explicitly approximate.

## Acceptance criteria

- [x] All 73 sights share the regenerated DZI and 3D coordinate frame.
- [x] Every visual mode covers the complete current bounds.
- [x] Touch, mouse, trackpad and keyboard navigation remain available.
- [x] No tunnel geometry appears through an ordinary above-ground view.
- [x] Optional-source failures remain recorded and do not weaken TLS.
- [x] Release assets are reproducible and pass readiness/smoke verification.
