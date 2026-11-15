# Fuel station operator evidence — V351

The retained `fuel-v351-operator-evidence.json.gz` contains a finite, source-time identity audit of public operator directories, retrieved on 15 November 2026. It adds no runtime network request, geometry, sign, price, contact information, image, opening-hours claim or facade inference.

223 directory-listed sites fall inside the retained official Berlin state boundary and have one-to-one identities in the fuel inventory. These are 50 Aral, 47 Shell, 38 entries from the Circle K directory, 29 star/ORLEN, 22 JET, 19 Sprint, 16 HEM, one Spreves and one SB Tank. Of the 292 OSM sites tagged active, 69 remain unconfirmed by this operator audit. A directory listing does not prove that a station is operating today, publicly accessible, or architecturally current. This is not an all-Berlin completeness claim.

The finite sources are:

- [Aral finder](https://tankstellenfinder.aral.de/): the public application ships `/api/v2/locations/within_bounds`. An enclosing Berlin rectangle returns no unresolved clusters. Only fuel-site brand entries inside the exact official boundary are retained; the bounding rectangle alone does not define Berlin.
- [Shell Berlin directory](https://find.shell.com/de/fuel/locations/berlin/de_DE): all cards are inspected, with 15 EV-only entries excluded. 47 fuel-site detail pages supply coordinates and postal addresses, including the separately classified hydrogen site.
- [JET Berlin directory](https://www.jet.de/tankstellen/berlin): all 22 `GasStation` JSON-LD objects.
- [star/ORLEN Berlin directory](https://standorte.star.de/berlin/berlin): 29 station cards and their detail coordinates; four charging entries and one store-only entry are excluded.
- [Circle K finder](https://www.circlek-deutschland.de/tankstellenfinder): the shipped locator application calls its public `/api/v4/pois` endpoint. A 45km query enclosing Berlin returns fewer than the requested 300-result limit. The exact state boundary selects 38 sites. The feed reverses the `city` and `zip` fields; postal codes are accepted only as five digits.
- [HEM finder](https://www.hem-tankstelle.de/lokale-tankstelle/berlin): the official page supplies the public Uberall widget identity. The `locations/all` endpoint has no pagination metadata; every returned coordinate is checked against the official boundary, yielding 16 Berlin sites.
- [Sprint/GO finder](https://go-sprint.de/tanken/tankstellenfinder.html): the shipped application calls `/api/v2/stations`. All 110 returned records are considered; 21 lie inside Berlin, of which 19 are Sprint, one Spreves, and one SB Tank. Their actual directory brands remain separate.

Every retained source has its URL and response SHA-256; Shell/star details additionally have their own SHA-256. Only sanitized facts are kept. The offline acquisition helper is retained in the task's `city-v351/build_operator_evidence.py`; no network acquisition runs as part of viewer startup.

Five Circle K identities match different OSM brand labels by exact normalized address plus distance under 50m: Elan at Storkower Straße 116, Tino-Schwierzina-Straße 37, Adlergestell 179 and Fürstenwalder Damm 418; Access at Reichsstraße 86. They are explicitly recorded as brand conflicts. Circle K's raw `CIRCLEK` and `REBRANDED_CIRCLEK` codes are operator metadata, not evidence that a particular visible canopy carries those logos. Existing livery must not be replaced from this evidence alone.

Two directory coordinates are notably displaced: Aral Messedamm 6 is about 139.5m from its mapped site, and Circle K/TotalEnergies Am Juliusturm is about 452.7m from its mapped site. Their exact operator ID/address establishes identity only; the geometry must remain on the mapped and independently supported footprint. Both records carry `directoryPointOffsetWarning`.

The Esso official finder returned HTTP 403. No bypass was attempted, and this audit does not claim Esso directory verification. Smaller operators, private, boat, LPG and hydrogen facilities also retain explicit unconfirmed outcomes where no current primary evidence was obtained.
