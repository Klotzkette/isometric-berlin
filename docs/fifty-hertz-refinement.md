# 50Hertz and EINZ source corrections — step 10, v1.0.9

The 50Hertz complex now has separate thirteen- and seven-storey wings,
continuous projecting floor frames, irregular single-storey diagonal supports,
fine glazing, recessed loggia readings and restrained orange core glimpses.
The previous two-sided repeated X grid covered only the tall part. Its source
parts and measured heights remain in `fiftyHertzSource.json`; the obsolete
signature and corresponding coarse renderers are suppressed explicitly.

## Evidence and source conflicts

The [architect's account](https://www.kadawittfeldarchitektur.de/en/projekt/50hertz-netzquartier/)
identifies LOVE's design, collaboration with kadawittfeldarchitektur and the
three characteristic elements: floor plates, external supports and orange
circulation cores. The diagonal pattern is intentionally incomplete. These
features inform procedural recognition geometry; individual brace positions,
loggias and facade openings are not surveyed.

Five original LoD2 parts under parent `DEBE00YY1AT000Ab` are retained from
the [official source tile](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5821.zip),
dated 2 March 2026. The main tower's 54.975 m measured height and exact
footprints stay authoritative. Its and the western wing's simplified pitched
roof envelopes conflict with the flat projecting roof plates visible in the
June 2026 photographs. The display subdivides these two envelopes into flat
plates and compact screened service housings, inside the same maximum height.
Housing dimensions are visual estimates. Original roof planes remain in the
source file, while displayed roof sampling also controls physical collision.

The [50Hertz announcement](https://www.50hertz.com/Portals/1/Dokumente/Medien/Pressemitteilungen/2024/20240417_Pressemitteilung_50Hertz_feiert_Richtfest_in_Europacity.pdf)
documents seven floors at Heidestraße 4, with the same external structure.
[Züblin's completion account](https://www.zueblin.de/de/projekte/50hertz)
confirms the extension's 2025 completion. Current OSM way `1224022429`
provides its footprint and seven-floor count. This footprint is already
present in the shipped source as prism `24022429`, but with the older default
21 m height. The replacement retains that record separately as
`extension_source`; the new 31 m display height is an explicit visual estimate,
not a newly measured LoD2 height. Both outline versions coincide exactly.

The old EINZ/KPMG podium overlay was centred at world Z = −926.346 m, about
40 m away from its actual source centroid at −966.437 m. Its rectangular
glass mass also obscured the real multi-part composition. It is removed in
both smooth and Minecraft views. `EuropacityArchitecture` adds facades to the
retained podium parts, while the existing 84 m tower, signs and entrance stay
at their source anchor. The four-to-six-storey podium composition is supported
by [CA Immo's completion record](https://www.caimmo.com/de/presse/news/artikel/ca-immo-stellt-hochhaus-am-europaplatz-in-berlin-fertig/).

## Inspected free photographs

Both photographs are by **Roy Zuo**, **CC BY-SA 4.0**, taken 14 June 2026.
They were actually inspected and remain external references, never bundled
images or runtime textures:

- [(20260614 102704276 HDR) Berlin Sunday morning.jpg](https://commons.wikimedia.org/wiki/File:%2820260614_102704276_HDR%29_Berlin_Sunday_morning.jpg)
- [(20260614 102848821 HDR) Berlin Sunday morning.jpg](https://commons.wikimedia.org/wiki/File:%2820260614_102848821_HDR%29_Berlin_Sunday_morning.jpg)

They show the projecting flat plates, white supports, fine glazed faces and
the complex's stepped silhouette. Photos from other dates that could not be
retrieved were not used. The central attribution manifests mirror these two
records alongside the independently inspected cemetery and corridor sources.

## Rendering and verification

Both factories are static, instanced and texture-free. Minecraft uses its own
stepped diagonal blocks, wall strips and roof blocks in full/mobile profiles.
Only matching source columns are replaced; adjacent buildings retain their
original columns. The extension has matching solid collision, while adjoining
streets and open approaches remain free. Day, Night and Schwellenraum use the
existing material transition contract.

Actual Three.js triangles and instance matrices were exported and rendered
orthographically for both sides and Minecraft. These are geometry inspections,
not browser screenshots. Source ownership and facade rays are covered by the
focused 50Hertz tests. The release also runs TypeScript, the frontend suite,
Python checks, production build, static-package readiness and package smoke
checks. Direct browser and phone inspection was unavailable while the host
Mac was locked.
