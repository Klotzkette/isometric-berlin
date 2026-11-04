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

// Each range is part of one loading sequence. Its width is a presentation
// choice, so the viewer shows the stage and the bar without a numeric ETA.
const drawnRanges = {
  sources: [0, 18],
  owners: [18, 23],
  navigation: [23, 28],
  buildings: [28, 35],
  geometry: [35, 47],
  architecture: [47, 60],
  details: [60, 97],
  presentation: [97, 100],
} as const;

const nativeRanges = {
  ...drawnRanges,
  sources: [0, 28],
  buildings: [28, 74],
  architecture: [74, 88],
  details: [88, 97],
} as const;

export function startupWorkPositionV309(work: StartupWorkV309): number {
  const [start, end] = (work.native ? nativeRanges : drawnRanges)[work.phase];
  if (!work.total || !Number.isFinite(work.total) || work.total < 0) return start;
  const completed = Number.isFinite(work.completed) ? work.completed : 0;
  const fraction = Math.max(0, Math.min(1, completed / work.total));
  return Math.min(99, Math.floor(start + (end - start) * fraction));
}

export function startupWorkPresentationV309(work: StartupWorkV309, language: "de" | "en") {
  return {
    label: labels[language][work.phase],
    percentage: startupWorkPositionV309(work),
    indeterminate: work.total === undefined || !Number.isFinite(work.total) || work.total <= 0,
  };
}
