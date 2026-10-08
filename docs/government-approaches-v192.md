# Hauptbahnhof and Chancellery approach detail — v1.0.92

Step 10 adds a very small architectural layer to the two existing source-bound
models. Inspection found that the station halls, entrances, galleries and
Chancellery landscaping already contain substantial bespoke detail. This pass
therefore leaves their source shells, streets, shorelines, lawns, flags, trees,
fences and interiors intact.

At both Hauptbahnhof public ends, slender metal jambs and sliding-door headers
make the twelve existing portal pairs easier to read from Washingtonplatz and
Europaplatz. Every 2.3 m clear aperture remains open through its original 4.9 m
height; no threshold, rail or new collision volume crosses the walking route.
DB's [station plan](https://www.bahnhof.de/downloads/station-plans/1071.pdf)
confirms the two public exits, rather than providing these small member sizes.

At the Chancellery's two existing round-opening loggias, the original two
horizontal rails receive intermediate bars and short side returns. Three
shallow louvres articulate only the already visible sill above its 10.5 m local
spring line. The masonry, columns, capitals, original rails, window tracery and
gardens remain. The official [building account](https://www.bundesregierung.de/breg-de/bundesregierung/bundeskanzleramt/geschichte-bundeskanzleramt-975040)
supplies architectural context; individual sections and pitches are explicitly
photo-guided display estimates, not surveyed construction information.

The references were already retained and individually credited:

- JoachimKohlerBremen, *Berlin Hauptbahnhof, Ansicht vom Washingtonplatz.jpg*,
  CC BY-SA 4.0 (2017).
- Junction35, *A Schultes Bundeskanzleramt side detail1.JPG*, CC BY-SA 3.0.
- Warburg, *B Bundeskanzleramt 2.JPG*, CC BY-SA 3.0.

[The evidence record](../geo_data/regierungsviertel/government-approaches-v192-evidence.json)
points to their original manifest rows and hashes the inspected retained images.
No duplicate credits or new photographic pixels are shipped. These dated images
establish form and material only, not present security or maintenance conditions.

Minecraft appends separate chunky portal trims and balcony/sill bars to the
existing block plans. It keeps its broad entrances, original shell and closed
32-colour palette. It does not receive the drawn model's small doorway grid or
thin metal railwork.

The drawn addition has 62 instances, three draw calls and 7,232 bytes of geometry,
index, transform and colour buffers. Native additions split into 32 instances in
the existing batches, adding 2,432 transform/colour bytes and no new draw calls.
Neither representation adds textures, animation, loading work or new budgets;
touch and pointer devices retain the same detail.

Before/after camera poses (world east/up/south, 38° field of view):

| Approach | Camera position | Target |
| --- | --- | --- |
| Washingtonplatz | `[-75.333, 13.575, -571.9043]` | `[-86.4837, 7.775, -599.7549]` |
| Chancellery east opening | `[-77.9283, 24.554, -114.477]` | `[-125.8542, 13.354, -143.5612]` |

Focused tests raycast the complete clear doorway cross-sections in both
representations, constrain the loggia additions to the existing silhouette,
measure buffer cost and verify production integration. Existing entrance,
gallery, glass, Chancellery and Minecraft preservation tests remain applicable.
