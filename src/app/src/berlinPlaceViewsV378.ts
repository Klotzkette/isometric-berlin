import {mitteWestViewsV383} from "./mitteWestViewsV383";
import { potsdamerPlatzViewsV385 } from "./potsdamerPlatzViewsV385";
import {kollwitzKiezViewsV381} from "./kollwitzKiezViewsV381";
import {berlinPlaceViewsV380} from "./berlinPlaceViewsV380";
import { charlottenburgerTorViewsV379 } from "./charlottenburgerTorViewsV379";
import { tierparkEastViewsV379 } from "./tierparkEastViewsV379";
import { zooWestViewsV379 } from "./zooWestViewsV379";
import { historicArchitectureViewsV378 } from "./historicArchitectureViewsV378";
import { memorialViewsV378 } from "./memorialsV378Stops";
import { retailViewsV378 } from "./retailV378Index";
import { tegelViewsV378 } from "./tegelLandscapeViewsV378";
import { transportViewsV378 } from "./transportViewsV378";
import { waterwayViewsV378 } from "./waterwayViewsV378";

export const berlinPlaceViewsV378: typeof memorialViewsV378 = {
  ...charlottenburgerTorViewsV379,
  ...tierparkEastViewsV379,
  ...zooWestViewsV379,
  "Kurfürstendamm 17 – Hotel Boulevard": { position: [-2792,23,1552], target: [-2736,16,1554], fov: 48 },
  "Hardenbergstraße 21 – aletto Hotel": { position: [-2828,30,1298], target: [-2862,16,1328], fov: 48 },
  "Breitscheidplatz und Gedächtniskirche": { position: [-2369,91,1623], target: [-2480,21,1519], fov: 48 },
  ...historicArchitectureViewsV378,
  ...memorialViewsV378,
  ...retailViewsV378,
  ...tegelViewsV378,
  ...transportViewsV378,
  ...waterwayViewsV378,
  "Hermannplatz in Neukölln": { position: [3576, 82, 3710], target: [3541, 3, 3610], fov: 51 },
  "Weserstraße – Fahrradstraße in Neukölln": { position: [3995, 32, 3585], target: [4031, 3, 3605], fov: 52 },
  "Weserstraße – südöstlicher Abschnitt": { position: [4748, 39, 4157], target: [4715, 3, 4129], fov: 52 },
  ...berlinPlaceViewsV380,
  ...kollwitzKiezViewsV381,
  ...mitteWestViewsV383,
  ...potsdamerPlatzViewsV385,
};
