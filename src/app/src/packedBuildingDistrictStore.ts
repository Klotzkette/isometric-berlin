import type { PrismBuilding } from "./IsometricCityWorld";

/**
 * Lossless backing store for JSON source districts. Consume each source array
 * after packing so an idle mobile worker keeps strings instead of the entire
 * city's decoded object graph. Reads are independent and never cached here.
 */
export class PackedBuildingDistrictStore {
  private readonly districts = new Map<string, string>();
  readonly sourceBuildingCount: number;
  readonly encodedCodeUnits: number;

  constructor(batches: readonly PrismBuilding[][]) {
    let sourceBuildingCount = 0;
    let encodedCodeUnits = 0;
    batches.forEach((buildings, index) => {
      const encoded = JSON.stringify(buildings);
      this.districts.set(`buildings-${index + 1}`, encoded);
      sourceBuildingCount += buildings.length;
      encodedCodeUnits += encoded.length;
      buildings.length = 0;
    });
    this.sourceBuildingCount = sourceBuildingCount;
    this.encodedCodeUnits = encodedCodeUnits;
  }

  get size(): number { return this.districts.size; }

  read(id: string): PrismBuilding[] {
    const encoded = this.districts.get(id);
    if (encoded === undefined) throw new Error(`Unknown building district ${id}`);
    return JSON.parse(encoded) as PrismBuilding[];
  }
}
