# Gymnasium Steglitz: Heesestraße and courtyard sports hall

The owner's four photographs replace the earlier evenly spaced five/six-storey
window estimate on the three Heesestraße wall sheets. The new reading has three
occupied floors above a basement, three triple-light Aula arches with oculi,
cream frames, muted green/cream diamond spandrels, dark masonry courses,
pale gold corner ornaments, an arched timber entrance and outward-facing
GYMNASIUM lettering. Small ornament forms and aperture dimensions are abstract
photo estimates, not a measured architectural reconstruction.

The courtyard sports hall is the **existing five-part LoD2 owner
DEBE06YYB0000nL1**, not a new generic volume. The school-operated
[virtual tour](https://rundgang.gymnasiumsteglitz.de/#g281) shows white rendered
walls, two long divided window banks and a round stair window. This takes
precedence for paint over the older red-brick
[KLW renovation photographs](https://www.klw-berlin.de/gymnasium-steglitz/).
The [school inspection](https://dashboard.gymnasiumsteglitz.de/f/Bericht-06Y13.pdf)
confirms a basketball-size ground hall and smaller upper gymnastics hall.
Archive dating varies (1961/1964); no guessed construction date is displayed.
The [heritage register](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065532)
identifies the main school at Heesestraße 15. User and school photographs remain
reference material only; no photographs or textures are shipped.

All measured wall/roof vertices, source triangles, footprints, navigation and
native occupied cells remain intact. Only exact, receipted old authored window
rows and their v246 glazing refinements yield. Selected original wall colours
and native cell colours change in place. All unrelated school, plaza, street,
memorial, fountain and neighboring details remain. The main school owner is
DEBE06YYB0000AUq.

`steglitzSchoolV250.ts` verifies six typed streaming fingerprints before **any**
change. A changed surface, paint, row, owner or truncated original payload retains
all earlier layers and suppresses the complete new replacement. Only the boolean
verification outcome is cached. The new details reuse the existing v205 school
batch; no additional render root, animation, texture, live coverage or mobile
quality tier is introduced. Native members are built independently on actual
axis-aligned source support cells, with separate glass/frame depths.

The finite replacement contains 961 boxes, 882 rods and 2778 native rows.
Its source JSON is 264,793 bytes; the actual lossless Vite data transform is
154,785 bytes. Geometry instances require 140,068 bytes drawn or 211,128 bytes
native before the short procedural sign. Native placement uses the outermost
retained source-cell plane per lateral slice across the complete facade height;
the earlier vertical variation could expose old voxel strips through new panes.
The obstruction regression checks at least 9.99cm clearance ahead of every
retained support face at sampled school and hall cross-sections.
The generator and source ownership receipts are
`scripts/build_steglitz_school_v250.py` and
`geo_data/regierungsviertel/steglitz-school-v250-evidence.json`.
Review Heesestraße from camera **[-3185,20,6828]** toward **[-3200,18,6825]**,
with 85-degree field of view for the complete central Aula facade;
the former x=-3162 camera was inside the opposite building. Review the hall
from **[-3248,17,6820]** toward **[-3251,9,6799]**. Camera Y coordinates are
world coordinates, including the retained school terrain elevation. An elevated
overview above the opposite houses is **[-3150,49,6828]** toward **[-3200,15,6825]**.

Focused validation:
`uv run pytest -q tests/test_steglitz_school_v250.py`
and `bun test tests/steglitz-school-v250.test.ts` from `src/app`.
These cover deterministic generation, immutable originals, exact wall
attachment, photo recognition, native depth, source-change fallback, preservation
of unrelated rows and the under-200KB transformed data payload.
