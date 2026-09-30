# Gedächtniskirche visual audit for v1.0.54

Step 10, independent reference review of the v1.0.53 model. This document
records findings, not a claim that every proposed correction is already
implemented. No reference photograph is a runtime asset or a measured mesh.

## Evidence and source distinctions

The church's [ensemble account](https://www.gedaechtniskirche-berlin.de/bauensemble/ensemble-aus-alt-und-neu)
establishes the 71 m ruined tower and the arrangement of the four modern
buildings. Its [bell-tower account](https://www.gedaechtniskirche-berlin.de/geschichte/das-kirchen-ensemble/gebaeude-1895-1963/der-glockenturm)
gives the 53.3 m tower, 12 m hexagonal diameter, broad bell-chamber band and
gold finial. Its [church account](https://www.gedaechtniskirche-berlin.de/bauensemble/kirche)
describes the 35 m octagon, square concrete cells, opaque lower register and
east entrance facing the ruin. These published dimensions and existing OSM
identities remain the metric anchors.

The [Landesdenkmalamt conservation account](https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/sakralbauten/kaiser-wilhelm-gedaechtnis-kirche-turmruine-639409.php)
identifies the surviving main tower and parts of the west front. The
[church's visitor account](https://www.gedaechtniskirche-berlin.de/besuch/fuehrungen-gebaeude-ensemble/angebote/ins-innere-der-turmruine)
distinguishes an approximately 10 m level at the former rose window and
another approximately 20 m level. This is relevant to the stacked opening
hierarchy: the large ruined nave arch is elevated above the memorial hall;
it is not simply a giant ground-level tunnel.

The [church's 2025 conservation report](https://www.gedaechtniskirche-berlin.de/fileadmin/user_upload/Mediathek/Leseauszug_KWG_Magazin_Cover_11-16_28-30_96dpi_250912.pdf)
confirms four restored clock mechanisms and renewed gilt hands and dials.
Clock diameters, local stone counts and individual opening dimensions are
not established by these texts and must remain labelled display estimates.

## Critical differences in the v1.0.53 render

1. **Upper tower silhouette.** The model's rectangular belfry with a wide
   flat square roof ledge is visibly wrong. The photographs show an
   eight-sided upper storey with prominent gables, corner shafts and deeply
   open faces. Its openings alternate between broad scalloped arches and
   paired narrow arches with a small round tracery field above. Three equal
   painted windows on only two flat walls lose this defining shape.
2. **Broken copper spire.** The original has a tall, steep-sided metal stump,
   visible standing seams and a stepped asymmetric break, with small pointed
   dormer openings. The v1.0.53 shell reads as a low tent or solid rock.
   Preserve the hollow centre and 71 m maximum; make the broken edge stepped
   and the panel seams vertical, without restoring the lost historic tip.
3. **Surviving side turrets.** The west-front remnants include conspicuous,
   unequal small towers. The southern one retains a tall steep spire and
   cross; the opposite turret has a visibly shorter damaged cap. These are
   not the four tiny decorative cones on the main belfry in the old model.
4. **West facade and lower volumes.** The intact west side has a very large
   circular former rose opening, triangular gables, grouped round-arched
   windows and a projecting rounded apse with tall windows and an upper
   arcade. The old render reduces this to a blank block and one repeated
   portal. Preserve the exact source-wing plan while adding these features.
5. **East ruin face.** The eastern, former-nave side exposes rough brick
   core, large stacked broken arch openings, cut vault remnants and weathered
   wall edges. It must look different from the surviving west facade.
6. **Clock register.** Four gold faces are correct, but they should read as
   thin concentric gilt rings and hands with Roman numeral strokes over dark
   tracery. The small green corner roofs flank the clocks below the arcade;
   flat full-height square posts are a weak substitute.
7. **Arcaded transition.** A continuous low arcade and decorated cornice
   separates clock stage from open belfry. It must wrap around the upper
   polygon, not appear only as short marks on two opposite walls.
8. **Masonry.** Current stone is too uniformly dark grey-brown. Reference
   images show warm grey/beige tuff, dark weathered patches, pale replaced
   stones and local reddish-grey exposed brick. Use bounded colour facets
   and recessed course cues, not a photograph or random noise texture.
9. **Modern concrete-glass contrast.** The exterior concrete cells are
   thick and deeply recessed; daylight glass is generally dark or muted.
   Blue luminosity belongs most strongly to illuminated/night views. Retain
   the already correct square cell rhythm, but avoid making every daytime
   pane equally bright blue.

These are visual observations from the licensed photographs below. Proposed
proportions are procedural interpretation, not photogrammetry or a facade
survey. Temporary scaffolding, stalls and construction equipment should not
be mistaken for permanent church architecture.

## Relative orientation and provisional proportions

In the existing local frame (`rotationY = 79.93°`), positive local x points
approximately north and positive local z approximately east. The high,
cross-topped subsidiary spire therefore belongs at the southwest corner
(negative x / negative z); the shorter damaged subsidiary tower belongs
northwest (positive x / negative z). The two Bulach photographs were taken
from opposing northwest and southwest camera positions and establish this
relative orientation. Exact small-tower centres remain display estimates.

The photograph-based stage checks support a clock centre around the retained
36.4 m display value, the low arcade around 40–44 m, the open belfry around
44–56 m and its gable peaks around 59 m. The tall small turret reaches
approximately 47–51 m and the short one approximately 36–40 m. These ranges
are approximate visual ratios, not published or surveyed heights. The main
ruin must continue to end at the published 71 m.

The committed low OSM ruin footprint has rounded projections at both its
north and south ends. The v1.0.53 retained-wing difference exposes only the
southern projection because the broad authored core encloses the northern
one. A more articulated core must preserve both mapped projections.

## Freely licensed photographs actually inspected

All are external visual references only, licensed
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
No photograph, crop, tracing, texture or original image bytes are bundled.

| File | Author / date | Useful evidence |
| --- | --- | --- |
| [00 1503 Berlin - Kaiser-Wilhelm-Gedächtniskirche.jpg](https://commons.wikimedia.org/wiki/File:00_1503_Berlin_-_Kaiser-Wilhelm-Ged%C3%A4chtniskirche.jpg) | W. Bulach, 17 May 2010 | Southeast full-height ruin: octagonal belfry, gables, southern side spire, clock stage and raised eastern arches |
| [.00 0699 Baudenkmal Kaiser-Wilhelm-Gedächtniskirche in Berlin.jpg](https://commons.wikimedia.org/wiki/File:.00_0699_Baudenkmal_Kaiser-Wilhelm-Ged%C3%A4chtniskirche_in_Berlin.jpg) | W. Bulach, 17 May 2010 | Opposite oblique view of copper seam pattern, stepped broken silhouette and belfry opening hierarchy |
| [Berlin 20171030-08 Kaiser-Wilhelm-Gedächtniskirche.jpg](https://commons.wikimedia.org/wiki/File:Berlin_20171030-08_Kaiser-Wilhelm-Ged%C3%A4chtniskirche.jpg) | Pymouss, 30 October 2017 | West/northwest facade, round former rose opening, triangular gables, short turret cap and apse |
| [Berlin 20171030-10 Kaiser-Wilhelm-Gedächtniskirche.jpg](https://commons.wikimedia.org/wiki/File:Berlin_20171030-10_Kaiser-Wilhelm-Ged%C3%A4chtniskirche.jpg) | Pymouss, 30 October 2017 | Cut east-side vault and masonry depth |
| [2021-07-19 Kaiser-Wilhelm-Gedächtniskirche Berlin 06.jpg](https://commons.wikimedia.org/wiki/File:2021-07-19_Kaiser-Wilhelm-Ged%C3%A4chtniskirche_Berlin_06.jpg) | Geoprofi Lars, 19 July 2021 | Stacked east-side openings, broken arches, differentiated brick and stone |
| [2021-07-19 Kaiser-Wilhelm-Gedächtniskirche Berlin 07.jpg](https://commons.wikimedia.org/wiki/File:2021-07-19_Kaiser-Wilhelm-Ged%C3%A4chtniskirche_Berlin_07.jpg) | Geoprofi Lars, 19 July 2021 | Low curved glazed shop insertion, inspected as context rather than a tower-shape source |
| [Kaiser-Wilhelm-Gedächtniskirche Sommer 2024 2.jpg](https://commons.wikimedia.org/wiki/File:Kaiser-Wilhelm-Ged%C3%A4chtniskirche_Sommer_2024_2.jpg) | Hwyrd, 24 July 2024 | Confirms permanent east ruin form against the earlier unobstructed views; already credited in v1.0.53 |

## Review views

Acceptance should include south/east and west/north oblique views, a high
view into the open crown, an eye-level west view, and a night view of the
Eiermann glass. Confirm the side-turret asymmetry and actual openings from
both sides. Repeat the geometry presence check in Minecraft and verify that
mobile uses the complete drawn detail. Preserve all existing exact source
wings and surrounding streets; no generic replacement may re-close the
authored openings.

## Implemented result and independent checks

The resulting v1.0.54 drawn model addresses the upper octagonal opening
hierarchy, hollow stepped copper sheath, asymmetric subsidiary turrets,
gables, rose opening, raised east-side arch, capped clock-stage corners and
articulated source apse. Daytime concrete/glass contrast is more restrained;
night emission remains blue. The lower hall has a 3.2 m display entrance
instead of the erroneous 10.5 m ground tunnel. The official 71 m total and
the complete retained OSM wing area remain unchanged.

Isolated isometric, southwest, east and close belfry renders were inspected.
The focused City West tests and full static-detail parity suite pass together
(49 tests). Ray checks verify the narrow hall entrance, its solid flanks,
different west/east opening bottoms, all eight genuinely open belfry faces,
supporting piers, unequal subsidiary spires and hollow crown. Full and mobile
City West geometry match exactly: 12 draw calls, 113,516 stored vertices and
2,434,560 geometry bytes. The independent block-native ensemble uses 15,632
instances in one batch. These checks are geometry/browser evidence, not a
claim that the model is a measured architectural survey.

Geometry attributes and indices of the other three City West subgroups were
also compared directly with v1.0.53: towers/Kranzler, Bahnhof Zoo and Urania
are byte-identical. Their 11,184, 3,624 and 752 stored vertices respectively
were not simplified by this church correction. The v154 parity fixture
overrides only City West; all earlier baselines remain frozen.
