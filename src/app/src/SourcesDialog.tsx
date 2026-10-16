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
