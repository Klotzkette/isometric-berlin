/** World metres, aimed at the burial ground or at the face of the actual marker. */
type MemorialView = { position: [number, number, number]; target: [number, number, number]; fov: number };

export const memorialViewsV378: Record<string, MemorialView> = {
  "Sowjetischer Soldatenfriedhof im Tiergarten": {
    position: [-18, 46, 177], target: [24, 8, 231], fov: 51,
  },
  "Sowjetisches Ehrenmal im Treptower Park": {
    position: [6509, 64, 3590], target: [6700, 17, 3760], fov: 50,
  },
  "Sowjetischer Soldatenfriedhof Schönholzer Heide": {
    position: [342, 62, -6859], target: [256, 25, -6948], fov: 49,
  },
  "Britischer Soldatenfriedhof an der Heerstraße": {
    position: [-10185, 40, 1106], target: [-10258, 5, 1077], fov: 51,
  },
  "US-Flieger im Commonwealth-Friedhof – Grabfeld 2": {
    position: [-10230, 10, 1026], target: [-10246, 3.8, 1014], fov: 49,
  },
  "Französische Soldatengräber 1870/71 am Columbiadamm": {
    position: [2362.5, 7.2, 4352.5], target: [2358.88, 4.5, 4345.38], fov: 39,
  },
  "Cimetière française – Zugang zum Friedhof Heiligensee": {
    position: [-10354.3, 11.45, -9072.4], target: [-10342.99, 4.05, -9080.37], fov: 46,
  },
  "Gedenktafel am ehemaligen französischen Ehrenfriedhof Frohnau": {
    position: [-5110.20, 21.57, -13823.85], target: [-5114.08, 20.36, -13826.54], fov: 36,
  },
  "Luftbrückendenkmal am Flughafen Tempelhof": {
    position: [966, 17, 3912], target: [995, 12, 3890], fov: 46,
  },
  "Grab von Theodor und Emilie Fontane": {
    position: [467.6, 8.4, -2111.7], target: [463.3, 6.1, -2116.4], fov: 43,
  },
  "Grab von E. T. A. Hoffmann": {
    position: [1255.2, 8.2, 2696], target: [1253.8, 6.1, 2690.1], fov: 40,
  },
  "Grab von Felix Mendelssohn Bartholdy": {
    position: [1403.0, 8.1, 2695.0], target: [1397.4, 6.2, 2692.8], fov: 40,
  },
  "Grab von Nico und Margarete Päffgen": {
    position: [-10937.0, 35.8, 2631.7], target: [-10940.85, 33.95, 2628.49], fov: 38,
  },
};
