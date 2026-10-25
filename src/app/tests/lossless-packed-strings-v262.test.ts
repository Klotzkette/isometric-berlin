import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { transformLosslessJsonData, LOSSLESS_PACKED_STRING_FIELDS } from '../losslessJsonData';
import { decodeLosslessGzipJson } from '../src/losslessGzipJson';
import { decodeLosslessGzipJson as decodeBase85GzipJson } from "../src/losslessGzipBase85";
import { LOSSLESS_EAGER_FIELDS_V270 } from '../losslessEagerFieldsV270';

// These separately audited fields were already eager, strongly owned literals.
// Their v270 source encoding adds exactly one initial decode per listed field.
const EAGER_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'altMitteGroundSeamsV206.json': ['spans_u32', 'tops_f32'],
  'westVenuesV260.json': ['ribSegments', 'sourceColors', 'sourcePartIds'],
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

test('audited water, ground and venue packed strings round-trip every byte with lazy strong field ownership', () => {
  let savings = 0;
  for (const [name, fields] of Object.entries(LOSSLESS_PACKED_STRING_FIELDS)) {
    const source = JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), 'utf8'));
    const { data, result, decodes } = compile(name, source);
    const eagerFields = EAGER_FIELDS[name] ?? [];
    expect(LOSSLESS_EAGER_FIELDS_V270[`data/${name}`] ?? []).toEqual(eagerFields);
    expect(decodes()).toBe(eagerFields.length);
    for (const field of eagerFields) {
      expect(Object.getOwnPropertyDescriptor(data, field)?.value).toBe(data[field]);
      expect(data[field]).toEqual(source[field]);
    }
    expect(decodes()).toBe(eagerFields.length);
    for (const field of fields) {
      expect(Object.getOwnPropertyDescriptor(data, field)?.get).toBeFunction();
      const before = decodes(), decoded = data[field];
      expect(decoded).toBe(source[field]);
      expect(Buffer.from(decoded, 'base64')).toEqual(Buffer.from(source[field], 'base64'));
      expect(data[field]).toBe(decoded);
      expect(decodes()).toBe(before + 1);
    }
    expect(decodes()).toBe(eagerFields.length + fields.length);
    expect(Object.keys(data).sort()).toEqual(Object.keys(source).sort());
    expect(JSON.stringify(data)).toBe(JSON.stringify(source));
    expect(result.code).not.toContain('WeakRef');
    const field = fields[0]; data[field] = 'owned replacement';
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
