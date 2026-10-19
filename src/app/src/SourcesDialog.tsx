import { Info, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Language } from "./localization";

export const ATTRIBUTION =
  "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia · Kindertransport visual references: © Pauline Ahrens, 2021 / Bildhauerei in Berlin (CC BY 4.0)";

/** Open only on request; the native dialog supplies focus trapping and Escape. */
export function SourcesDialog({ language, onClose }: {
  language: Language;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const title = language === "de" ? "Quellen & Lizenzen" : "Sources & licenses";
  const closeLabel = language === "de" ? "Quellen schließen" : "Close sources";
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={dialogRef} className="sources-dialog" aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <header className="reference-header">
        <div className="reference-title"><Info size={18} aria-hidden="true" /><strong>{title}</strong></div>
        <button type="button" autoFocus aria-label={closeLabel} title={closeLabel} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="sources-content">
        <p className="sources-attribution">{ATTRIBUTION}</p>
        <p>{language === "de"
          ? "Zusätzliche Zebrastreifen und Bordsteine folgen belegten OpenStreetMap-Verläufen auf vorhandenen Straßenflächen. Die Danziger Straßenbahngleise und die Haltestelle Husemannstraße folgen den kartierten Achsen; kleine Ausstattungsmaße sind angenähert. Der stehende gelbe Wagen deutet eine siebenteilige, 40 Meter lange Flexity an. Linien- und Fahrzeugangaben: "
          : "Additional zebra crossings and kerbs follow evidenced OpenStreetMap courses on existing road surfaces. Danziger tram rails and Husemannstraße stops follow mapped axes; small fitting dimensions are estimates. The stationary yellow tram suggests a seven-section, 40-metre Flexity. Route and vehicle references: "}
          <a href="https://www.bvg.de/de/verbindungen/linienuebersicht/m10" target="_blank" rel="noreferrer">BVG M10</a>
          {" · "}<a href="https://unternehmen.bvg.de/wp-content/uploads/2023/04/BVG_PLUSNAVI_0123_barrierefrei.pdf" target="_blank" rel="noreferrer">BVG PLUS 01/2023</a>
          {" · "}<a href="https://trampicturebook.de/tram/download/bombadier/Flexity-Berlin.pdf" target="_blank" rel="noreferrer">Bombardier Flexity Berlin (2008)</a>.
        </p>
        <p>{language === "de"
          ? "Brunnen Hermann-Ehlers-Platz: kartierter Umriss und Werkbeschreibung von Bildhauerei in Berlin. Albrechtstraße 131: amtliche Gebäudeform, Denkmaldatenbank und Fassadenfoto. Kleine Detailmaße und Farben sind angenähert; keine Fototexturen. Fassadenfoto: "
          : "Hermann-Ehlers-Platz fountain: mapped outline and Bildhauerei in Berlin catalogue. Albrechtstraße 131: official building geometry, heritage record and facade photograph. Small dimensions and colours are approximate; no photo textures. Facade photograph: "}
          <a href="https://commons.wikimedia.org/wiki/File:130420-Steglitz-Albrechtstra%C3%9Fe-131-Ehlers-Platz.JPG" target="_blank" rel="noreferrer">Muns, 2013</a>
          {" · "}<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>.
        </p>
        <p>{language === "de"
          ? "Hermann-Ehlers-Platz und Straßenanschlüsse am Rathaus Steglitz: kartierte Platzgrenzen, Aussparungen, Fahrbahnbreiten, Radstreifen und Bordkanten aus OpenStreetMap. Kleine Höhen und Materialfarben sind angenähert. Geplante Platzumbauten werden nicht als Bestand dargestellt."
          : "Hermann-Ehlers-Platz and Rathaus Steglitz road connections: mapped square boundaries, openings, carriageway widths, cycle lanes and kerbs from OpenStreetMap. Small heights and material colours are estimates. Proposed square redesigns are not represented as existing works."}</p>
        <p>{language === "de"
          ? "Nordische Botschaften, Konrad-Adenauer-Stiftung, Parteizentralen, Rosa-Luxemburg-Stiftung, Robert-Koch-Denkmal, Steglitz und Kulturforum: vorhandene Gebäudedaten, amtliches Geländemodell sowie Architektur- und Bildquellen der unten verlinkten Nachweise. Kleine Fassaden-, Denkmal- und Straßenmaße bleiben angenähert; die SPD-Gebäudehöhe bleibt eine Darstellungsschätzung. Keine Referenzbilder oder Fototexturen werden mitgeliefert."
          : "Nordic Embassies, Konrad-Adenauer-Stiftung, party headquarters, Rosa-Luxemburg-Stiftung, Robert Koch memorial, Steglitz and Kulturforum: retained building data, official terrain data and the architectural and visual sources credited below. Small facade, memorial and street dimensions remain approximate; the SPD building height remains a display estimate. No reference images or photo textures are bundled."}</p>
        <p>{language === "de"
          ? "Torstraße 138 und Danziger Straße 57: erhaltene amtliche Gebäudeformen, Berliner Denkmaldatenbank und fotografische Fassadenvorlagen. Kleine Detailmaße und Farbtöne bleiben angenähert; keine Fototexturen. Danziger-Foto: "
          : "Torstraße 138 and Danziger Straße 57: retained official building geometry, Berlin heritage records and photographic facade references. Small dimensions and colours remain approximate; no photo textures. Danziger photograph: "}
          <a href="https://commons.wikimedia.org/wiki/File:Danziger_Stra%C3%9Fe_57_(Berlin-Prenzlauer_Berg).jpg" target="_blank" rel="noreferrer">Bodo Kubrak, 2016</a>
          {" · "}<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.
        </p>
        <p>{language === "de"
          ? "Krankenhäuser, Schulen, Sophienkirche, Otto-Weidt-Werkstatt und Rosenthaler Platz: vorhandene amtliche Gebäudeformen, OpenStreetMap und öffentliche Angaben der Einrichtungen. Fassadendetails und nicht vermessene Höhen bleiben angenähert. Die vier U8-Treppen folgen kartierten Verläufen und Stufenzahlen; Breiten und Tiefen sind geschätzt."
          : "Hospitals, schools, Sophienkirche, Otto Weidt's workshop and Rosenthaler Platz: retained official building geometry, OpenStreetMap and public institutional records. Facade details and unsurveyed heights remain approximate. The four U8 stairs follow mapped courses and step counts; widths and depths are estimates."}</p>
        <p>{language === "de"
          ? "Rathäuser der 23 früheren Bezirke und die heutigen zwölf Hauptsitze: amtliche Berliner Gebäude- und Denkmalquellen sowie OpenStreetMap. Nicht vermessene Höhen und Fassadendetails bleiben vereinfachte Annäherungen."
          : "Town halls of the 23 former boroughs and today's twelve main seats: official Berlin building and heritage records and OpenStreetMap. Unsurveyed heights and facade details remain simplified estimates."}</p>
        <p>{language === "de"
          ? "Wohnhäuser, Uber Arena und S-Bahnhof Warschauer Straße: vorhandene amtliche Gebäudeformen und OpenStreetMap-Daten. Nicht vermessene Fassaden- und Tragwerksdetails sind vereinfachte Annäherungen; keine Fototexturen."
          : "District houses, Uber Arena and Warschauer Straße S-Bahn station: retained official building geometry and OpenStreetMap data. Unsurveyed facade and structural details are simplified estimates; no photographic textures."}</p>
        <p>{language === "de"
          ? "Neue Nationalgalerie: Cattelan – NIGHT, nach bereitgestellten Fotos von Oktober 2026 vereinfacht dargestellt. Kunstwerke © Maurizio Cattelan. Anordnung und Proportionen sind angenähert."
          : "Neue Nationalgalerie: Cattelan – NIGHT, a simplified interpretation of supplied October 2026 photographs. Artworks © Maurizio Cattelan. Layout and proportions are approximate."}</p>
        <p>{language === "de"
          ? "Terrasse der Neuen Nationalgalerie: Alexander Calder, Têtes et Queue (1965), und Henry Moore, Bogenschütze (1964–1966). Vereinfachte Darstellung nach bereitgestellten Fotos an kartierten OpenStreetMap-Standorten; Formdetails und Ausrichtung sind angenähert."
          : "Neue Nationalgalerie terrace: Alexander Calder, Têtes et Queue (1965), and Henry Moore, Archer (1964–1966). Simplified interpretations of supplied photographs at mapped OpenStreetMap locations; shape details and orientation are approximate."}</p>
        <p>{language === "de"
          ? "Dünne graugrüne Linie: heutige Landesgrenze Berlins. Rote Linie: amtlich kartierter Verlauf der Grenzanlagen von 1989, einschließlich der belegten Unterwasserabschnitte; keine parzellengenaue Vermessung."
          : "Thin grey-green line: present Berlin state boundary. Red line: officially mapped 1989 border installations, including documented underwater sections; not a cadastral survey."}</p>
        <p>{language === "de"
          ? "Straßen im alten Mitte und Steglitzer A103: kartierte Wege, Gehwegbreiten, Markierungen und Ampelpunkte aus OpenStreetMap. Ampelphasen und nicht vermessene Detailmaße sind illustrative Darstellungen. Urania und Bogen: amtliche Gebäudedaten und bereitgestellte Referenzfotos; keine Fototexturen."
          : "Old Mitte streets and Steglitz A103: OpenStreetMap routes, pavement widths, markings and signal anchors. Signal phases and unsurveyed detail dimensions are illustrative. Urania and arc: official building data and supplied reference photographs; no photographic textures."}</p>
        <ul>
          <li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap · ODbL</a></li>
          <li><a href="https://www.govdata.de/dl-de/zero-2-0" target="_blank" rel="noreferrer">Geoportal Berlin · dl-de/zero-2-0</a></li>
          <li><a href="./dzi/regierungsviertel/wikimedia_attribution.json" target="_blank" rel="noreferrer">{language === "de" ? "Wikimedia: vollständige Bildnachweise" : "Wikimedia: full visual-reference credits"}</a></li>
          <li><a href="./dzi/regierungsviertel/visual_reference_attribution.json" target="_blank" rel="noreferrer">{language === "de" ? "Weitere Bildnachweise · Kindertransport" : "Other visual-reference credits · Kindertransport"}</a></li>
          <li><a href="https://github.com/Klotzkette/isometric-berlin/blob/main/NOTICE.md" target="_blank" rel="noreferrer">{language === "de" ? "Alle Quellen- und Lizenzhinweise" : "All source and license notices"}</a></li>
        </ul>
      </div>
    </dialog>
  );
}
