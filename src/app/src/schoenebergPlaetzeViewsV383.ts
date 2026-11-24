type View = { position: [number, number, number]; target: [number, number, number]; fov: number };

export const schoenebergPlaetzeViewsV383: Record<string, View> = {
  "Nollendorfplatz": { position: [-1329, 45, 2166], target: [-1267, 14, 2117], fov: 54 },
  "Metropol am Nollendorfplatz": { position: [-1322, 12, 2147], target: [-1322, 18, 2176], fov: 59 },
  "Winterfeldtplatz": { position: [-1242, 57, 2394], target: [-1206, 13, 2497], fov: 58 },
  "St. Matthias am Winterfeldtplatz": { position: [-1151, 65, 2640], target: [-1203, 25, 2593], fov: 60 },
};

export function schoenebergPlaetzeOpeningHostV383(name: string): string | undefined {
  const view = schoenebergPlaetzeViewsV383[name];
  if (view) return view.target[2] < 2250 ? "schoeneberg383-noll" : "schoeneberg383-winter";
}
