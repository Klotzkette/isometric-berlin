/** Exterior recognition sections are display fits; source wall planes stay exact. */
export const GENDARMEN_BND_CONTEXT_V214_PROFILE = {
  sourceUrls: [
    "https://das-projekt-berlin.de/projekt/l108/",
    "https://fuchshuber-planning.de/projekte/feuerland-hoefe-berlin/",
    "https://www.architekturpreis-berlin.de/Archiv/2020/Projekte/199/index.html",
    "https://www.vasconi.fr/fr/les-projets/projet/bureaux-commerces/quartier-30-gendarmenmarkt",
    "https://www.mueller-reimann.de/projekte/haus-borchardt",
    "https://www.bbaw.de/kontakt",
  ],
  nativeGridM: .5,
  cameras: {
    feuerland: { target: [571, 16, -1640], position: [499, 50, -1588] },
    living108: { target: [737, 17, -1371], position: [800, 45, -1410] },
    gendarmenmarkt: { target: [1450, 15, 643], position: [1620, 105, 703] },
  },
  // Measured final-count buffers; no second mobile variant or capacity reserve.
  budget: { drawnBytes: 212_956, nativeBytes: 1_024_484, drawCalls: 2 },
  retainedGeometry: true,
  geometryReplacements: [],
} as const;

export const GENDARMEN_BND_CONTEXT_V214_BUDGET = GENDARMEN_BND_CONTEXT_V214_PROFILE.budget;
