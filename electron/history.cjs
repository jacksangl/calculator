const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { validateEquation } = require('./library.cjs');
const LIMIT = 500;
const MAX_BYTES = 25_000_000;
const symbol = key => typeof key === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key);
function strings(input, allowed, max = 200) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length > 320) throw new Error('Invalid history values.');
  return Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)).map(([key, value]) => {
    if (typeof value !== 'string' || value.length > max) throw new Error('Invalid history value.');
    return [key, value];
  }));
}
// Rebuild the solve request from validated equation snapshots, including shared-symbol renames.
function snapshot(input) {
  const context = input.history;
  if (!context || !['equation', 'system'].includes(context.kind) || !Array.isArray(context.equations)) throw new Error('Invalid history context.');
  const count = context.equations.length;
  if (context.kind === 'equation' ? count !== 1 : count < 2 || count > 8) throw new Error('Invalid history equations.');
  const equations = context.equations.map(validateEquation);
  if (!Array.isArray(context.mappings) || context.mappings.length !== count) throw new Error('Invalid history mappings.');
  const vars = new Map();
  const mappings = equations.map((eq, i) => {
    const mapping = strings(context.mappings[i], eq.vars.map(v => v.key), 40);
    const keys = eq.vars.map(v => Object.hasOwn(mapping, v.key) && mapping[v.key] ? mapping[v.key] : v.key);
    if (keys.some(key => !symbol(key)) || new Set(keys).size !== keys.length) throw new Error('Invalid shared variable names.');
    eq.vars.forEach((v, index) => {
      const key = keys[index], previous = vars.get(key);
      if (previous && (previous.unit !== v.unit || previous.domain !== v.domain)) throw new Error('Incompatible shared variables.');
      vars.set(key, { ...v, key, tex: key === v.key ? v.tex : key });
    });
    return mapping;
  });
  const formulas = equations.map((eq, i) => eq.formula.replace(/\b[A-Za-z][A-Za-z0-9_]*\b/g, key => Object.hasOwn(mappings[i], key) && mappings[i][key] ? mappings[i][key] : key));
  if (JSON.stringify(formulas) !== JSON.stringify(input.equations)) throw new Error('History equations do not match the calculation.');
  if (!Array.isArray(input.unknowns) || !input.unknowns.length || input.unknowns.some(key => !vars.has(key)) || new Set(input.unknowns).size !== input.unknowns.length) throw new Error('Invalid history unknowns.');
  if (typeof input.numeric !== 'boolean') throw new Error('Invalid history solve mode.');
  const request = { equations: formulas, metadata: Object.fromEntries(vars), unknowns: [...input.unknowns],
    values: strings(input.values, [...vars.keys()].filter(key => !input.unknowns.includes(key))),
    guesses: strings(input.guesses, input.unknowns), numeric: input.numeric };
  return { kind: context.kind, equations, mappings, request };
}
function validateEntry(entry) {
  if (!entry || typeof entry.id !== 'string' || entry.id.length > 100 || !entry.id || typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt))) throw new Error('Invalid history entry.');
  const saved = snapshot({ ...entry.request, history: entry });
  const result = entry.result;
  if (!result || result.status !== 'solved' || typeof result.message !== 'string' || result.message.length > 10000 || typeof result.numeric !== 'boolean' || !Array.isArray(result.answers) || !result.answers.length || result.answers.length > 1000) throw new Error('Invalid history result.');
  const answers = result.answers.map(answer => {
    if (!Array.isArray(answer.variables) || answer.variables.length !== saved.request.unknowns.length) throw new Error('Invalid history answer.');
    return { variables: answer.variables.map((v, i) => {
      if (v.key !== saved.request.unknowns[i] || typeof v.latex !== 'string' || v.latex.length > 10000 || typeof v.decimal !== 'string' || v.decimal.length > 10000) throw new Error('Invalid history answer value.');
      return { key: v.key, latex: v.latex, decimal: v.decimal };
    }) };
  });
  const clean = { id: entry.id, createdAt: entry.createdAt, ...saved, result: { status: 'solved', message: result.message, numeric: result.numeric, answers } };
  if (Buffer.byteLength(JSON.stringify(clean)) > 500_000) throw new Error('This calculation is too large to save in history.');
  return clean;
}
async function readHistory(file) {
  try {
    if ((await fs.stat(file)).size > MAX_BYTES) throw new Error('History file is too large.');
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    if (data?.version !== 1 || !Array.isArray(data.entries) || data.entries.length > LIMIT) throw new Error('Invalid history file.');
    const entries = data.entries.map(validateEntry);
    if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Duplicate history IDs.');
    return entries;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Cannot read history; it has not been overwritten. ${error.message} A previous save may be available in history.json.bak.`);
  }
}
// The main process serializes writes. Use the library's same temp-file, fsync and backup pattern.
async function appendHistory(file, saved, result) {
  const previous = await readHistory(file);
  const entry = validateEntry({ id: randomUUID(), createdAt: new Date().toISOString(), ...saved, result });
  const entries = [entry, ...previous].slice(0, LIMIT);
  const content = JSON.stringify({ version: 1, entries }, null, 2);
  if (Buffer.byteLength(content) > MAX_BYTES) throw new Error('History is too large to save another calculation.');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp', handle = await fs.open(temporary, 'w');
  try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
  try { await fs.copyFile(file, file + '.bak'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.rename(temporary, file);
  return entry;
}
module.exports = { snapshot, readHistory, appendHistory, LIMIT };
