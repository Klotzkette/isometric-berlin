# Bahnhof Zoologischer Garten and Amerika Haus — v1.0.65

Step 10 replaces the former two blue station boxes with the complete measured
station composition and adds source-bound Amerika Haus architecture. No roads,
rail approaches, neighbouring buildings, source records or tour stops are removed.
All drawn modes use the same full static detail on touch and pointer devices.

## Metric source and ownership

Berlin LoD2 tile `386_5818` supplies 21 parts in eight parent objects:

| Parent | Model owner |
|---|---|
| `DEBE04YY500000tN` | Six northern hall/base parts |
| `DEBE04YY50002d4Q` | Three regional-hall parts |
| `DEBE04YY50002cek` | S-Bahn hall |
| `DEBE04YY50002beL` | Terrassen am Zoo |
| `DEBE04YY50002bg4`, `DEBE04YY50002d5W` | Two northern platform canopies |
| `DEBE04YY50002bYJ` | Jebensstraße entrance |
| `DEBE04YY500005rJ` | Seven Amerika Haus parts |

Every one of the 777 original boundary surfaces is retained in the source JSON.
The visible wall/roof planes are triangulated without removing their vertices,
flattening roofs, closing courtyards or replacing them with bounding boxes.
The common station source datum is 31.68 m NHN; Amerika Haus uses 31.61 m NHN.
Those datums map to viewer y=5.2 m. Exact original height differences remain.
The station's upper walls use low-alpha glazing with depth writes disabled;
the actual shallow opaque roofs retain their full original shape. A transparent
box is not placed over an older opaque hall. Opaque source roofs remain opaque,
as shown by the photographed roof underside.

The OSM map response of 1 October 2026 supplies the exact building footprints
`96955257`, `20145539` and `421829986`, the six numbered track courses, three
full platform multipolygons `3641992`, `3641993`, `3641994`, mapped stairs,
and indoor shop/lift/mezzanine parts. The entire platform outlines are retained,
including holes and the parts outside the hall. Twenty-nine mapped above-ground
stair courses receive an explicitly estimated storey-to-storey elevation.
The region and archive hashes are retained in the generated source payload.
No protected DB map was traced or copied.

The source conflict is explicit: indoor OSM building parts had previously become
opaque nine-metre fallback prisms. Their original records remain in
`legacyPrisms` and `osmEvidence`; the new owner renders their mapped footprints
as thin glass/frame room and lift subdivisions and mezzanine floors. Exactly
28 retained core prisms are replaced. Adjacent Zoo Palast, the towers, Amerika
Haus neighbours and all external kiosks remain independent. Native suppression
requires the matching source ring, base and quantized height, not a radius.

## Recognition evidence

[Berlin heritage record 09040500](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040500)
describes the differently sized steel-and-glass halls, the four-track regional
hall with two island platforms, the separate S-Bahn hall projecting across
Hardenbergstraße, limestone viaduct facing, and the 1957 restaurant level on
slender supports. [DB's station page](https://www.bahnhof.de/berlin-zoologischer-garten)
and its textual platform inventory confirm the six track numbers and access
functions. [S-Bahn Berlin](https://sbahn.berlin/fahren/bahnhofsuebersicht/zoologischer-garten/)
documents the S-Bahn access from Hardenbergstraße and platform-centre stairs.
The model keeps public concourse space below the elevated platforms. Its source
walls no longer imply a solid, unenterable station volume. Fine structural
members, benches, signs, track/sleeper widths and stair elevations are authored
recognition estimates; this is not a structural or station-operation survey.

[Berlin heritage record 09096192](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096192)
documents Bruno Grimmek's 1956–1957 Amerika Haus, its two-storey glazed street
bar, rear event/reading wings and the abstract flag mosaic above the entrance.
[C/O Berlin](https://co-berlin.org/en/about-us) identifies its present use and
2014 move into the building. Seven complete measured parts retain that form.
The entry has white-framed doors, shallow steps, a blue-grey/orange procedural
mosaic reading and texture-free `AMERIKA HAUS` / `C/O BERLIN` lettering.
Fine mosaic and window divisions are estimates, not a traced artwork or facade
survey. Rear measured volumes remain visible.

Four Commons photographs were inspected locally and remain reference-only:

| Photograph | Attribution and licence | Use |
|---|---|---|
| [C-O Berlin im Amerika Haus-2575.jpg](https://commons.wikimedia.org/wiki/File:C-O_Berlin_im_Amerika_Haus-2575.jpg) | Raimond Spekking, CC BY-SA 4.0 | Restored entrance, mosaic colours, lettering and glazing |
| [Bahnhof Berlin Zoologischer Garten Berliner Stadtbahn Hardenbergplatz Foto 2007 Wolfgang Pehlemann IMG4621.jpg](https://commons.wikimedia.org/wiki/File:Bahnhof_Berlin_Zoologischer_Garten_Berliner_Stadtbahn_Hardenbergplatz_Foto_2007_Wolfgang_Pehlemann_IMG4621.jpg) | Wolfgang Pehlemann, CC BY-SA 3.0 | Open curtain walls, dark steel, shallow roof and terraces |
| [2021-07-19 Bahnhof Berlin-Zoologischer Garten 03.jpg](https://commons.wikimedia.org/wiki/File:2021-07-19_Bahnhof_Berlin-Zoologischer_Garten_03.jpg) | Geoprofi Lars, CC BY-SA 4.0 | Opaque roof underside, ribs, curved rails, platform edges |
| [Bahnhof Berlin Zoologischer Garten - interior.jpg](https://commons.wikimedia.org/wiki/File:Bahnhof_Berlin_Zoologischer_Garten_-_interior.jpg) | Sylwia Botev / Fundacja Nomos, CC BY 3.0 PL | Current glass access, dark blue signs and concourse fixtures |

No photograph, protected plan, photographic crop, font or image texture is
bundled. The per-file attribution additions are mirrored by release integration.

## Runtime, navigation and validation

The drawn model is three submissions: measured opaque surfaces; measured glass
surfaces; one instanced batch for facade members, roof ribs, rails, sleepers,
stairs and recognition details. Minecraft is two independent instanced batches
for orthogonal opaque blocks and transparent blocks. It has surface shells,
not hidden solid interiors. All transforms are frozen once after construction.

The exact 21-part navigation replacement keeps source IDs and native/drawn roof
sampling. A height-aware floor callback distinguishes public concourse, mapped
stairs and elevated platforms. Actual narrow upright members remain solid.
A named building outside the station cannot become an open passage simply
because it is near the station.

Focused validation covers exact projected coverage of every source roof/wall,
all three full mapped platform polygons, six track identities, source-specific
ownership, finite surface-only native geometry, full/mobile parity, frozen
transforms, translucency/depth-write settings, and compiled navigation through
the approaches, platforms and stairs. Browser QA belongs to release integration.

Reproduction:

```sh
uv run python scripts/build_zoo_station_v165.py
uv run pytest -q tests/test_zoo_station_v165.py
cd src/app
bun test tests/zoo-station-v165.test.ts tests/zoo-station-v165-navigation.test.ts
```

Useful cameras (world metres; `[camera]` → `[target]`):

- Hardenbergplatz: `[-2572,46,1354]` → `[-2673,18,1242]`.
- Regional hall: `[-2660,17,1208]` → `[-2681,18,1247]`.
- S-Bahn hall: `[-2810,29,1379]` → `[-2742,17,1294]`.
- Amerika Haus: `[-2778,21,1255]` → `[-2816,10,1305]`.

Final isolated attribute budgets (including indices, excluding driver/material
bookkeeping): drawn 900,296 bytes / 9,416 instances / 3 submissions; native
5,073,080 bytes / 66,734 blocks / 2 submissions. Both profiles retain the same
full static detail. The seven focused Bun tests pass with 11,088 assertions;
four source-coverage Python tests, Ruff and TypeScript checks pass. These are
component checks, not physical-device memory measurements.

Street-level QA corrected the Amerika Haus facade's horizontal orientation so
the entrance lettering and mosaic read from Hardenbergstrasse. Glazing is limited
to the street-facing source planes, with opaque ends/rear, a bounded spandrel and
complete source-footprint interior floors; floor elevations are display estimates.
