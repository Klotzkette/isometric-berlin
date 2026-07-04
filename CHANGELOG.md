# Changelog

## v0.1.40

- Add Venusbassin / Goldfischteich as an explicit Tiergarten landmark using
  Wikimedia/Wikidata/OSM metadata, and extend Wikimedia reference discovery for
  modern free-license pond imagery.
- Improve the deterministic source renderer with bounded tree, shrub, and
  water-ripple texture for OSM park and water polygons.
- Document the external no-copy geolocation QA pass across official pages and
  commercial map products.

## v0.1.39

- Add `package-manifest.json` to the downloadable local package with package
  version, preferred detail image, DZI descriptor, asset hashes, attribution,
  and Google-content status.
- Strengthen release readiness so README's direct download URL must match the
  current project version.
- Validate package manifests in both the unpacked local package and the ZIP,
  including referenced asset sizes and SHA-256 hashes.

## v0.1.38

- Export the Advanced Viewer DZI from the detailed source render instead of the
  pixel-art overview.
- Add denser facade/roof micro-detail and stronger landmark building signatures
  for the Regierungsviertel render path.
