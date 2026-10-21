# City West venues — v260 / Step 10

The exact named sites are Ludwig-Erhard-Haus (IHK Berlin, Fasanenstraße 85),
Renaissance-Theater (Hardenbergstraße 6 / Knesebeckstraße 100), and Delphi
Filmpalast (Kantstraße 12a). Delphi is the provisional interpretation of the
owner's nearby old cinema; it is distinct from Zoo Palast and Kant Kino.

The operator and borough identify Ludwig-Erhard-Haus as Nicholas Grimshaw's
1994–98 building with fifteen structural arches, suspended office floors,
two atria and a straight street facade. Berlinische Galerie's pictured
working model shows **unbuilt alternatives**: its image is not used as built
geometry. The borough's 2022 exterior photograph guides metal/glass character.
The LDA's Renaissance exterior photograph guides the five blue glazed foyer
fields and curved cornices; the Delphi borough photograph guides the two dark
columns, entrance canopy, inset panel and lettering. No photograph, plan or
texture is bundled.

## Metric source and exact ownership

Two already cached official LoD2 archives supply all source rings, walls,
roofs, ground sheets, parts and openings. The three existing coarse owners
remain unchanged in the original source JSON; only these exact presentation
owners yield after required replacement construction:

| Venue | LoD2 parent | Parts | Old OSM prism | Source top, viewer y |
|---|---|---:|---|---:|
| Ludwig-Erhard-Haus | `DEBE04YY500005Uo` | 77 | `16160637` | 45.1 m |
| Delphi Filmpalast | `DEBE04YY500007vQ` | 9 | `32861687` | 22.929 m |
| Renaissance-Theater | `DEBE04YY50000AZq` | 2 | `48793287` | 32.074 m |

The retained source ground uses the existing viewer y=5.2 m datum. Source
geometry includes 1,647 surfaces and 2,357 wall/roof triangles. Unchanged
source-owner hashes, source archive hashes, overlap/area conflicts and
complete source data live in `west-venues-v260-evidence.json` and the bounded
`west-venues-v260-source.json.gz`. No surrounding parcel or street is removed.
The prior OSM ID `16160637` differs from the current mapped LEH way
`216160637`; substitution uses the delivered identifier, never the newer ID.

Fifteen roof rib stations are reference estimates. Each visible rib follows
the upper section of the measured roof triangles; lower overlapping source
sheets remain complete. Rib dimensions, facade grids, windows, colors, sign
strokes, small cornices and columns are display estimates, not a survey.
Renaissance's measured roof is a coarse upper envelope: it does not faithfully
resolve the steep historical front gable visible in the LDA photograph. This
conflict is retained explicitly; this pass does not invent a higher apex or
remove measured source sheets. A future source-supported gable correction
must establish its own exact replacement receipt.

## Runtime and checks

The drawn family uses two compact batches and the exact same static geometry
on desktop and mobile. The independently authored native family uses one
orthogonal batch, including two-metre source-surface cells and finer exterior
facade strips. Native arrays remain packed strings until that family is built;
no hidden solid volume is filled. Existing disposal, required-site loading,
source credits, collision and scene budgets remain authoritative. No streaming
descriptor, tour stop or animation is added.

`tests/test_west_venues_v260.py` verifies exact archive rings (when cached),
unchanged original owners, complete packed drawn triangles/colors, all native
source vertices, fifteen nonempty roof sections, five blue fields and two
cinema columns. `src/app/tests/west-venues-v260.test.ts` checks equal mobile
geometry, render limits, orthogonal native transforms, exact-column ownership
and measured roof queries. Isolated native Safari review covered all three
drawn facades, including correcting mirrored facade lettering. Native visual
review was prevented when macOS locked after physical input; native source
coverage and transforms passed the independent tests.

Primary source URLs and photographic credits are in
`docs/west-venues-v260-sources.json`. References were checked 21 October 2026.
