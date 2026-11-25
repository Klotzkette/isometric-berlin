import { placesRequiringAllOwners, regionalPlaceOwnersV380 } from "./openingSiteOwnerV379";

type View = { position: [number, number, number]; target: [number, number, number]; fov: number };

export const potsdamerPlatzViewsV385: Record<string, View & { native?: View }> = {
  "Potsdamer Platz": { position: [438, 153, 1285], target: [320, 22, 1029], fov: 55 },
  "Verkehrsturm am Potsdamer Platz": { position: [315, 11.7, 1101], target: [302.402, 10.1, 1081.714], fov: 34 },
  "Ritz-Carlton am Potsdamer Platz": { position: [278, 49, 1058], target: [248, 41, 978], fov: 63 },
  "Mauersegmente am Potsdamer Platz": { position: [329, 16, 1023], target: [307.2, 7.2, 1008], fov: 44 },
  "Mall of Berlin": { position: [477, 34, 1014], target: [532, 21, 1007], fov: 54,
    native: { position: [504, 30, 1004], target: [531.8, 17.5, 1007], fov: 59 } },
  "Piazza der Mall of Berlin": { position: [642, 18, 1011], target: [632, 13.7, 944], fov: 58 },
  "Kanadische Botschaft am Leipziger Platz": { position: [439, 38, 1016], target: [395.3, 16, 973.7], fov: 48,
    native: { position: [416.5, 31, 993], target: [395.3, 17.4, 973.7], fov: 62 } },
  "Taylor Wessing an der Ebertstraße": { position: [328, 23, 892], target: [365, 15, 886], fov: 52,
    native: { position: [345, 25, 895], target: [365, 17, 886], fov: 62 } },
  "Telekom – Magenta Mitte": { position: [339, 21, 882], target: [373, 15, 854], fov: 52 },
  "Denkmal für die ermordeten Juden Europas": { position: [335, 80, 673], target: [469, 5.4, 562], fov: 56 },
};

// The hotel and Ebertstraße overlays share the original district north of
// the station. The traffic tower and other source envelopes belong to the core.
for (const name of ["Potsdamer Platz", "Ritz-Carlton am Potsdamer Platz", "Mauersegmente am Potsdamer Platz",
  "Kanadische Botschaft am Leipziger Platz", "Taylor Wessing an der Ebertstraße", "Telekom – Magenta Mitte"]) {
  regionalPlaceOwnersV380.set(name, ["0_1"]);
  placesRequiringAllOwners.add(name);
}

for (const name of ["Verkehrsturm am Potsdamer Platz", "Mall of Berlin", "Piazza der Mall of Berlin",
  "Denkmal für die ermordeten Juden Europas"]) {
  regionalPlaceOwnersV380.set(name, []);
  placesRequiringAllOwners.add(name);
}
