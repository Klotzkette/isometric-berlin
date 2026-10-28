# BMF forecourt and gate — v281 / Step 10

The complete 21-part Detlev-Rohwedder-Haus source, all roofs, courtyard holes,
facade/windows, roof lanterns and the OSM entrance-fence axis remain unchanged.
The new gate fittings retain the old dark members and add narrow warm metallic
edges and small lower medallions. They follow Magnus Manske's credited
`Federal Ministry of Finance.jpg` reference; they are not a claim that the whole
fence is gold. All new native fittings are cardinal.

## 17 June 1953 memorial

Exact current OSM ways47161406 and48118825 (relation21599401, fetched28October2026)
provide the full five-vertex plaza and four-vertex memorial perimeter, with
original closure vertices. The source ledger records versions, hashes and the
retained central ground-height crop. The thin paving/glass finish follows this
unchanged ground field; walking uses the same heights and native cells.

The BBR's Museum der1000Orte identifies Wolfgang Rüppel and Ute Pieroth,2000,
laminated glass and the historical photograph. Its text says25×3m and metadata
approximately25×4m. The mapped ring is used without forcing either width.
OSM's water/pond tag is a documented conflict: this is a glazed ground artwork,
not an invented fountain. The previous unrelated small generic sculpture marker
is omitted only for the complete exact old identity (way48118825,x_dm8204,
z_dm10344,w_dm250,d_dm106,subtype and full name); its protected source key is
recorded as externally modelled. The replacement preserves memorial protection.

The new drawing uses stone edging, glazing divisions and abstract tonal figure
marks. It does **not** reproduce the historic photograph, its people, exact
inscriptions or the Max Lingner mural. Paving joints, etched-image abstraction,
border height and all tiny fittings are explicit display estimates. No photo
pixels, external image files or textures are bundled. Existing public routes
and unmodified source heights are retained.

Primary reference:
https://www.museum-der-1000-orte.de/kunstwerke/kunstwerk/denkmal-zur-erinnerung-an-den-aufstand-des-17-juni-1953

Visual reference: Cordia Schlegelmilch2015 / BBR, artwork©Wolfgang Rüppel;
building reference Cordia Schlegelmilch2016 / BBR. Reference only, no image
redistribution. Existing Magnus Manske and other BMF credits remain applicable.

## Verification

Twenty focused BMF/integration tests pass, including all21 unchanged source
parts, real source roofs, outward glazing visibility, finite fence collision,
correct native ground matching and upward-facing new surfaces. New drawn
forecourt buffers791100B; native273716B/3593instances, one batch each. Full
mobile recipe is identical. Additional checks/publication are recorded in the
release-level document only when completed.

## Independent ground and ownership review

The old marker's complete identity was checked against the actual protected
street-detail record. Its external-model metadata remains recorded. Both city
transactions call `addRequiredSiteEnvelopesV209Steps`, so the new drawn and
native forecourts each belong to their respective world. Both descendants
resolve to ordinary Day in Schwellenraum through the root protection flag.

The review found four native paving cells below existing asphalt runs (up to
0.17447m at x812.5/z1044.5). The runtime packet now retains twelve bounded
original run-height records; the source ledger includes their original grid
offsets, lengths, classes, sampling rule and payload SHA-256. Each native top
is the maximum of the new finish and the untouched old run top plus 0.005m
clearance. Geometry and navigation use this same value. No old source is cut,
lowered or removed. Instance count and geometry bytes remain unchanged.

The original drawn road polygons were checked separately. Only the asphalt
union crosses the plaza edge; the old smooth paving does not cover the glass
interior. The original asphalt triangulation and terrain drape produced four
nearby triangles; 404 intersection probes left at least 0.06977m clearance
below the new finish, so no extra drawn lift was required.

The review also found 32/80 inner-edge probes where drawn walking classified
the query point while its visible triangle classified the cell centre. This
caused 0.095–0.145m mismatches. Both now use the renderer's cell-centre finish
classification, with the continuous source ground preserved. The focused
`bun test tests/bmf-forecourt-v281.test.ts` run passes **5 tests**, including
independent replay of all twelve original ground obstacles, actual native
rays over the old ground, all 80 drawn inner-edge rays and both protected-mode
dispatches. No full factory, build or complete suite was run for this review.
