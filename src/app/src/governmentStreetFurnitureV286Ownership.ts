/** Exact old delivered records. Their 6.8 m heights are display fallbacks;
 * only the municipal XZ points are source coordinates. No source is deleted. */
export const SOURCE_LAMP_RECEIPTS_V286 = [
  { id: "231349", position: [-31.99, 4.834, -49.36], height_m: 6.8,
    light_type: "Elektrische Beleuchtung allgemein", rotation_degrees: 0,
    street: "Heinrich-von-Gagern-Straße" },
  { id: "231363", position: [-46.17, 4.848, -46.44], height_m: 6.8,
    light_type: "Elektrische Beleuchtung allgemein", rotation_degrees: 0,
    street: "Heinrich-von-Gagern-Straße" },
  { id: "231319", position: [-49.39, 4.285, 102.99], height_m: 6.8,
    light_type: "Elektrische Beleuchtung allgemein", rotation_degrees: 0,
    street: "Heinrich-von-Gagern-Straße" },
  { id: "244884", position: [-55.31, 4.969, -71.55], height_m: 6.8,
    light_type: "Lichtmast mit Aufsatzleuchte", rotation_degrees: 90.68,
    street: "Paul-Löbe-Allee" },
  { id: "92930", position: [-46.29, 4.941, -71.33], height_m: 6.8,
    light_type: "Lichtmast mit Aufsatzleuchte", rotation_degrees: 90.68,
    street: "Paul-Löbe-Allee" },
  { id: "92928", position: [-31.22, 4.906, -68.88], height_m: 6.8,
    light_type: "Lichtmast mit Aufsatzleuchte", rotation_degrees: 90.15,
    street: "Paul-Löbe-Allee" },
  { id: "92927", position: [-31.33, 4.884, -66], height_m: 6.8,
    light_type: "Lichtmast mit Aufsatzleuchte", rotation_degrees: 90.35,
    street: "Paul-Löbe-Allee" },
  { id: "92931", position: [-55.45, 4.958, -62.24], height_m: 6.8,
    light_type: "Lichtmast mit Aufsatzleuchte", rotation_degrees: 90.31,
    street: "Paul-Löbe-Allee" },
  { id: "92925", position: [-19.44, 4.909, -63.82], height_m: 6.8,
    light_type: "Lichtmast mit Aufsatzleuchte", rotation_degrees: 90.35,
    street: "Paul-Löbe-Allee" },
  { id: "92926", position: [-18.74, 4.972, -70.76], height_m: 6.8,
    light_type: "Lichtmast mit Aufsatzleuchte", rotation_degrees: 90.15,
    street: "Paul-Löbe-Allee" },
] as const;

type Receipt = typeof SOURCE_LAMP_RECEIPTS_V286[number];
const keys = ["id", "position", "height_m", "light_type", "rotation_degrees", "street"] as const;

function exactReceipt(value: object, receipt: Receipt): boolean {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some(key =>
    typeof key !== "string" || !keys.includes(key as typeof keys[number]))) return false;
  for (const key of keys) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property || !("value" in property) || !property.enumerable) return false;
    if (key === "position") {
      const position: unknown = property.value;
      if (!Array.isArray(position) || Reflect.ownKeys(position).length !== 4) return false;
      const length = Object.getOwnPropertyDescriptor(position, "length");
      if (!length || !("value" in length) || length.value !== 3 ||
        length.enumerable || length.configurable) return false;
      for (let index = 0; index < 3; index++) {
        const coordinate = Object.getOwnPropertyDescriptor(position, String(index));
        if (!coordinate || !("value" in coordinate) || !coordinate.enumerable ||
          coordinate.value !== receipt.position[index]) return false;
      }
    } else if (property.value !== receipt[key]) return false;
  }
  return true;
}

/** A complete-family admission only. A changed, missing or duplicate owner
 * keeps all ten generic lamps. Nearby foreign/private records never yield
 * because of these photo-estimated anchors. Construct the complete twenty
 * replacements before a caller skips the ten admitted generic records. */
export function admitGovernmentStreetLampsV286(lights: readonly unknown[]): boolean {
  const seen = new Set<string>();
  try {
    for (const value of lights) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const id: unknown = (value as { id?: unknown }).id;
      const receipt = SOURCE_LAMP_RECEIPTS_V286.find(expected => expected.id === id);
      if (!receipt) continue;
      if (seen.has(receipt.id) || !exactReceipt(value, receipt)) return false;
      seen.add(receipt.id);
    }
  } catch {
    // Non-JSON accessors/proxies cannot authorise retirement either.
    return false;
  }
  return seen.size === SOURCE_LAMP_RECEIPTS_V286.length;
}
