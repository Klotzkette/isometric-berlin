import { historicArchitectureViewsV378 } from "./historicArchitectureViewsV378";
import { memorialViewsV378 } from "./memorialsV378Stops";
import { retailViewsV378 } from "./retailV378Index";
import { tegelViewsV378 } from "./tegelLandscapeViewsV378";
import { transportViewsV378 } from "./transportViewsV378";
import { waterwayViewsV378 } from "./waterwayViewsV378";

export const berlinPlaceViewsV378: typeof memorialViewsV378 = {
  ...historicArchitectureViewsV378,
  ...memorialViewsV378,
  ...retailViewsV378,
  ...tegelViewsV378,
  ...transportViewsV378,
  ...waterwayViewsV378,
  "Hermannplatz in Neukölln": { position: [3576, 82, 3710], target: [3541, 3, 3610], fov: 51 },
  "Weserstraße – Fahrradstraße in Neukölln": { position: [3995, 32, 3585], target: [4031, 3, 3605], fov: 52 },
  "Weserstraße – südöstlicher Abschnitt": { position: [4748, 39, 4157], target: [4715, 3, 4129], fov: 52 },
};
