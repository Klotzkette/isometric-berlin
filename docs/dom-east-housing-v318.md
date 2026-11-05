# DDR housing east of the Berliner Dom

The owner's unnamed DDR block near Hackescher Markt is interpreted as the
Karl-Liebknecht-Straße residential complex. It is a different building from
the modern, rounded Hackesches Quartier at Henriette-Herz-Platz 3 refined in
v315, and from the DomAquarée hotel/body retained by v288. This finite addition
targets the long residential bar at 9–11/13; 13 also identifies its public podium,
and is not treated as an invented independent residential tower. The related
Karl-Liebknecht-Straße 7/Spandauer Straße 2 buildings remain in their existing owners.

The exact retained official family is `DEBE01YYK00001GQ`, with 99 original
sheets. The new members occupy only two measured long wall sheets:
`UUID_3a756061-0c17-4356-8809-4dcf22e2eb85` and
`UUID_2128114d-cd5a-4734-818f-54e86ab8b54c`. Its complete podium, terraces,
roof, source windows, earlier details, source packets and navigation are
unchanged. No automatic retirement, court filling or new traversable opening occurs.

Peter Meyer's architectural account for MGHS in
[Henselmann 1/2017, page 8](https://www.rosalux.de/fileadmin/rls_uploads/pdfs/sonst_publikationen/Henselmann_1-2017.pdf)
provides the original 1967 elevation and describes the contrasting open/glazed
loggias and the public three-level podium. The
[current nGbK location page](https://ngbk.de/de/besuch/ngbk-alexanderplatz)
identifies 11/13 and includes a
[December 2023 photograph by Thomas Bruns](https://ngbk.de/media/pages/media/4730f04c5f-1706177151/2312_ngbk-228_thomas_bruns-500x-q80.webp)
showing the pale horizontal bands, contrasting loggia glazing and retained
public base. These establish the architectural programme; exact bay/storey
spacing, shallow recess appearance, member sections and colours are bounded
display estimates. No copyrighted reference pixels are bundled or rendered.
The [May 2026 Commons photograph metadata](https://commons.wikimedia.org/wiki/File:Liebknechtriegel2026.jpg)
corroborates the block's identity/viewpoint; its image was unavailable, so it
is not claimed as inspected current facade evidence.

Mapped identity comes from retained OSM ways
[234463917](https://www.openstreetmap.org/way/234463917) and
[234973637](https://www.openstreetmap.org/way/234973637), ODbL 1.0. Metric planes
are from Berlin's retained official LoD2 family, Datenlizenz Deutschland –
Zero 2.0, EPSG:25833 (`x=easting−389500`, `z=5820000−northing`, metres).
Drawn support is checked against the actual delivered v169 source triangles.
Native fittings are independently fitted to complete actual cardinal faces;
unsupported candidates are omitted rather than moved through another facade.

`createDomEastHousingV318(native=false)` returns one static instanced batch:
2773 Drawn or 8165 Native members. Both families retain full detail on touch
devices and use no textures, animation loop, navigation override or extra
resident budget. Repeated vertical profiles are factored, and the existing
lossless UInt32 word-plane codec preserves every authored Float32 fitting word.
The runtime recipe is 8255 bytes. An isolated minified browser build with Three
external is 12.50 kB, including its existing decoder and batch helpers.

Reproduce with `uv run --no-sync python -m scripts.build_dom_east_housing_v318`.
The retained compressed evidence records the complete official family, every
input fingerprint, supporting sheets and all 8165 native fits. Focused Python
checks validate actual support and word identity; Bun checks catalogue identity,
independent cardinal instances, finite buffers and fresh material lifetimes.
