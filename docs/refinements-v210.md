# Landmarks and four street corridors — v1.0.110 / Step 10

This release refines the requested landmarks and street corridors inside
previously approved coverage. It adds no district footprint or tour stop:
the 93-place catalogue, existing source inventories and city residency
limits remain unchanged. The preservation baseline is v1.0.109, commit
`b2f70b7d7def147b0b1189667bce19fe6f04af3f`.

## Bounded scope

| Family | Added recognition | Boundary of the interpretation |
| --- | --- | --- |
| [Westend and DRV](west-civic-v210.md) | Seven-tier blue glass obelisk with mapped Theodor-Heuss-Platz park, paths, surrounding roads and trees; rbb television wings, broadcast crown and antenna; source-bound Haus des Rundfunks and DRV facade articulation | Plaza context is clipped to the exact mapped square plus 8 m. The obelisk is distinct from the eternal-flame memorial. The television centre is distinct from Poelzig's radio building. DRV means Ruhrstraße 2, not another pension-insurance office. |
| [Wedding sites](wedding-sites-v210.md) | Erika-Heß-Eisstadion upper hall and five exterior suspension supports; source-clipped Bayer/former Schering facade courses, tower glazing and mapped perimeter openings | The mapped works boundary defines the campus. No planned Nordhafen buildings or roof over the open rink are inferred. All existing core bodies remain. |
| [Richardplatz and Hermannplatz](neukoelln-places-v210.md) | Complete measured Karstadt/Galeria, church and forge envelopes; facade detail, an estimated church belfry, mapped benches/bins/bicycle stands and a simplified Tanzendes Paar | Karstadt uses its extant postwar building and surviving Hasenheide section. Neither the destroyed twin towers nor proposed redevelopment is reconstructed. The separate garage and open forge canopy remain. |
| [Four street corridors](boulevard-transport-v210.md) | Positively source-tagged paint along Kurfürstendamm, Friedrichstraße, Karl-Marx-Allee and Karl-Marx-Straße; missing curbs on the latter two corridors | Finite scope follows retained streets within earlier coverage. Existing curb/pavement layers and v206 markings remain; their overlapping paint scope is excluded. Unknown crossings do not become zebras. |

Street markings use the retained, dated OSM snapshot. Lane widths, dash phases,
hatch spacing and curb sections are display estimates. Curbs follow the union
of delivered asphalt surfaces, with open junctions and no transverse curb at
an artificial corridor, core or tile boundary. The final addition has 3,266 paint strips and 9,537 drawn curb segments.
Native curbs retain 84,983 quarter-metre pixels in 27,163 exact merged runs.
The combined corridor buffers measure 855,888 bytes drawn and 1,332,608 bytes
native, with 36 bounded draw calls each. Inner junctions are cleared; native
pixels are checked against the original building and water footprints.

The final Theodor-Heuss-Platz context fills a documented omission in the older
west-lobe ground model. Its mask is mapped square `way/377196797` plus 8 m,
wholly inside existing coverage. It includes park `way/9873833`, mapped paths,
the surrounding street ring, grass/flower-bed areas and **55 mapped OSM trees**.
Complete selected source features and the exact clipping audit remain in
[the place source receipt](../geo_data/regierungsviertel/west-civic-place-v210-source.json)
and [place evidence](../geo_data/regierungsviertel/west-civic-place-v210-evidence.json).
Only derived display geometry is clipped; old packets and ground remain intact.
Tree crowns and missing road widths are recorded display estimates. No new
crossings, traffic signs or buildings are inferred.

## Evidence and interpretation

Complete official LoD2 parents, their rings, holes and wall/roof sheets anchor
the buildings. Bounded official DOP and bDOM evidence resolves the rbb and
stadium height conflicts while keeping the older source geometry. Interpreted
roof partitions are clipped to their source footprints; they are not newly
surveyed building-part boundaries. The site documents above record the
vertical datums and retained sample receipts.

Official operator, district and heritage accounts establish identity and
architectural context. Freely licensed Commons photographs supply dated
visual cues, with per-file authors, licences, URLs and inspected-reference
hashes retained in the linked credit receipts. Opening rhythms, colours,
small member dimensions, sculpture abstraction and the church belfry are
explicit presentation estimates. In particular, dated facade photographs do
not establish an exhaustive 2026 condition survey. Reference photographs and
orthophotos are not bundled as viewer textures.

## Construction and preservation

The new scene has four optional detail families and three required envelope
factories. Required rbb/obelisk, stadium and Neukölln geometry is attached to
the provisional city before that city is published and its matching old
proxies can be suppressed. Each construction step attaches its allocation
before yielding; cancellation disposes the provisional world. Optional
facades and furniture do not own the replacement shells.

Only the documented seven Neukölln proxy owners, ten old obelisk box rows,
100 old rbb wire rows and one obsolete church cornice height are corrected.
The exact receipts, guarded navigation transfer and independent historical
comparison are described in [Geometry preservation](geometry-preservation-v210.md).
Other old geometry remains part of the preservation audit.

Drawn mobile and desktop use the same detail inventory. Minecraft receives
independently generated orthogonal geometry, including hollow shell skins
and short facade runs; it does not layer a smooth duplicate onto the native
model. Navigation follows the added solids, complete roofs and mapped gate
gaps without closing whole plazas or campus courts. Constructors allocate
final-sized, texture-free buffers. Large constructor-only JSON arrays use
the existing lossless lazy mechanism while small navigation metadata remains
available. No city residency or quality budget is raised or reduced.

## Verification

- Production TypeScript/build and full Ruff formatting/lint pass (514 Python files).
- The full Python run exercised 1,268 tests: 1,263 passed, four skipped, and one
  assertion still saw the old v1.0.109 download manifest. After packaging v1.0.110,
  all 76 release-readiness tests pass and release readiness reports OK. Final
  street-generator checks pass separately (11 tests); the four v206 default
  outputs remain byte-identical. The final Westend source checks pass all six
  Python tests, including the added plaza context.
- The complete frontend run exercised 3,277 tests. Its three failures were stale
  assumptions: two compared the just-corrected v210 street buffers with the earlier
  v210 snapshot; the third expected untouched Ringbahn navigation despite the seven
  exact Neukölln proxy transfers. The updated current snapshot and independently
  receipt-checked packet expectations pass. After the final plaza addition,
  the focused rerun passed **29 Bun tests across nine files, with 957,041
  assertions**. Historical geometry fixtures remain unchanged. The complete-suite
  counts describe the earlier runs; final changes were verified by these focused
  reruns and the release-readiness checks.
- All 150 Ringbahn packets in both modes retain every mesh position and every
  unrelated index, line vertex and navigation record. Each permitted exception is
  independently bound to the old packet SHA-256 and exact transfer receipt.
- Chrome and automated WebKit with the iPhone 13 profile each passed 28 integrated
  views across all six modes without JavaScript errors or WebGL context loss.
  Required replacement shells were present at presentation; all optional families
  loaded. Named views were captured for visual inspection, including independent
  Minecraft curbs, the rbb crown, hall supports and contemporary Karstadt.
- The final Theodor-Heuss-Platz addition then passed a separate Chrome check in
  all six modes without errors. The corresponding final WebKit check passed
  all six modes with presentation ready and no errors or context loss. The
  inspected day screenshot shows the paths, park, street ring and obelisk.
- The complete extracted local package is **873,298,912 bytes (832.842743 MiB)**,
  below the unchanged **833 MiB** archive ceiling. Both archives and the local
  launchers pass release readiness. The local package uses independent APFS
  copy-on-write file copies to avoid a redundant disk allocation; archive content
  and packaging metadata follow the standard packager.

No runtime residency limit changed. An automated WebKit phone profile is not a
physical iPhone memory/GPU test and cannot guarantee crash-free operation on
all devices. Window rhythms, small dimensions and source-interpreted roof
partitions retain the explicit limitations in the site documentation.
