# Drachenberg kite fliers — v1.0.95

Four illustrative people stand inside the mapped open lawn, OSM way `15700939`,
near summit node world position `[-8403.524, 1642.2395]`. Their offsets are
`[-14,-5]`, `[-5,8]`, `[8,-4]` and `[15,10]` metres. The retained OSM geometry
places these points 26–41 m inside the lawn and 19–38 m from mapped paths.
Feet sample the same refined DGM terrain as walking and the delivered ground.

The district describes the 99 m open plateau as a kite-flying location:
https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/berge/artikel.1173608.php
The figures, clothing, kite designs and common wind direction are original
illustrative occupancy, not a claim about surveyed people or current weather.

Two diamond kites use one line each; a delta and broader foil use two lines
each. All six lines terminate at the moving cloth and at the figures' hands
or handles. Coloured ribbons, long tails and small bows follow the same pose.
The four tethers are approximately 29, 36, 34 and 42 metres long.

The animation reuses typed arrays in the viewer's existing frame loop, with a
50 ms cadence and no independent timers, growing history, textures or physics
state. Hidden/offscreen objects and reduced-motion preferences suppress updates.
An animation frame requests presentation without dirtying the city shadow atlas
or pretending that the user supplied new movement input. Day-family modes share
one representation; Minecraft uses stepped cloth and separate block figures.
Mode changes release the previous family before constructing its replacement.

Focused tests check all line endpoints, bounded motion and finite vertices over
60 seconds, unchanged attribute-array identities, resource limits, the update
guards and the existing complete outline-family disposal lifecycle. Independent
review also checked line endpoints against the actual faceted sail surfaces.
Local CPU measurements are development evidence, not phone benchmarks.
