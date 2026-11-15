# Berlin pharmacy inventory — V350

The public pharmacy inventory accounts for **all 666 Berlin entries returned by
the Apothekerkammer Berlin public finder on 15 November 2026**. This is coverage
of that directory, not a guarantee that every pharmacy in Berlin is currently
open, nor a census of non-public hospital dispensaries.

## Sources and reconciliation

- [Geoportal Berlin pharmacy WFS](https://daten.berlin.de/datensaetze/apothekenstandorte-wfs-58e80465):
  702 official public-pharmacy location points, stable identifiers, names and
  addresses; DL-DE-Zero 2.0. The catalogue says 3 July 2024; the WFS retrieval
  timestamp is not evidence that every business record was refreshed then.
- [Apothekerkammer Berlin public finder](https://www.akberlin.de/patientinnen/apothekenfinder):
  666 named Berlin entries across 14 pages, acquired with at most two concurrent
  requests. Only public facility names, addresses and district keys are retained;
  telephone numbers, contact persons and emergency-duty schedules are excluded.
- The retained 13 November 2026 Berlin OpenStreetMap extract supplies additional
  mapped pharmacy identities and coordinates under ODbL 1.0. No new PBF download
  was needed. Only public location/name/address and level/indoor facts are copied
  into the small pharmacy snapshot.

The final inventory has **649 official location points and 17 mapped pharmacy
points**, zero unresolved directory entries and unique stable location IDs.
All points are checked against the official Berlin state boundary. The 53 older
official points not selected by the current-directory reconciliation remain in
the audit; their absence from the current match is not asserted as proof of
closure. They are not silently presented as current pharmacies.

Most matches require a unique full street/house/postcode address. A named
pharmacy's stated address range can contain its official single house number;
street abbreviations are normalized while house suffixes, ranges and postcodes
remain significant. Ambiguity fails closed. Sixteen remaining records have an
individual, exact-source review in `pharmacies-v350-address-review.json`, including
corner addresses, street abbreviations, number ranges and these differences:

- Atlas-Apotheke's [own imprint](https://www.atlas-apotheke-berlin.de/impressum/)
  confirms Falkenseer Chaussee **23**, agreeing with WFS and OSM; the chamber
  finder lists 21–22. The conflict and preferred primary address are recorded.
- Birken-Apotheke Karow's [2026 employer posting on the chamber site](https://www.akberlin.de/fuer-mitglieder/stellenmarkt/stellenangebote/detail/inseratdetail/3820/beruf-alle/bezirk-Pankow/seite-1)
  confirms Bahnhofstraße **17A**, agreeing with WFS and OSM; the finder omits A.
  Only the facility/address fact is used; no employment/contact data is stored.
- Apotheke zum Stift uses the mapped Mariendorfer Damm **189A** location matching
  its current finder address, rather than the older WFS Hundsteinweg point.
- Sky Apotheke Kreuzberg retains the mapped **level 1** evidence. It must not
  become a ground-floor storefront without matching source support.

Each individual exception pins the complete expected source location record.
A changed reviewed source is rejected, rather than silently applying the old
decision to new coordinates. No fuzzy name-only or nearest-building geocoding
is used to invent a missing location.

## Geometry integration boundary

`pharmacies-v350-inventory.json.gz` uses EPSG:25833 and the agreed shared
`{schemaVersion, crs, sources, records}` envelope. Each record supplies public
name, stable ID, coordinates, street, house number, postcode and evidence.
The `district` field is the source **Ortsteil** where available, not necessarily
one of the twelve Bezirke; empty values are deliberately not guessed.

Existing authored pharmacy detail is present at Hauptbahnhof; the general city
sources already contain many of the pharmacy hosts. This inventory does not
replace any building, facade, interior, terrain, road or navigation. It provides
identities for the root's conservative attachment pass. A location point is not
evidence of a specific entrance, storefront, window count, architectural colour
or pharmacy logo placement. Runtime recognition fittings must attach to a
verified existing host wall in both Drawn and independent Native, share that
host's lifetime, respect level/indoor information and avoid floating signs.
No operating hours, medical service, emergency-duty or accessibility claim is
introduced by this inventory.

## Reproduction and checks

`uv run python scripts/build_pharmacies_v350.py` rebuilds deterministically from
the retained snapshots without network access. `--fetch` explicitly refreshes
the two public directories; `--extract-osm` explicitly re-extracts the already
retained PBF. Address exceptions require review if their pinned facts change.

Six focused tests pass: address precision, complete current-directory coverage,
ambiguous-owner rejection, changed-review rejection, Berlin containment and
unverified-facade/entrance boundaries, plus exclusion of contact/duty fields.
Focused Ruff checks and formatting pass. Root owns runtime hosting, budgets,
source history, packaging and final publication.
