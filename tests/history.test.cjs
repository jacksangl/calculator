const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { snapshot, readHistory, appendHistory, LIMIT } = require('../electron/history.cjs');
const variable = key => ({ key, tex: '', unit: '', desc: '', domain: 'real' });
const equation = { id: 'ohm', name: "Ohm's law", subject: 'ee', klass: 'Circuits', formula: 'V=I*R', vars: ['V', 'I', 'R'].map(variable) };
const input = { history: { kind: 'equation', equations: [equation], mappings: [{}] }, equations: ['V=I*R'], unknowns: ['R'], values: { V: '12', I: '1/4', R: 'old', unused: '2' }, guesses: { R: '1' }, numeric: false };
const result = { status: 'solved', message: '1 verified solution.', numeric: false, answers: [{ variables: [{ key: 'R', latex: '48', decimal: '48.0000000000' }] }] };

test('history snapshots retain exact inputs and mapped systems, reject mismatched formulas', () => {
  const saved = snapshot(input);
  assert.deepEqual(saved.request.values, { V: '12', I: '1/4' });
  assert.equal(saved.equations[0].name, "Ohm's law");
  const system = snapshot({ ...input, equations: ['V=I*R', 'P=V*I'], unknowns: ['I', 'R'], values: { V: '12', P: '24' }, history: { kind: 'system', equations: [equation, { ...equation, id: 'power', formula: 'F=V*I', vars: ['F', 'V', 'I'].map(variable) }], mappings: [{}, { F: 'P' }] } });
  assert.equal(system.request.metadata.P.key, 'P');
  assert.equal(system.equations[1].formula, 'F=V*I');
  assert.deepEqual(system.mappings, [{}, { F: 'P' }]);
  assert.throws(() => snapshot({ ...input, equations: ['V=I+R'] }), /do not match/);
  assert.throws(() => snapshot({ ...input, unknowns: ['unknown'] }), /unknowns/);
  const special = { ...equation, formula: 'constructor=x', vars: ['constructor', 'x'].map(variable) };
  assert.equal(snapshot({ ...input, history: { kind: 'equation', equations: [special], mappings: [{}] }, equations: [special.formula], unknowns: ['constructor'], values: { x: '1' } }).request.equations[0], 'constructor=x');
});

test('history round trips snapshots, backs up saves, limits retention and preserves corrupt files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jotter-history-')), file = path.join(dir, 'history.json');
  try {
    assert.deepEqual(await readHistory(file), []);
    const first = await appendHistory(file, snapshot(input), result);
    const original = await fs.readFile(file, 'utf8');
    const second = await appendHistory(file, snapshot(input), result);
    assert.notEqual(first.id, second.id);
    assert.deepEqual(await readHistory(file), [second, first]);
    assert.equal(await fs.readFile(file + '.bak', 'utf8'), original);
    await assert.rejects(appendHistory(file, snapshot(input), { ...result, status: 'inconsistent', answers: [] }), /Invalid history result/);
    assert.deepEqual(await readHistory(file), [second, first]);
    const full = Array.from({ length: LIMIT }, (_, i) => ({ ...first, id: `entry-${i}` }));
    await fs.writeFile(file, JSON.stringify({ version: 1, entries: full }));
    const latest = await appendHistory(file, snapshot(input), result);
    const retained = await readHistory(file);
    assert.equal(retained.length, LIMIT); assert.equal(retained[0].id, latest.id); assert.equal(retained.at(-1).id, `entry-${LIMIT - 2}`);
    await fs.writeFile(file, '{broken');
    const backup = await fs.readFile(file + '.bak', 'utf8');
    await assert.rejects(readHistory(file), /has not been overwritten/);
    await assert.rejects(appendHistory(file, snapshot(input), result), /has not been overwritten/);
    assert.equal(await fs.readFile(file, 'utf8'), '{broken');
    assert.equal(await fs.readFile(file + '.bak', 'utf8'), backup);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
