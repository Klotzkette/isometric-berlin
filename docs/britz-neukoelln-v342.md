# Britzer Garten, Britz and Neukölln

The represented landscape and architecture are grounded in a finite set of
named places. This pass does not claim a new survey of every Neukölln street.
The full earlier city, source geometry, six views and 93-stop tour are retained.

- [Britzer Garten](britzer-garten-v342.md): mapped lakes and paths, measured
  hills, bridges, woodland cover, flowerbeds, park buildings, Kalenderplatz,
  sundial and the mapped Parkbahn route.
- [Britz](britz-sites-v342.md): Schloss and park, Gutshof, Dorfkirche and
  Kirchteich, plus the central Hufeisensiedlung and its pond.
- [Neukölln](neukoelln-buildings-v342.md): the complete official building families replace the low generic
  shells of Stadtbad Neukölln and the Körnerpark Orangerie. Existing Rathaus,
  Arcaden and Rixdorf detail remains intact.

The [public viewer](https://klotzkette.github.io/isometric-berlin/) accepts
explicit place links for [Britzer Garten](https://klotzkette.github.io/isometric-berlin/?theme=day&lang=de#landmark=britzer-garten),
[Schloss Britz](https://klotzkette.github.io/isometric-berlin/?theme=day&lang=de#landmark=schloss-britz),
[Hufeisensiedlung](https://klotzkette.github.io/isometric-berlin/?theme=day&lang=de#landmark=hufeisensiedlung-britz),
[Stadtbad Neukölln](https://klotzkette.github.io/isometric-berlin/?theme=day&lang=de#landmark=stadtbad-neukolln)
and [Körnerpark](https://klotzkette.github.io/isometric-berlin/?theme=day&lang=de#landmark=kornerpark).
These use the ordinary focus control; they do not add tour stops or change the
startup rotation.

Browser review also exposed a blank idle canvas after offscreen GPU preparation
on desktop. A completed preparation pass now requests one ordinary frame after
restoring the original framebuffer, viewport and draw ranges, including failure
paths. Empty queues do not request extra frames. The source meshes, upload
budgets and idle rendering policy remain intact.

The new park and Britz packets are streamed only where their actual footprints
are visible. Static descriptor allowances reflect the measured finite addition.
Transfer, decode, vertex, index, prefetch and resident-geometry budgets remain
unchanged. Mobile retains the complete Drawn detail. Native is independently
constructed on cardinal cells from the same retained source, including roof and
terrain heights; it is not a simplified or rotated copy of Drawn.

The additive manifest receipt is
`geo_data/regierungsviertel/britz-neukoelln-v342-receipt.json`, pinned to the
published v1.0.221 source `5566e5db024e4326177aeedd70d758619d1734f0`.
Every earlier descriptor, source hash and footprint remains exact and in the
same order. New navigation terrain is admitted for sixteen literal tile IDs,
not for arbitrary matching prefixes. Detail companions cannot own walking
terrain. The late Neukölln building transaction applies after the old source
receipts, preserving their fingerprints and unrelated geometry.

DGM1 describes the Britzer Garten relief. Britz keeps the existing surrounding
site datum to connect with its retained public buildings; this is not a claim
of surveyed local terrain height. Window subdivisions, plant forms, small
architectural fittings and material colours remain documented estimates.
No reference photograph, texture, new font or runtime image request is bundled.
