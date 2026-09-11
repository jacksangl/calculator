'use strict';

// One replaceable snapshot, never a calculation history. The limit counts UTF-16
// code units conservatively as two bytes each; Electron's storage has overhead.
const Worksheet = (() => {
  const key = 'jotter.lastWorksheet.v1';
  const maxLength = 64 * 1024; // At most 128 KiB of snapshot text.
  const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const fields = (value, keys, limit = 200) => Object.fromEntries(keys.flatMap(key => {
    const text = record(value)[key];
    return typeof text === 'string' && text.length <= limit && text ? [[key, text]] : [];
  }));

  function normalize(data, library) {
    if (!data || data.version !== 1) return null;
    const base = { version: 1, mode: data.mode, numeric: data.numeric === true };
    if (data.mode === 'equation') {
      const equation = library.find(eq => eq.id === data.selected);
      if (!equation) return null;
      const keys = equation.vars.map(v => v.key);
      const unknown = keys.includes(data.unknown) ? data.unknown : keys[0] || null;
      return { ...base, selected: equation.id, unknown, values: fields(data.values, keys), guesses: fields(data.guesses, [unknown].filter(Boolean)) };
    }
    if (data.mode !== 'system' || !Array.isArray(data.slots)) return null;
    const slots = data.slots.slice(0, 8).map(id => library.some(eq => eq.id === id) ? id : '');
    while (slots.length < 2) slots.push('');
    const mappings = {}, keys = new Set();
    slots.forEach((id, index) => {
      const variables = library.find(eq => eq.id === id)?.vars || [];
      mappings[index] = fields(record(data.mappings)[index], variables.map(v => v.key), 40);
      variables.forEach(v => keys.add(mappings[index][v.key] || v.key));
    });
    const unknowns = [...new Set(Array.isArray(data.unknowns) ? data.unknowns.filter(key => keys.has(key)) : [])];
    return { ...base, slots, mappings, unknowns, values: fields(data.values, [...keys]), guesses: fields(data.guesses, unknowns) };
  }

  function read(storage, library) {
    try {
      const text = storage.getItem(key);
      if (!text || text.length > maxLength) return null;
      return normalize(JSON.parse(text), library);
    } catch { return null; } // A damaged cache must never prevent library access.
  }

  function write(storage, data, library) {
    const snapshot = normalize(data, library);
    if (!snapshot) { storage.removeItem(key); return; }
    const text = JSON.stringify(snapshot);
    if (text.length > maxLength) {
      storage.removeItem(key);
      throw new Error('This worksheet is too large to remember across restarts. Your equation library is still saved.');
    }
    if (storage.getItem(key) !== text) storage.setItem(key, text);
  }
  return { read, write };
})();
if (typeof module !== 'undefined') module.exports = Worksheet;
