import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { transformLosslessJsonData, LOSSLESS_JSON_FIELD_BYTES, LOSSLESS_PACKED_STRING_FIELDS } from '../losslessJsonData';
import { decodeLosslessGzipJson } from '../src/losslessGzipJson';
import { decodeLosslessGzipJson as decodeBase85GzipJson } from "../src/losslessGzipBase85";
import { LOSSLESS_EAGER_FIELDS_V270 } from '../losslessEagerFieldsV270';

// These separately audited fields were already eager, strongly owned literals.
// Their v270 source encoding adds exactly one initial decode per listed field.
const EAGER_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'altMitteGroundSeamsV206.json': ['spans_u32', 'tops_f32'],
  'westVenuesV260.json': ['ribSegments', 'sourceColors', 'sourcePartIds'],
};

// v272 adds packed fields smaller than the unchanged 64 KiB admission limit.
// They remain direct literals; listing them explicitly prevents a shrinking or
// unexpectedly uncompressed large field from silently bypassing lazy checks.
const DIRECT_PACKED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'bayerCampusV277.json': ['drawnPositions', 'drawnColors'],
  'lehrterV277.json': ['sourcePositions', 'sourceColors', 'facadeBoxes'],
  'rkiMoabitV277.json': ['drawnColors'],
  'tiergartenWerkhofV275.json': ['drawnColors', 'drawnDetails'],
  'pressQuarterV272.json': ['sourcePositions'],
  'theatresV272.json': ['sourcePositions', 'facadeBoxes'],
};

function compile(name: string, value: unknown) {
  const result = transformLosslessJsonData(JSON.stringify(value), `/project/src/app/src/data/${name}`)!;
  expect(result).toBeDefined();
  const code = result.code.replace(/^import[^\n]*\n/, '').replace(/export \{[^\n]*\};/, '')
    // Production default consumers tree-shake unused named export initializers.
    .replace(/const __field\d+ = \/\* @__PURE__ \*\/ __read\d+\(\);/g, '')
    .replace('export default', 'return');
  let decodes = 0;
  const data = new Function('__decodeLosslessGzip', code)((encoded: string) => {
    decodes++; return (result.code.includes("losslessGzipBase85") ? decodeBase85GzipJson : decodeLosslessGzipJson)(encoded);
  });
  return { data, result, decodes: () => decodes };
}

test('audited packed strings round-trip every byte with strong ownership and size-bound lazy decoding', () => {
  let savings = 0;
  for (const [name, fields] of Object.entries(LOSSLESS_PACKED_STRING_FIELDS)) {
    const source = JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), 'utf8'));
    const { data, result, decodes } = compile(name, source);
    const eagerFields = EAGER_FIELDS[name] ?? [];
    const directFields = DIRECT_PACKED_FIELDS[name] ?? [];
    for (const field of directFields) expect(fields).toContain(field);
    expect(LOSSLESS_EAGER_FIELDS_V270[`data/${name}`] ?? []).toEqual(eagerFields);
    expect(decodes()).toBe(eagerFields.length);
    for (const field of eagerFields) {
      expect(Object.getOwnPropertyDescriptor(data, field)?.value).toBe(data[field]);
      expect(data[field]).toEqual(source[field]);
    }
    expect(decodes()).toBe(eagerFields.length);
    for (const field of fields) {
      const direct = directFields.includes(field);
      const descriptor = Object.getOwnPropertyDescriptor(data, field)!;
      if (direct) {
        expect(JSON.stringify(source[field]).length).toBeLessThan(LOSSLESS_JSON_FIELD_BYTES);
        expect(descriptor.get).toBeUndefined();
        expect(descriptor.value).toBe(source[field]);
      } else {
        expect(JSON.stringify(source[field]).length).toBeGreaterThanOrEqual(LOSSLESS_JSON_FIELD_BYTES);
        expect(descriptor.get).toBeFunction();
      }
      const before = decodes(), decoded = data[field];
      expect(decoded).toBe(source[field]);
      expect(Buffer.from(decoded, 'base64')).toEqual(Buffer.from(source[field], 'base64'));
      expect(data[field]).toBe(decoded);
      expect(decodes()).toBe(before + (direct ? 0 : 1));
    }
    expect(decodes()).toBe(eagerFields.length + fields.length - directFields.length);
    expect(Object.keys(data).sort()).toEqual(Object.keys(source).sort());
    expect(JSON.stringify(data)).toBe(JSON.stringify(source));
    expect(result.code).not.toContain('WeakRef');
    const field = fields.find(candidate => !directFields.includes(candidate))!;
    expect(field).toBeDefined();
    data[field] = 'owned replacement';
    expect(data[field]).toBe('owned replacement');
    Object.freeze(data); expect(() => { data[field] = 'forbidden'; }).toThrow();
    savings += JSON.stringify(source).length - result.code.length;
  }
  expect(savings * 2).toBeGreaterThan(4 * 1024 * 1024);
});

test('unlisted strings and small values retain their direct-literal encoding', () => {
  const source = { cells_u32: 'AQ==', unknown: 'a'.repeat(70000), triangles_f32: 'AQ==', edges_f32: 'AQ==' };
  const result = transformLosslessJsonData(JSON.stringify(source), '/project/src/app/src/data/drawnWaterBoundary.json');
  expect(result).toBeUndefined();
  expect(transformLosslessJsonData(JSON.stringify({ cells_u32: 'a'.repeat(70000) }), '/project/src/app/src/data/unrelated.json')).toBeUndefined();
});
