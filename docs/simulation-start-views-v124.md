# Six arrival views

Step 10, v1.0.24. Fresh loads without an explicit landmark hash cycle through
Reichstag, Chancellery, Hauptbahnhof/Washingtonplatz, Siegessäule/Goldelse,
Brandenburg Gate/Pariser Platz and Serra/Philharmonie. One persisted name
advances the cycle. Blocked storage still opens a valid view at the Reichstag.
An explicit landmark link takes precedence and does not consume a cycle entry.

The owner's phrase “Richard-Strauss-Denkmal” is provisionally interpreted as
Richard Serra's Berlin Junction, following the immediately preceding four
owner photographs and sculpture correction. This assumption was communicated
while awaiting clarification. It is not a claim that Serra's work is a Strauss
memorial. The opening reuses the existing Philharmonie catalogue entry with a
Serra opening label; no source record or tour stop is added.

## Placement

World axes remain east/up/south. Building targets follow the committed
`scene.json` architectural signatures; physical camera positions are authored
presentation choices above the corresponding public approaches, not surveyed
viewpoints. The station's south entrance is local z=90 m in its 21.82° frame;
OSM Washingtonplatz path 538207813 passes through [-61.82,-540.12]. The gate
camera is within the mapped Pariser Platz approach, looking west. Chancellery
arrival stays east of the forecourt fence and road. Goldelse follows the
existing rendered column axis [-1459,456] at figure height, without moving the
model to the slightly different catalogue POI.

Explicit 31°/39° lenses preserve the physical poses. Ordinary unqualified
39° presets are otherwise dolly-compensated by about 2.519 for the current
16° isometric lens, which had displaced opening cameras far beyond the plazas.
Close portrait views intentionally emphasize the entrance/figure rather than
shrinking an entire wide building into a narrow screen.

## Lifecycle

Opening poses apply as soon as scene metadata arrives, before world building
and detail streaming. App's first-ready focus and mobile scene-family remounts
retain the opening choice. Late secondary detail no longer snaps that opening
back after the visitor starts moving. Deliberate sight selection clears it;
normal catalogue cameras, including the Academy-facing Pariser-Platz view,
remain intact. Serra waits for the actual two-plate monument root before the
startup curtain opens. One-shot renderer recovery advances to another opening.

Unit tests cover cycling, storage failures, finite camera conversion, public
approach directions and the station entrance frame. Production browser checks
cover the actual camera before/after readiness, all six arrivals, explicit
links and mobile mode remounts; results are recorded in the release review.
