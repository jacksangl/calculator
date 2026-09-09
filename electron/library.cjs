const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const subjects = ['math', 'ee', 'cs'];
function string(value, name, max, optional = false) {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) throw new Error(`Invalid ${name}.`);
  return value.trim();
}
function validateEquation(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid equation.');
  if (!subjects.includes(input.subject)) throw new Error('Choose a subject.');
  if (!Array.isArray(input.vars) || input.vars.length > 40) throw new Error('Invalid variable list.');
  const vars = input.vars.map(v => {
    const key = string(v.key, 'variable name', 40);
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error('Invalid variable name.');
    if (!['real', 'positive', 'integer', 'complex'].includes(v.domain)) throw new Error('Invalid variable domain.');
    return { key, tex: string(v.tex, 'variable display', 120, true), unit: string(v.unit, 'unit', 40, true), desc: string(v.desc, 'description', 200, true), domain: v.domain };
  });
  if (new Set(vars.map(v => v.key)).size !== vars.length) throw new Error('Duplicate variable names.');
  return { id: string(input.id || randomUUID(), 'equation ID', 100), name: string(input.name, 'name', 150), subject: input.subject,
    klass: string(input.klass || '', 'class', 100, true), formula: string(input.formula, 'formula', 3000), vars };
}
function validateLibrary(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.equations) || data.equations.length > 500) throw new Error('Expected a version 1 Class Equations library with at most 500 equations.');
  const equations = data.equations.map(validateEquation);
  if (new Set(equations.map(e => e.id)).size !== equations.length) throw new Error('Duplicate equation IDs in library.');
  return { version: 1, equations };
}
async function readLibrary(file) {
  try {
    if ((await fs.stat(file)).size > 5_000_000) throw new Error('Library file is too large.');
    return validateLibrary(JSON.parse(await fs.readFile(file, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, equations: [] };
    throw new Error(`Cannot read the library; it has not been overwritten. ${error.message} A previous save may be available in library.json.bak.`);
  }
}
async function writeLibrary(file, data) {
  const library = validateLibrary(data);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp';
  const handle = await fs.open(temporary, 'w');
  try { await handle.writeFile(JSON.stringify(library, null, 2)); await handle.sync(); }
  finally { await handle.close(); }
  try { await fs.copyFile(file, file + '.bak'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.rename(temporary, file);
  return library;
}
module.exports = { validateEquation, validateLibrary, readLibrary, writeLibrary };
