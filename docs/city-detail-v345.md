# Berlin detail pass: station quarters, venues, airports and paths

The v1.0.225 viewer retains the complete existing city, all six styles, the
93-stop tour and the same full detail on desktop and mobile. This pass adds
finite, source-bound corrections rather than claiming that all Berlin buildings
have been photographically surveyed.

| Area | Actual correction | Evidence and limits |
| --- | --- | --- |
| Northern S1 and western Ring neighborhoods | 81 residential street elevations in 28 groups; four further elevations beside Nordbahnhof | Individual source walls and mapped storeys; window widths and joinery are estimates. [Full street list](wedding-ring-west-v345.md) |
| Neukölln Arcaden, Hermannplatz, Richardplatz and original Estrel Hotel | Glazing divisions, reveals, metalwork and Schmiede shutters fitted to the existing source members | Original full source bodies retained. [Photos and credits](neukoelln-facade-v345.md) |
| Estrel Tower and SO36 | Current mapped 176 m tower and podium footprints, sloping roof; SO36 portal, lightbox and poster frames on its exact source facade | Current OpenStreetMap parts, Barkow Leibinger/Nils Könning and visitBerlin/Prokura Nepp; exterior detail is interpreted from references. [Source notes](neukoelln-facade-v345.md), [exact old-proxy replacement](estrel-ownership-v345.md) |
| Tegel and Tempelhof terminals | 263 existing facade fields with more precise material subdivisions | No future terminal reconstruction represented as complete. [Airport audit](airports-field-v345.md) |
| Western Tempelhofer Feld | 38,176 m² of existing grass receives measured relative relief | Local height datum and 24 m seam transition; walking and both rendering families agree. [Terrain method](airports-field-v345.md) |
| Großer Tiergarten | 13,854 m² of existing paths no longer hidden under coarse ground | Actual source courses/heights and complete outside ground retained. [Path proof](tiergarten-paths-v345.md) |
| Chancellery streets | Stabilized near-coplanar surveyed road edges | Existing verified route, paving and curbs unchanged; no invented rerouting. [Street audit](tiergarten-paths-v345.md) |

Karl-Marx-Allee, the complete Richardplatz/Schudomastraße bodies, Hasenheide,
Huxleys, the existing Tempelhof entrance and Columbiahalle were checked against
their existing source models and relevant references. Existing correct detail
remains. This is not a claim that all of these places received new geometry.

**Still open in this pass:** no new two-family supported facade was admitted at
Humboldthain, the Wollankstraße transition or the Hellweg corner. The extra
[Huxleys entrance canopy](huxleys-entrance-v345-audit.md) also remains unplaced
until its actual host is known. Their prior
representations are preserved. Hellweg is provisionally understood as
Ellen-Epstein-Straße 1; the current operator page still displays that name.

No city packets are removed, downsampled or fetched from a GitHub source mirror.
All existing public packet URLs remain on the viewer's own origin. New source
recipes use the existing lossless compression and bounded packet lifetimes;
no startup, Worker, decode, vertex, residency or GPU cap is raised. Source
images remain external reference evidence and are never bundled as textures.

The measured full offline folder contains **1,193,314,546 bytes**, an increase
of **5,072,396 bytes** over v1.0.224. Only its finite offline ceiling moves
to the next whole MiB (1,139 MiB). The unchanged 400 KiB startup and 16 MiB
Worker guards pass the production build; the actual Worker is 15,126,561 bytes.
Every one of the 5,812 public city packet files remains byte-identical.
