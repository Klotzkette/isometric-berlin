type View = { position: [number, number, number]; target: [number, number, number]; fov: number };

export const jannowitzViewsV380: Record<string, View> = {
  "Bahnhof Jannowitzbrücke": { position: [3187, 44, 661], target: [3252, 10.5, 595], fov: 47 },
  "Jannowitzbrücke": { position: [3075, 15, 566], target: [3137, 5.1, 582], fov: 46 },
  "Niederländische Botschaft": { position: [2760, 28, 514], target: [2739, 15.7, 465], fov: 45 },
  "KitKatClub": { position: [3025, 15, 960], target: [3054, 8.8, 936], fov: 44 },
  "Kraftwerk Berlin": { position: [3198, 74, 1057], target: [3260, 25, 972], fov: 45 },
};
