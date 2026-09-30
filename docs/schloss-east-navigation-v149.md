# Navigation on the existing eastern lobe — v1.0.49

The v1.0.48 street/neutral plates already extend east of the old terrain grid,
but pedestrian environment bounds still stopped at x=2412 m. The result was a
return to Pariser Platz when entering walking mode in any of the three Rathaus
courts; walking on its correctly resolved roof also stopped outside the old
rectangle.

The new lightweight `schlossEastNavigation` supplement fixes that mismatch.
It is prepared from the **committed rendered triangle footprints**, clipped to
the neutral eastern extension and only to the area beyond the old grid. Source
polygons and holes are retained. Its 285 KB JSON contains no building geometry,
rendering code, heavy street buffers or photos. A 32 m spatial lookup limits
surface queries. Native support uses only the already prepared asphalt runs;
all other native street/backing kinds share the existing 0.32 m lift.

The existing eastern height-sample column is uniformly y=5.2 m; the renderer
clamps to that column outside the grid. This supplement follows that **display
fallback**, adding the renderer's 0.10 m neutral/paving, 0.18 m road and 0.32 m
sidewalk lifts. It does not claim surveyed terrain for the new district. Native
uses the existing 0.18/0.32 m block tops. The original terrain sampler and all
height values **inside the previous grid remain unchanged**. Small decorative
kerb lips do not become collision barriers. Exact source roofs retain priority
above the ground, including the Rathaus tower platform at 77.46 m.

Only the environment with the source-bound Berlin city enables this supplement,
including a Minecraft cold start. Its east bound extends to x=2805 m, but the
ground callback still returns null beyond the **actual rendered lobe**. Merely
being inside the enlarged bounding rectangle never creates new traversable
territory or geometry. Synthetic and partial environments keep their own grid.

Rebuild with `uv run python scripts/build_schloss_east_navigation.py`.
The generator records SHA-256 hashes of both retained street inputs and the
original terrain payload. Python tests compare generated/stored data and exact
source intersections. Frontend tests use the complete real terrain and prism
payloads, the original protected-memorial index and every visual mode; they
check Rathaus court spawns/walking, eastern street movement, platform support,
Marien lantern openings/piers, TV shaft/sphere distinction, free Forum paths,
individual sculpture/trunk collisions and the small walkable Marx/Engels base.

The previously protected `way/895523112` Marx/Engels ensemble used its whole
source bounding box as a visitor obstacle in Schwellenraum. Its original
horizontal prop-exclusion footprint and 1.25 m margin are retained, while
visitor protection follows only the represented figures, plinths and other
individual public-realm solids. This keeps the paths between them open and
the 18 cm base standable, without removing the memorial's source protection.
