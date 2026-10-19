# Steglitz plaza follow-up — v1.0.148

This small Step 10 continuation adds the existing Hermann-Ehlers-Platz fountain
and recognition details on the plaza-facing facade of Albrechtstraße 131.
The latter is retained LoD2 owner `DEBE06YYB0000PVc`, not Rathaus Steglitz or
Das Schloss. Its curved frontage was identified against the actual delivered
packet geometry and the public heritage record before adding details.
Its window rhythm and cornices follow a credited reference photograph;
see [facade evidence and measured support](albrechtstrasse-v248.md).

The fountain follows the complete existing OpenStreetMap ring, with a low
stepped clinker edge, concrete interior, water surface and three static jets.
The catalogue's larger overall dimensions are documented as a source conflict;
they do not override the existing square opening. See
[fountain evidence and limits](hermann-ehlers-fountain-v248.md).

Fountain walking collisions use only the submitted solid boxes and cap planes.
Water and jets remain non-solid. A low rim is checked against the visitor's
whole body height, avoiding the gaps between the existing point samples.
Upper surfaces support a visitor only after their feet have reached that
height; nearby ground, the open basin and the adjacent station opening retain
their previous behavior. Drawn and native support derive separately from their
actual Float32 geometry.

All additions join the existing three drawn / one native render batches.
There are no new materials, textures, animations, streaming descriptors,
tour stops, coverage areas or raised live-memory limits. Mobile receives the
complete drawn geometry; native geometry is independently orthogonal. All
previous Steglitz data and all 4,323 existing city mesh files are byte-identical
to v1.0.147. Small unmeasured facade/fountain dimensions remain explicitly
approximate, and reference photographs are not bundled.

The complete Steglitz model uses **898,328 B drawn / 2,247,588 B native**
in geometry and instance buffers, below the unchanged **900,000 / 2,250,000 B**
limits. The navigation-only fountain lookup is 35,106 B and exits immediately
outside its small bounding box.

Validation covers replayable builders, preservation hashes, full mapped rings,
independent native occupancy, actual rendered floor raycasts, low-rim walking
collision and descent, touch parity and the unchanged 900,000 / 2,250,000-byte
Steglitz geometry limits. Browser checks cover the square, fountain, frontage
and school across all six modes and return to Day on mobile WebKit and desktop
Chromium. Final release notes record measured results. These checks cover the
exercised configurations and cannot guarantee every device's memory behavior.
