const test = require('node:test');
const assert = require('node:assert/strict');
const Worksheet = require('../src/worksheet.js');
const library = [
  { id: 'ohm', vars: [{ key: 'V' }, { key: 'I' }, { key: 'R' }] },
  { id: 'power', vars: [{ key: 'P' }, { key: 'V' }, { key: 'I' }] },
];
function storage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const single = { version: 1, mode: 'equation', selected: 'ohm', unknown: 'R', values: { V: '12', I: '1/4' }, numeric: true, guesses: { R: '2' } };

test('worksheet snapshots replace previous work instead of accumulating history', () => {
  const cache = storage();
  for (let i = 0; i < 1000; i++) Worksheet.write(cache, { ...single, values: { V: String(i) } }, library);
  assert.equal(cache.data.size, 1);
  assert.ok([...cache.data.values()][0].length < 300);
  assert.deepEqual(Worksheet.read(cache, library), { ...single, values: { V: '999' } });
  Worksheet.write(cache, { ...single, selected: 'power', unknown: 'P', values: { P: '7', R: '99' } }, library);
  assert.deepEqual(Worksheet.read(cache, library).values, { P: '7' });
});

test('restore prunes deleted equations and edited variable fields', () => {
  const cache = storage();
  Worksheet.write(cache, single, library);
  assert.equal(Worksheet.read(cache, []), null);
  const edited = [{ id: 'ohm', vars: [{ key: 'V' }] }];
  assert.deepEqual(Worksheet.read(cache, edited), { ...single, unknown: 'V', values: { V: '12' }, guesses: {} });
  Worksheet.write(cache, { version: 1, mode: 'system', slots: ['ohm', 'power'], mappings: { 0: { V: 'voltage' }, 1: { P: 'watts' } }, unknowns: ['R', 'watts'], values: { voltage: '12', I: '2', unused: '99' }, guesses: { R: '3' } }, library);
  const restored = Worksheet.read(cache, library.slice(0, 1));
  assert.deepEqual(restored.slots, ['ohm', '']);
  assert.deepEqual(restored.mappings, { 0: { V: 'voltage' }, 1: {} });
  assert.deepEqual(restored.unknowns, ['R']);
  assert.deepEqual(restored.values, { voltage: '12', I: '2' });
  assert.deepEqual(restored.guesses, { R: '3' });
});

test('invalid, oversized and unavailable cache data does not block startup', () => {
  const cache = storage();
  Worksheet.write(cache, single, library);
  const key = [...cache.data.keys()][0];
  for (const value of ['{broken', 'null', '{"version":99}', 'x'.repeat(65537)]) {
    cache.setItem(key, value);
    assert.equal(Worksheet.read(cache, library), null);
  }
  assert.equal(Worksheet.read({ getItem() { throw new Error('Unavailable'); } }, library), null);
});

test('oversized snapshots clear the previous snapshot and report the limit', () => {
  const cache = storage(), largeLibrary = Array.from({ length: 8 }, (_, i) => ({ id: String(i), vars: Array.from({ length: 40 }, (_, j) => ({ key: `v${i}_${j}` })) }));
  Worksheet.write(cache, single, library);
  const values = Object.fromEntries(largeLibrary.flatMap(eq => eq.vars.map(v => [v.key, '\u0000'.repeat(200)])));
  assert.throws(() => Worksheet.write(cache, { version: 1, mode: 'system', slots: largeLibrary.map(eq => eq.id), values }, largeLibrary), /too large/);
  assert.equal(cache.data.size, 0);
});
