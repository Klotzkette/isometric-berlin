# Behrenstraße 42 and ordinary Mitte facades — step 10, v1.0.38

Hengeler Mueller's Berlin office is in the **Humboldt Carré**, the former
Disconto-Gesellschaft bank complex at Behrenstraße 42. This recognition model
does not add a tour stop. It combines the complete original Berlin LoD2 envelope
with restrained sandstone, opening and modern-glazing subdivisions.

## Source roles and conflicts

- [Hengeler Mueller's Berlin office page](https://www.hengeler.com/de/service/standorte/berlin/)
  confirms the current office address.
- [Landesdenkmalamt object 09080273](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080273),
  also retained in the official
  [Berlin monument list](https://www.berlin.de/landesdenkmalamt/_assets/pdf-und-zip/denkmale/liste-karte-datenbank/dm_liste.pdf),
  identifies the Disconto complex, Ludwig Heim's original building and the
  Bielenberg & Moser extensions. The individual database endpoint did not return
  its record during this pass; the official monument list supplies the identity.
- [The operator's architectural history](https://www.humboldt-carre.de/geschichte)
  and [2024 presentation](https://www.humboldt-carre.de/fileadmin/humboldtcarre/resources/images/downloads/allgemein/Humboldt_Carre_Praesentationsmappe.pdf)
  identify Alt-Warthauer sandstone, the historic banking hall and reconstruction
  of the stepped upper floors. Intermediate floor heights, bay spacing, window
  reveals and local member sizes in the viewer remain display estimates.

The metric source is the complete eight-part parent **DEBE01YYK00002wR** in
the retained official [LoD2 tile 390_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5819.zip)
(Geoportal Berlin, dl-de/zero-2-0). Its source name, **Botschaft Turkmenistan**,
is preserved verbatim even though its full footprint includes Humboldt Carré.
The office and monument identities, and [OSM way 24247494](https://www.openstreetmap.org/way/24247494),
resolve that naming ambiguity without renaming the original source.

The old scene showed much of this complex as a 15 m OSM block and retained only
small clipped strips of two official parts. The new source supplement preserves
all eight original wall/roof sheets and all three old display records. Only
`24247494`, `tFwVfxeq` and `sYh7HYMU` are replaced in display; more than 99% of
each old footprint is covered by the complete source envelope. Rear neighbour
`56467771` stays because only 78.3% of that footprint overlaps.

Raw source ground is 3.313 m and the highest roof is 34.632 m in the viewer's
datum. A documented **+1.887 m** display translation preserves the delivered
5.2 m street base and produces a 36.519 m top. Source polygons, coordinates and
holes remain unchanged in `behren42Source.json`; the translation is separate.

## Recognition geometry

South Behrenstraße and west Charlottenstraße elevations retain the source
orientation. The shallow source risalit determines the local facade offset, so
windows do not disappear inside a flat wall proxy. The historic portion reads
with four opening registers, the tall round-arched upper row, rusticated base,
recessed blue-grey panes, pale jamb returns, pilasters and projecting cornices.
The modern upper storeys form a separate dark-framed glazed band. Their local
subdivisions are procedural rather than an opening-by-opening survey. A small
geometric name plaque identifies the requested occupant; its display placement
is not claimed to be a surveyed sign location. No roof advertisement is added.

The uppermost source roof remains the official envelope. The photograph's
curved glazed return is not used to invent an unsurveyed replacement roof.
Minecraft uses cube geometry only, with stepped arches and a surface-only
building shell. It does not retain a second smooth facade or fill the whole
interior with hidden cubes. Full and mobile profiles use the same bounded
model; no frame update, new texture or image request is needed.

Two free external reference photographs were inspected, and must be recorded
in both viewer attribution manifests. Neither photograph is bundled:

| File | Author and licence | Evidence |
| --- | --- | --- |
| [Berlin, Mitte, Behrenstraße, Humboldt-Carré.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Behrenstraße,_Humboldt-Carré.jpg) | Jörg Zägel, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), 27 July 2009 | South and west facade, stone base, arched row, modern upper glazing |
| [Humboldt Carré, Hengeler Mueller Berlin.jpg](https://commons.wikimedia.org/wiki/File:Humboldt_Carré,_Hengeler_Mueller_Berlin.jpg) | Max Christophel / Project Motion, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), 13 June 2025 | Current sandstone arches, deep panes and dentil cornice; supplied through the firm, VRT ticket 2025062510005042 |

## Ordinary Mitte neighbours

The existing material/colour and facade-ink scope adds the display rectangle
`x=1280..2180, z=-400..1100` around HU, Bebelplatz, Gendarmenmarkt and adjoining
Mitte blocks. This is a bounded presentation mask, not an administrative border.
It includes 673 retained source parts; 319 have accepted existing OSM attributes,
311 carry a storey count and 39 carry an explicit facade colour. Parts are not
individual houses, and those counts include authored buildings whose palettes
keep priority.

Mapped colours/materials retain priority over the old illustration sample.
Unsupported neighbours use only the existing restrained illustration palette;
no surveyed real-world colour is claimed. Existing valid mapped storey rhythms
in the requested urban scope now get the paired head line at every represented
floor, using the existing shared line batch. No additional opening positions,
floor counts, doors, balconies or footprint changes are inferred. Outside the
scope the previous first/last-floor rule stays in place.

## Cost and verification

| Model | Draw calls | Instances | Stored geometry/instance bytes |
| --- | ---: | ---: | ---: |
| Drawn, full and mobile | 3 | 2,123 | 200,552 |
| Minecraft, full and mobile | 1 | 3,744 | 285,192 |

The source supplement is 22,077 bytes. Local constructor times were about 8 ms
drawn and 9 ms native in Bun; these are not phone frame-rate measurements.
Palette/ink changes add no draw calls. A full source-slice facade audit after
integration measured 31,444,560 bytes across the existing facade line buffers;
the integrated figure also includes the other same-release source replacements.

The frontend regression checks actual ray intersections through five south
facade bays in both forms, finite data, immutable source records, source height,
bounded footprints, one native cube prototype and narrow rotated upper bands.
The ordinary-facade checks retain known mapped material colours, out-of-scope
colours and original building positions. A six-storey source part gets 24 head
strokes rather than the previous eight while keeping the same building mesh.
Python tests verify all eight parts remain inside bounds and all three replaced
source records are retained verbatim with justified footprint overlap.

Chrome/Three.js renders of the actual source-plus-detail group were inspected
from a southwest isometric view in drawn and native modes. Both retain clear
historic arches and modern glazing without source-wall occlusion. Host rendering
does not establish performance or stability on a physical older iPhone.

Reproduce the source supplement with
`uv run python -m scripts.build_behren42_source` from the repository root.
