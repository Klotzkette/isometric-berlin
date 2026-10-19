# Steglitz public space — v1.0.147

This bounded Step 10 continuation refines Hermann-Ehlers-Platz and the adjacent
Schloßstraße/Albrechtstraße connections. It does not rebuild the entire street
or implement proposed future square redesigns.

- The full retained pedestrian polygon has 5,270.871 m², 81 triangles and both
  fountain/U-Bahn holes. Independent native cells preserve the openings.
- Five mapped road ways add 63.542 m of connected source axis; six mapped island
  kerbs add 36.932 m. Tagged cycle widths, dashed boundaries and red surfacing
  are respected. Small curve joints close the actual asphalt surface.
- The walking floor follows the new drawn or native paving/asphalt, only where
  earlier outer ground exists. Higher existing support, holes and other places
  retain their previous behaviour. No new blocking obstacles are introduced.

Complete previous building shells, school/Rathaus/Spiegelwand details and all
old instance rows remain, including the full original scaffold rods. New floor
triangles join the existing shell batch but do not receive architectural ink.
The existing instance batches incorporate the fittings. Mobile receives exactly
the desktop geometry; native construction stays independently orthogonal.

The complete drawn model now uses 869,160 bytes of geometry/instance buffers;
the native model uses 2,218,936 bytes. Both remain below the unchanged
900,000/2,250,000-byte limits, with the same three/one draw calls. There are no
new textures, animations, descriptors, tour stops or coverage changes. The
small navigation-only lookup is 13,622 bytes, with a bounding-box early return;
it does not import or retain the complete construction recipes.

Source identities, exact preservation receipts, measured geometry and explicit
height/material display estimates are documented in
[Hermann-Ehlers-Platz](hermann-ehlers-v247.md) and
[Schloßstraße](schlossstrasse-v247.md).

## Validation

Focused tests cover replayable generation, complete source rings/holes, actual
paint support, native occupancy, walking-floor agreement, unchanged historical
geometry and instance bytes, touch parity, and the existing memory limits.
Browser checks visit the plaza, memorial, street and school through all six
modes on mobile WebKit and desktop Chromium. Release notes record final test
and package results; these checks are evidence for the exercised configurations,
not a guarantee against termination by every browser or operating system.
