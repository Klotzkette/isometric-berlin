# Local pedestrian recovery

Step 10 adds an explicit local recovery action without changing ordinary wall,
shoreline or memorial collision. The visitor's live heading and pitch are retained.

The navigation layer records at most 48 grounded, verified clear walk positions,
spaced at least 3 m apart. Recovery first rechecks the recent trail against the
current mode. Destinations are 4–96 m away and must stay on the same tunnel layer
and within 1.5 m of the present floor. Consumed trail entries are removed so
repeated recovery continues backwards instead of bouncing between two places.

If no trail point qualifies, twelve local radii from 2 to 96 m and 24 directions
are checked. A destination must have valid supporting ground, standing body
clearance, a dry shoreline margin and a swept 2 m way forward. Protected memorial
volumes always take precedence. The search is bounded and only runs on a recovery
request; the ordinary render loop never searches the surrounding city.

If no local walking destination exists, the separate flight helper checks only
the current X/Z column, up to 256 m above the eye and the viewer's 280 m ceiling.
It uses the existing Minecraft/Schwellenraum flight-sphere collision API to find
clear space above the last intersected solid, rather than mistaking an empty room
under a roof for an exit. The caller translates the camera and target together
and switches to flight. A column with no clear endpoint returns `null`; it is
never replaced by an unrelated landmark spawn or an unchecked point. This is an
explicit recovery exception and is not used during normal visual-mode changes.

Two related collision defects are corrected:

- Deferred water no longer discards every intermediate wet frame. A visitor
  already surrounded by newly loaded water can leave it across several slow
  frames; a dry visitor still cannot enter water, and no automatic reset occurs.
- The source-tree visibility hook also applies to the flying camera, preventing
  omitted Minecraft trees from leaving invisible flight obstacles. Other
  fixtures, the retained landmark oak and protected volumes keep their policy.
  Walking out of a late solid overlap cannot bypass a protected memorial.

An idle visitor also keeps the existing floor height and tunnel state after a
visual-mode switch, even if a block deck differs slightly from its drawn reading.
Head look and a vertical jump do not trigger an unsolicited ground snap. Actual
horizontal movement resumes the normal mode-aware supporting-floor query.

Tests exercise a small enclosed cavity, stale checkpoints, water and bounds,
exhausted recovery, repeated recovery, tree visibility, a tall solid building and
an empty room below a roof. Source-payload tests retain the actual Hauptbahnhof
gallery and Tiergartentunnel floor in all five modes. Normal wall, bridge,
Brandenburg Gate, Serra, Wagner and Invalidenfriedhof access tests remain green.
