# Gendarmenmarkt and BND residential context, v214

Step 10 adds a bounded facade overlay to **17 existing building families**.
It does not replace any original wall/roof packet, courtyard, ground, navigation
or source owner. Gendarmenmarkt's monuments and the BND itself keep their earlier
models. This pass concentrates on surrounding houses.

## Ownership and evidence

The 15 Gendarmenmarkt families reuse exact `streetFronts` from
`gendarmenmarktPerimeterSource.json`. Additions are cornice drip edges, soffit
shadows and short returns. Only the already documented Hanns Eisler bracketed
cornice gains closely spaced brackets; Quartier 30 gains thin recessed upper
louvres. No new window grid or wall cladding is placed over these already
authored facades. Quartier 206 is explicitly omitted because v208 supplies its
separate finer reconstruction. Existing facade references and uncertainties in
[the perimeter source record](gendarmenmarkt-perimeter-sources-v146.md) remain
applicable.

Two independently identified residential fronts near the BND receive material
and facade recognition:

| Place | Retained source owner | New reading |
| --- | --- | --- |
| Living 108, Chausseestraße 108–109 | `DEBE00YY1f30003L`, mapped way `53492944` | Pale aluminium folded returns/hoods, large blue-grey glazing, narrow frames, source-stepped upper silhouette |
| Feuerlandhöfe, Chausseestraße 38–42 | `DEBE00YY27A000Ar`, mapped way `556551251` | Grey clinker taller street sections, pale plaster lower sections, tall windows, French rails and shallow balcony readings |

Both owners are absent from the v213 authored-building protection registry and
had no prior individual TypeScript facade model. Their existing measured
silhouettes remain intact. The new thin street-plane skin covers the earlier
generic aperture estimate only at those two verified fronts. All source sheets
and their original colours remain retained underneath; other elevations remain
untouched. Original Gendarmenmarkt facade details remain entirely uncovered.

[The Living 108 project manager](https://das-projekt-berlin.de/projekt/l108/)
documents the aluminium street front, six regular storeys and two setback
storeys, distinct plaster courts and projecting balconies. The inspected
photograph establishes the folded metal character; it is not a survey of every
aperture. Source wall boundaries determine where each local fit ends.

[Fuchshuber Planning](https://fuchshuber-planning.de/projekte/feuerland-hoefe-berlin/)
documents Feuerlandhöfe's clinker/plaster distinction and supplies the street
view. The [architect's Berlin architecture-prize entry](https://www.architekturpreis-berlin.de/Archiv/2020/Projekte/199/index.html)
confirms the Chausseestraße 38–42 identity, courts and street passages. Only the
front owner is refined here, not every building in the entire development.

The inspected external photos are reference-only:

- Living 108: `https://das-projekt-berlin.de/wp-content/uploads/2017/03/L108_1-1920x1080.jpg`
- Feuerlandhöfe, photograph credited by the architect to Tomek Kwiatosz:
  `https://fuchshuber-planning.de/site/assets/files/1950/382_1-1_dsc_0013-1.1180x0-f1.jpg`

No photographs, logos, facade textures or external pixels are bundled or loaded.
Colours, fold depths, frame sections and window/balcony rhythms are procedural
recognition fits. They must not be described as individually surveyed
construction details. Source measured walls/roofs and existing open courts
remain the metric authority.

## Source extraction and rendering

`scripts/build_gendarmen_bnd_context_v214.py` records immutable source SHA-256s.
The northern selection reads `source-390_5821-00.json.gz`, retains exact source
polygon identities, rejects internal part seams on both sides of the combined
footprint, and selects exterior planes facing the retained mapped
Chausseestraße axis within 28 m. The minimum endpoint eave conservatively bounds
each fit. There are 23 Living 108 and 13 Feuerland front planes, including the
short folded returns. No inferred broad rectangular house shell is introduced.

`createGendarmenBndContextV214(minecraft, { mobileLike })` returns two frozen
district batches. All drawn modes and touch/pointer profiles use identical
static detail: **2,785 instances / 212,956 GPU bytes**. Native Minecraft samples
an independent half-metre orthogonal facade surface, deduplicates occupied
cells, and merges only adjacent same-colour rows: **13,463 runs / 1,024,484
bytes**. Its 1.1 m exterior offset clears the existing two-metre native shell;
it does not replace or fill that building. There is no smooth native clone,
hidden solid building infill, per-frame work or residency-budget increase.

Focused checks: three Python tests verify deterministic output, immutable source
receipts and original face ownership; three Bun tests verify distinct visual
cues, no overpainting of authored Gendarmenmarkt windows, exact GPU budgets,
identical mobile detail, and independent axis-aligned native cells.
