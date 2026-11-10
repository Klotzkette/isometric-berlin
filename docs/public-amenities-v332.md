# Public amenities in the retained Berlin model

The **Stadtorte in der Nähe / Nearby public places** control enables local name cards in the desktop toolbar and the mobile actions menu. It does not change the sightseeing tour. Existing buildings, playground models and landscaped basins remain in place. The viewer constructs only nearby amenities after the city is ready and releases their geometry as the view moves on.

| Place | Admitted location records within represented coverage |
| --- | ---: |
| Documented public playgrounds | 424 |
| Public toilets | 342 |
| Decorative fountains and water features | 174 |
| Splash pools | 17 |
| Drinking fountains | 175 |
| Outdoor swimming facilities and bathing beaches | 13 |
| Mailboxes | 1,256 |
| Kiosks | 408 |
| Explicitly mapped Spätis | 381 |
| Police stations and headquarters | 29 |

The location compiler uses the existing city polygon and streamed footprints. It excludes conditional or restricted OSM access and event-only or unresolved pilot toilet records. The public-police index uses the 37 official section-station points, the public headquarters address and three confirmed supplements. The Alexwache follows the actual mapped kiosk at Alexanderplatz instead of the separate administrative address point. The Kotti Wache and Hauptbahnhof police station remain in their existing hosts. The headquarters shares the official address at Platz der Luftbrücke 6 with the Landespolizeidirektion. [Police dataset](https://www.geoportal.de/info/e109ddbb-b121-36e3-8af6-d9f4eacb6d78) · [Official addresses](https://daten.berlin.de/datensaetze/adressen-berlin-wfs-634ab8ba)

The public GRIS source has 1,886 records, of which 1,795 are dedicated. This pass uses dedicated sites with previously modelled geometry, matched playground names or mapped equipment. It admits 514 candidate device locations after excluding confirmed existing model owners. The runtime requires the actual retained terrain and clear support. Equipment dimensions and orientation are illustrative. [Berlin GRIS](https://daten.berlin.de/datensaetze/grunanlagenbestand-berlin-einschliesslich-der-offentlichen-spielplatze-wfs-737fd0a4)

Measured OSM basin outlines, including holes, provide 80 bounded candidate shapes. The runtime admits a water surface only where the retained terrain supports its rim and there is no existing water owner at the anchor. The Drawn outline follows the mapped rim. Native uses complete cardinal cells inside the same outline. These surfaces represent the basin plan, with no assumed depth or new swimming or walking behavior. Previously authored named fountains retain their original forms. Drinking fountains use the known Kaiser, Bituma and Botsch forms with schematic small fittings. [Zierbrunnen](https://daten.berlin.de/datensaetze/zierbrunnen-wfs-30f65b64) · [Trinkwasserbrunnen](https://daten.berlin.de/datensaetze/trinkwasserbrunnen-wfs-47dba2c3) · [Berliner Bäder-Betriebe](https://daten.berlin.de/datensaetze/schwimmbader-der-berliner-bader-betriebe-wfs-2b934eb7) · [BWB fountain factsheet](https://www.bwb.de/de/assets/downloads/Factsheet_Brunnen.pdf)

Confirmed Deutsche Post and PIN street boxes and five stand-alone Berliner Toilette variants receive recognizable geometry when their source point has dry, unobstructed ground. The known models use estimated dimensions and orientation. Indoor facilities and unsupported kiosk or shop footprints remain location cards attached to the existing city. The Späti at Naunynstraße 76 receives its own texture-free fascia in both modes only when the exact retained facade packet is present. The lettering and narrow green trim are based on the operator's exterior photo, which is not distributed. [Berlin toilet dataset](https://daten.berlin.de/datensaetze/offentliche-toiletten-wfs-ad2c0c24) · [Berlin toilet profiles](https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/oeffentliche-toiletten/berliner-toiletten/) · [PIN mailboxes](https://pin-ag.de/versenden/post-abgeben) · [Späti operator](https://spati24.de/)

The retained OpenStreetMap extract is from 29 September 2026 under ODbL 1.0. Spätis need an explicit mapped identity, and the snapshot does not establish current business activity or opening hours. Berlin open datasets retain their individual licences. The generated spatial index contains the original source identities and metre-projected points. `python -m scripts.build_public_amenities_v332` compiles the normalized source snapshots and records their hashes. [OpenStreetMap licence](https://www.openstreetmap.org/copyright)
