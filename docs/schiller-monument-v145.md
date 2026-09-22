# Schiller monument on Gendarmenmarkt: source and visual evidence

Pipeline step 10. Checked 22 September 2026. This refines the existing
recognition object at OSM node `262457570`; it is not another tour stop.
`gendarmenmarktSource.json` retains its exact `[1425.438, 617.052]` scene anchor.
The existing square, theatre, church and tower source geometry stays intact.
No photograph, crop, texture or sculpture scan is a runtime asset.

## Published facts

[Bildhauerei in Berlin, Jörg Kuhn, Schillerdenkmal / Schillerbrunnen](https://bildhauerei-in-berlin.de/bildwerk/schillerdenkmal-7834/)
records Reinhold Begas's 1864–1869 work, inaugurated in 1871. It describes an
octagonal arrangement, six stepped lower tiers, grey-mottled marble below white
Carrara sculpture, a forged iron enclosure, four basins and four lion spouts.
Its dimensions are **8 m socle diameter**, **2.95 m standing statue**, and
**1.58 m smaller seated figure**. The listed larger figure is `1.66 mm`, an
obvious unit conflict: do not treat this as a measured millimetre dimension.
The text records reconstructed railings and the 2006 restoration, including the
tragedy dagger. The model should represent the restored enclosure, not the
temporary 1988 post-and-chain barrier. No active fountain jets are established.

The [Landesdenkmalamt record 09060093](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09060093)
establishes the location in front of the theatre, laurel-crowned poet, four seated
allegories, relief panels and lion heads. It identifies lyric poetry with a
string instrument, tragedy with dagger and mask, history with tablets and
philosophy with a scroll. The
[official Gendarmenmarkt ensemble description](https://www.berlin.de/landesdenkmalamt/_assets/pdf-und-zip/aktuelles/kurzmeldungen/eplatz_der_akademie_ensembleteil_2020-10-21.pdf)
also supports the elevated octagonal platform and iron enclosure. The
[2025 reopening announcement](https://www.berlin.de/sen/web/presse/pressemitteilungen/2025/20250313_pm_eroeffnung-gm.pdf)
supports the present paved setting; do not restore historical lawns around it.

## Explicit source conflicts and orientation

BiB calls Schiller's scroll hand the right. The inspected front photograph
clearly shows the **anatomical left hand** holding it. His right hand gathers
his cloak at the chest. The
[official Schillerpark inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046193)
also identifies the left hand on the bronze casting of this figure; that
separate monument is not the source for this marble monument's base.

BiB and the Landesdenkmalamt swap left/right for the rear allegories. This may
reflect a change of viewing side; it is not silently treated as agreement.
Use one consistent frame: a visitor on the eastern square looking west toward
Schiller and the Konzerthaus. The photograph showing tragedy beside history
and the figure close-ups support the following arrangement:

| Corner from the front | Approximate geographic corner | Allegory |
| --- | --- | --- |
| Front left | South-east | Lyrik |
| Front right | North-east | Tragödie / Drama |
| Rear left | South-west | Philosophie |
| Rear right | North-west | Geschichte |

Schiller faces away from the theatre onto the square. His axis follows the
theatre's existing source-derived bearing, rather than a newly invented
cardinal orientation. Cardinal labels above are approximate.

## Photo observations for procedural form

Schiller wears a long eighteenth-century coat, neckcloth, waistcoat, knee
breeches, stockings and shoes. His cloak gathers at the chest, drops in broad
asymmetric folds and loops below his raised left elbow. Wavy hair, a laurel
crown, defined nose and slightly raised chin distinguish the head from a sphere.
Feet and lower legs remain visible. He is slender and upright rather than a
solid robed column.

The seated women have different poses. Lyrik has long uncovered hair, a turned
head and a large upright swan-necked lyre with visible strings beside her knees.
Tragödie has a broad draped lap, bare forearms, dagger beside the seat and a
bearded theatrical mask at her foot. Philosophie is hooded, crosses one bare
lower leg, rests her chin on her left fist and holds a scroll across her lap
with the right hand. Geschichte bends toward a large upright tablet supported
on a raised knee; further tablets hang down beside the seat.

The square pedestal has projecting cap and foot mouldings, a front name field,
side relief fields and low circular lion masks. Four shallow curved basins
project from its faces between the figures. The women occupy the corners;
one continuous circular bowl would misrepresent the arrangement. The iron
fence has dense paired curls and upper scrolls, not a plain spear-picket rhythm.

Only the published dimensions above are metric claims. Intermediate pedestal
heights, step rise/run, fence offset and member sizes, anatomy, relief strokes,
fold subdivisions and marble shades remain photo-proportioned display geometry.
The 8 m figure is the socle diameter, not an independently surveyed fence
diameter. No reliable overall monument height was found in the checked primary
records. Do not label an inferred overall height as surveyed.

## Inspected Commons photographs and credits

All nine files were inspected as external references. Their full per-file
metadata is mirrored in `geo_data/regierungsviertel/wikimedia_references.json`
and `src/app/public/dzi/regierungsviertel/wikimedia_attribution.json`, with
`photo_bundled: false`. Downloads used for inspection remain outside the repo.

| File | Author / licence | Evidence |
| --- | --- | --- |
| [Schiller-Denkmal -- 2021 -- 9160](https://commons.wikimedia.org/wiki/File:Berlin_(DE),_Gendarmenmarkt,_Schiller-Denkmal_--_2021_--_9160.jpg) | Anil Öztas / CC BY-SA 4.0 | Entire ensemble, step finish and fence |
| [Schiller-Denkmal am Gendarmenmarkt](https://commons.wikimedia.org/wiki/File:Schiller-Denkmal_am_Gendarmenmarkt.jpg) | Ladiszlai / CC BY-SA 4.0 | Tragedy mask, drapery and adjacent lyre |
| [Allegorie Geschichte](https://commons.wikimedia.org/wiki/File:Schillerdenkmal_Berlin,_Begas,_Allegorie_Geschichte.jpg) | Manfred Brückels / CC BY-SA 3.0 | Tablet pose, bare foot, drapery |
| [Allegorie Lyrik](https://commons.wikimedia.org/wiki/File:Schillerdenkmal_Berlin,_Begas,_Allegorie_Lyrik.jpg) | Manfred Brückels / CC BY-SA 3.0 | Swan-neck lyre, exposed strings and arms |
| [Allegorie Philosophie](https://commons.wikimedia.org/wiki/File:Schillerdenkmal_Berlin,_Begas,_Allegorie_Philosophie.jpg) | Manfred Brückels / CC BY-SA 3.0 | Hood, chin-resting fist, scroll, crossed leg |
| [Allegorie Tragoedie](https://commons.wikimedia.org/wiki/File:Schillerdenkmal_Berlin,_Begas,_Allegorie_Tragoedie.jpg) | Manfred Brückels / CC BY-SA 3.0 | Lap, bare arms, low hand beside seat |
| [Brunnenschale](https://commons.wikimedia.org/wiki/File:Schillerdenkmal_Berlin,_Begas,_Brunnenschale.jpg) | Manfred Brückels / CC BY-SA 3.0 | Basin section, lion mask, tragedy/history adjacency |
| [Statue 2](https://commons.wikimedia.org/wiki/File:Schillerdenkmal_Berlin,_Begas,_Statue_2.jpg) | Manfred Brückels / CC BY-SA 3.0 | Full poet anatomy, scroll hand and cloak |
| [Gendarmenmarkt Begas 1](https://commons.wikimedia.org/wiki/File:Schillerdenkmal_Berlin_Gendarmenmarkt_Begas_1.jpg) | Manfred Brückels / CC BY-SA 3.0 | Frontal hierarchy and pedestal proportions |

Licences: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
