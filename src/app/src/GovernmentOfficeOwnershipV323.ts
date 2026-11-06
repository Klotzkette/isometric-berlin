/** Small synchronous navigation classification; never positive model admission.
 * Full architecture, source plans and private live gates stay in the lazy factory.
 * These are complete original records, not an ID or geographic exclusion list. */
import data from "./data/governmentOfficeOriginalPrismsV323.json";

const SOURCE_CONTROL = 2029084726;
const hash = (value: unknown): number => {
  const text = JSON.stringify(value);
  let result = 2166136261;
  for (let i = 0; i < text.length; i++) result = Math.imul(result ^ text.charCodeAt(i), 16777619) >>> 0;
  return result;
};
function freeze(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
}
const sourceReady = data.schemaVersion === 1 && data.federal.length === 5 &&
  data.senate.length === 1 && data.universities.length === 21 && hash(data) === SOURCE_CONTROL;
if (sourceReady) freeze(data);

/** Preserve the established federal/university own-data comparison exactly. */
function exact(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (!actual || !expected || typeof actual !== "object" || typeof expected !== "object" ||
    Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.getOwnPropertyNames(actual), wanted = Object.getOwnPropertyNames(expected);
  return keys.length === wanted.length && wanted.every(key => {
    const a = Object.getOwnPropertyDescriptor(actual, key), b = Object.getOwnPropertyDescriptor(expected, key);
    return !!a && !!b && "value" in a && "value" in b && exact(a.value, b.value);
  });
}
/** The Senate classifier additionally preserves its original prototype check. */
function exactSenate(actual: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== "object") return Object.is(actual, expected);
  if (!actual || typeof actual !== "object" || Array.isArray(actual) !== Array.isArray(expected) ||
    Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false;
  const wanted = Object.keys(expected);
  return Object.keys(actual).length === wanted.length && wanted.every(key => {
    const a = Object.getOwnPropertyDescriptor(actual, key), b = Object.getOwnPropertyDescriptor(expected, key);
    return !!a && !!b && "value" in a && "value" in b && exactSenate(a.value, b.value);
  });
}
const federal = new Map(data.federal.map(row => [row.id, row]));
const senate = new Map(data.senate.map(row => [row.id, row]));
const universities = new Map(data.universities.map(row => [row.id, row]));
function ownId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const descriptor = Object.getOwnPropertyDescriptor(value, "id");
  return descriptor && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value : null;
}

/** Classification only. The caller still requires the live full Government gate. */
export function governmentPreviousPrismV321(prism: unknown): boolean {
  if (!sourceReady) return false;
  const id = ownId(prism);
  return id !== null && (federal.has(id) && exact(prism, federal.get(id)) ||
    senate.has(id) && exactSenate(prism, senate.get(id)));
}

/** Classification only. The caller still requires the live full University gate. */
export function universitiesPreviousPrismV322(prism: unknown): boolean {
  if (!sourceReady) return false;
  const id = ownId(prism);
  return id !== null && universities.has(id) && exact(prism, universities.get(id));
}
