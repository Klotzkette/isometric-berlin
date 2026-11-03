export type StartupWorkV309 = {
  phase: "sources" | "owners" | "navigation" | "buildings" | "geometry" | "architecture" | "details" | "presentation";
  completed: number;
  total?: number;
  native?: boolean;
};

const labels = {
  de: {
    sources: "Kartendaten laden", owners: "Gebäudemodelle vorbereiten",
    navigation: "Wege vorbereiten", buildings: "Gebäude aufbauen",
    geometry: "Dächer und Stadtflächen aufbauen", architecture: "Architektur ergänzen",
    details: "Stadtdetails vorbereiten", presentation: "Startansicht zeichnen",
  },
  en: {
    sources: "Loading city data", owners: "Preparing building models",
    navigation: "Preparing paths", buildings: "Building the city",
    geometry: "Building roofs and city surfaces", architecture: "Adding architecture",
    details: "Preparing city details", presentation: "Drawing the opening view",
  },
};

/** Completed work only. Unknown totals stay explicitly indeterminate. */
export function startupWorkPresentationV309(work: StartupWorkV309, language: "de" | "en") {
  const completed = Math.max(0, Math.floor(Number.isFinite(work.completed) ? work.completed : 0));
  const total = work.total !== undefined && Number.isFinite(work.total) && work.total > 0 ? Math.floor(work.total) : undefined;
  return {
    label: labels[language][work.phase],
    counter: total ? `${Math.min(completed, total)} / ${total}` : completed ? `${completed}` : "…",
    percentage: total ? Math.min(100, completed / total * 100) : undefined,
  };
}
