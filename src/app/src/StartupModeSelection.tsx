import { CloudSnow, Moon, Sparkles, Sun, Waves } from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { Language } from "./localization";
import type { VisualMode } from "./visualMode";
import { MinecraftCubeIcon } from "./visual-modes/minecraft/MinecraftCubeIcon";

const choices = [
  { mode: "day", icon: Sun, de: ["Normal", "Berlin bei Tageslicht"], en: ["Day", "Berlin in daylight"] },
  { mode: "night", icon: Moon, de: ["Nacht", "Mit eingeschalteten Lichtern"], en: ["Night", "City lights switched on"] },
  { mode: "snowstorm", icon: CloudSnow, de: ["Schnee", "Mit dichtem Schneetreiben"], en: ["Snow", "With a swirling snowstorm"] },
  { mode: "schwellenraum", icon: Sparkles, de: ["Schwellenraum", "Eine andere Wirklichkeit"], en: ["Schwellenraum", "Another reality"] },
  { mode: "flood", icon: Waves, de: ["Unterwasser", "Berlin unter 3 Metern Wasser"], en: ["Underwater", "Berlin under 3 metres of water"] },
  { mode: "minecraft", icon: MinecraftCubeIcon, de: ["Minecraft", "Berlin aus Blöcken"], en: ["Minecraft", "Berlin built from blocks"] },
] as const;

export function StartupModeSelection({ initialMode, language, onLanguageChange, onStart, backdropUrl }: {
  initialMode: VisualMode;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onStart: (mode: VisualMode) => void;
  backdropUrl: string;
}) {
  const [mode, setMode] = useState(initialMode);
  return (
    <main className="startup-mode-selection" style={{
      "--viewer-static-backdrop-image": `url(${JSON.stringify(backdropUrl)})`,
    } as CSSProperties}>
      <form className="startup-selection-panel" onSubmit={(event) => {
        event.preventDefault();
        onStart(mode);
      }}>
        <header className="startup-selection-heading">
          <div><span className="three-startup-eyebrow">Isometric</span><h1>Berlin</h1></div>
          <button className="startup-language" type="button" onClick={() => onLanguageChange(language === "de" ? "en" : "de")} aria-label={language === "de" ? "Switch to English" : "Auf Deutsch wechseln"}>
            {language === "de" ? "EN" : "DE"}
          </button>
        </header>
        <fieldset>
          <legend>{language === "de" ? "Wie möchtest du Berlin entdecken?" : "How would you like to explore Berlin?"}</legend>
          <div className="startup-mode-grid">
            {choices.map(({ mode: value, icon: Icon, ...labels }) => (
              <label key={value} className={`startup-mode-option${mode === value ? " is-selected" : ""}`}>
                <input type="radio" name="startup-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                <Icon aria-hidden="true" size={24} />
                <span><strong>{labels[language][0]}</strong><small>{labels[language][1]}</small></span>
              </label>
            ))}
          </div>
        </fieldset>
        <button className="startup-launch" type="submit">{language === "de" ? "Berlin starten" : "Start Berlin"}<span aria-hidden="true"> →</span></button>
        <p className="startup-selection-note">{language === "de" ? "Du kannst den Modus später jederzeit wechseln." : "You can switch modes at any time while exploring."}</p>
      </form>
      <footer className="startup-selection-credit">© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia</footer>
    </main>
  );
}
