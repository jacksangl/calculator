'use strict';
const calculationHistory = (() => {
  const drawer = $('#history'), toggle = $('#history-toggle'), narrow = matchMedia('(max-width: 1100px)');
  let entries = [], loaded = false, loading = false, loadError = '';
  function syncOverlay() {
    const modal = !drawer.hidden && narrow.matches;
    $('#history-backdrop').hidden = !modal;
    $('#library').inert = modal; $('.page-wrap').inert = modal; $('.brand').inert = modal;
    drawer.setAttribute('role', modal ? 'dialog' : 'complementary');
    if (modal) drawer.setAttribute('aria-modal', 'true'); else drawer.removeAttribute('aria-modal');
    if (modal && !drawer.contains(document.activeElement)) $('#history-close').focus();
  }
  function toggleHistory(open = drawer.hidden) {
    drawer.hidden = !open;
    $('.workspace').classList.toggle('history-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    syncOverlay();
    (open ? $('#history-close') : toggle).focus();
    if (open) { if (!loaded && !loading) load(); else render(); }
  }
  function canReuse(entry) {
    return entry.equations.every(saved => {
      const current = byId(saved.id);
      return current && current.formula === saved.formula && JSON.stringify(current.vars) === JSON.stringify(saved.vars);
    });
  }
  function reuse(entry) {
    if (state.busy) return;
    if (!canReuse(entry)) { notify('The equation has changed or was removed. Its saved calculation is still available in History.'); return; }
    const system = entry.kind === 'system', prefix = system ? 'system' : 'single';
    $(`#${prefix}-numeric`).checked = entry.request.numeric;
    if (system) {
      state.slots = entry.equations.map(eq => eq.id);
      state.mappings = Object.fromEntries(entry.mappings.map((mapping, index) => [index, { ...mapping }]));
      state.systemUnknowns = new Set(entry.request.unknowns); state.systemValues = { ...entry.request.values };
      renderSlots(); showTab('system');
    } else {
      const eq = entry.equations[0];
      state.selected = eq.id; state.unknown = entry.request.unknowns[0]; state.values[eq.id] = { ...entry.request.values };
      renderLibrary(); renderEquation(); showTab('equation');
    }
    $(`#${prefix}-guesses`).querySelectorAll('input').forEach(input => input.value = entry.request.guesses[input.dataset.key] || '');
    showResult($(`#${prefix}-result`), entry.result, Object.values(entry.request.metadata));
    toggleHistory(false);
    notify('Previous calculation opened. Change values and solve to save a new result.');
  }
  const classes = entry => [...new Set(entry.equations.map(eq => eq.klass).filter(Boolean))];
  function dateGroup(iso) {
    const date = new Date(iso), now = new Date(), yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fillDetails(details, entry) {
    if (details.querySelector('.history-detail')) return;
    const box = node('div', 'history-detail');
    box.append(node('p', 'history-note', entry.request.numeric ? 'Numerical calculation' : 'Symbolic calculation'));
    entry.equations.forEach((eq, i) => {
      if (entry.kind === 'system') box.append(node('p', 'history-equation-name', eq.name));
      box.append(node('p', 'history-formula', entry.request.equations[i]));
    });
    const known = node('dl', 'history-known');
    Object.entries(entry.request.values).forEach(([key, value]) => {
      const v = entry.request.metadata[key], label = node('dt'); tex(label, v.tex || key);
      known.append(label, node('dd', '', [value, v.unit].filter(Boolean).join(' ')));
    });
    if (known.children.length) box.append(known); else box.append(node('p', 'history-note', 'No known values required.'));
    if (entry.request.numeric) {
      const guesses = node('dl', 'history-known');
      Object.entries(entry.request.guesses).forEach(([key, value]) => guesses.append(node('dt', '', `${key} guess`), node('dd', '', value)));
      box.append(guesses);
    }
    const result = node('div', 'history-answers'); showResult(result, entry.result, Object.values(entry.request.metadata)); box.append(result);
    if (canReuse(entry)) {
      const button = node('button', 'btn btn-ghost btn-sm history-reuse', 'Use these values');
      button.addEventListener('click', () => reuse(entry)); box.append(button);
    } else box.append(node('p', 'history-note', 'Equation changed or removed. This saved calculation is still available to read and copy.'));
    details.append(box);
  }
  function render() {
    const select = $('#history-filter'), filter = select.value;
    select.replaceChildren(option('', 'All classes'), ...[...new Set(entries.flatMap(classes))].sort().map(klass => option(klass, klass)));
    select.value = [...select.options].some(o => o.value === filter) ? filter : '';
    const visible = entries.filter(entry => !select.value || classes(entry).includes(select.value));
    const list = $('#history-list'), openIds = new Set([...list.querySelectorAll('details[open]')].map(item => item.dataset.id));
    const firstRender = !list.children.length;
    $('#history-count').textContent = String(entries.length);
    $('#history-count').setAttribute('aria-label', `${entries.length} saved calculations`);
    $('#history-status').textContent = loadError || (loading ? 'Loading history…' : !entries.length ? 'No calculations yet. Solve an equation to start your history.' : !visible.length ? 'No calculations for this class.' : '');
    $('#history-status').hidden = !$('#history-status').textContent;
    $('#history-retry').hidden = !loadError;
    if (drawer.hidden) return;
    const groups = new Map();
    visible.forEach(entry => {
      const label = dateGroup(entry.createdAt);
      if (!groups.has(label)) {
        const group = node('section', 'history-group'); group.append(node('h3', 'history-when', label)); groups.set(label, group);
      }
      const details = node('details', `history-item${entry.id === entries[0]?.id ? ' is-latest' : ''}`); details.dataset.id = entry.id;
      const summary = node('summary'), name = entry.kind === 'system' ? entry.equations.map(eq => eq.name).join(' + ') : entry.equations[0].name;
      const stamp = new Date(entry.createdAt), meta = node('span', 'history-meta', `${classes(entry).join(', ') || 'No class'} · ${stamp.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`);
      meta.title = stamp.toLocaleString();
      const result = node('span', 'history-result'), answers = entry.result.answers, value = answers[0].variables[0];
      if (answers.length > 1) result.textContent = `${answers.length} solutions`;
      else if (answers[0].variables.length > 1) result.textContent = `${answers[0].variables.length} values`;
      else {
        const v = entry.request.metadata[value.key];
        tex(result, `${v.tex || value.key} = ${value.latex}`);
        if (v.unit) result.append(node('span', 'history-unit', ` ${v.unit}`));
      }
      summary.append(node('span', 'history-name', name), meta, result); details.append(summary);
      details.addEventListener('toggle', () => { if (details.open) fillDetails(details, entry); });
      details.open = openIds.has(entry.id) || (firstRender && entry.id === visible[0]?.id);
      if (details.open) fillDetails(details, entry);
      groups.get(label).append(details);
    });
    list.replaceChildren(...groups.values());
  }
  async function load() {
    if (loading) return;
    loading = true; loadError = ''; render();
    try {
      const saved = await api.history();
      // A solve can finish while the initial read is in flight. Keep entries received meanwhile.
      entries = [...new Map([...entries, ...saved].map(entry => [entry.id, entry])).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500);
      loaded = true;
    } catch (error) { loadError = error.message; }
    finally { loading = false; render(); }
  }
  toggle.addEventListener('click', () => toggleHistory());
  $('#history-close').addEventListener('click', () => toggleHistory(false));
  $('#history-backdrop').addEventListener('click', () => toggleHistory(false));
  $('#history-filter').addEventListener('change', render);
  $('#history-retry').addEventListener('click', load);
  narrow.addEventListener('change', syncOverlay);
  document.addEventListener('keydown', event => {
    if (drawer.hidden || $('dialog[open]')) return;
    if (event.key === 'Escape') { event.preventDefault(); toggleHistory(false); }
    if (!narrow.matches) return;
    if (event.metaKey || event.ctrlKey) {
      if (['n', 'f', 'Enter'].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
    }
    if (event.key === 'Tab') {
      const controls = [...drawer.querySelectorAll('button, select, summary')].filter(e => !e.disabled && e.getClientRects().length);
      const index = controls.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && (index < 0 || index === controls.length - 1)) { event.preventDefault(); controls[0]?.focus(); }
    }
  }, true);
  if (api?.history) load(); else { loading = false; loadError = 'History is available in the Electron app.'; render(); }
  return { add(entry) { entries = [entry, ...entries.filter(item => item.id !== entry.id)].slice(0, 500); render(); } };
})();
