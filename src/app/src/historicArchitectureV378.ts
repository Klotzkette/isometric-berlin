import index from "./data/historicArchitectureV378Index.json";
import type { FacadeCatalogV377 } from "./surveyedBuildingFacadesV377";
import type { ShellDataV377 } from "./surveyedBuildingShellsV377";

export type HistoricArchitectureTileV378 = Partial<ShellDataV377> & {
  facades: FacadeCatalogV377;
};

const available = {
  drawn: new Set<string>(index.drawn),
  minecraft: new Set<string>(index.minecraft),
};
/** Each local packet contains only the currently visible city tile and edition. */
export function loadHistoricArchitectureV378(tile: string, native: boolean):
  Promise<HistoricArchitectureTileV378> | undefined {
  const mode = native ? "minecraft" : "drawn";
  if (!available[mode].has(tile)) return;
  return import(`./data/historicArchitectureV378Tiles/${mode}_${tile}.json`)
    .then(module => module.default);
}
