# Cattelan in the Neue Nationalgalerie — v1.0.117 / Step 10

The exhibition is a restrained, original vector interpretation of the owner's
nineteen photographs and short video. The [museum exhibition page](https://www.smb.museum/en/museums-institutions/neue-nationalgalerie/exhibitions/detail/maurizio-cattelan-night/)
identifies **Maurizio Cattelan. NIGHT**, 10 September 2026–7 March 2027.
Reference filenames and SHA-256 receipts are retained in
`geo_data/regierungsviertel/cattelan-v217-source.json`. Photographs, video,
external fonts and artwork textures are not bundled or downloaded at runtime.
Artwork credit is available in the viewer's existing sources dialog and NOTICE.

## Model and access

- Pink polygon blackletter **Cattelan** lettering faces Potsdamer Straße;
  smaller titles mark the street poster and the interior partition. The native
  Minecraft reading has its own block lettering.
- The small grey felt-suit figure hangs by its **jacket collar** from a chrome
  coat rack, with bowed head, hanging hands and bare feet. Four white marble
  shrouds have modelled folds; the metal tube has a visible interior and two open
  ends. The brown gate cabinet, suspended horse and tiny double-portrait bed
  complete the principal interior references.
- A seated drummer and pigeons occupy the roof edge. Pigeons also sit on the
  ceiling structure. Wood partitions, green marble cores, translucent curtain
  pleats, a fine ceiling grid and floor joints establish the room.
- The existing measured pavilion and eight source-owned building parts remain.
  Its 22 terrace steps and four ground-level glass openings are walkable.
  Navigation follows those steps and the exhibition floor; glass, columns,
  partitions and marble cores remain solid. The change is restricted to the
  museum's existing source identities and terrace polygon.

Exhibit placement, fine dimensions, poses and material colours are photo-informed
display estimates, not a measured installation plan or a complete catalogue of
every work. The glass pavilion remains intact in exterior views. The exhibition
is visible when entering its hall. Mode lighting and flood water retain their
existing behaviour.

Repeated furnishings and birds share instanced geometry. The exhibition adds no
per-frame simulation, point-light array or texture allocation. Touch and pointer
use the same drawn model; native Minecraft keeps a separate block interpretation.
No existing city geometry or source coverage is removed. The separate restrained
facade-colour changes are documented in [city-polish-v217.md](city-polish-v217.md).

## Verification

The focused exhibition, pavilion and navigation suites cover all six modes,
all 22 rendered stair treads, actual door-ray openings, retained source ownership,
world placement, material/buffer limits, texture absence, four folded sculptures,
an open tube and deterministic native geometry. These pass 19 tests with 290,686
assertions. The facade/source-colour suite passes another 31 tests.

The production viewer is checked in Chromium and mobile WebKit emulation, with
exterior and wardrobe views in all six modes. These checks do not substitute for
a physical-device endurance test. Release validation also checks the packaged
scene, launchers, asset completeness and published asset hashes.
