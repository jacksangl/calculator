/* Notebook mockup — UI only. No solver, no persistence. */
(function () {
  'use strict';

  var SUBJECTS = { math: 'Math', ee: 'Electrical Engineering', cs: 'Computer Science' };

  // The only equation: the user's own rough draft, preserved literally.
  var LIBRARY = [
    {
      id: 'triode-draft',
      name: 'Triode current',
      subject: 'ee',
      klass: '',
      draft: true,
      latex: 'I_{DS,\\mathrm{triode}} = \\frac{1}{2} u_n C_{ox}\\frac{W}{L}(V_{GS}-V_{TN})V_{DS} - \\frac{1}{2}V_{DS}^{2}',
      vars: [
        { key: 'Ids',   tex: 'I_{DS}',     unit: 'A',    desc: 'Drain current' },
        { key: 'uncox', tex: 'u_n C_{ox}', unit: 'A/V²', desc: 'Process parameter (one value)' },
        { key: 'W',     tex: 'W',          unit: 'm',    desc: 'Channel width' },
        { key: 'L',     tex: 'L',          unit: 'm',    desc: 'Channel length' },
        { key: 'Vgs',   tex: 'V_{GS}',     unit: 'V',    desc: 'Gate–source voltage' },
        { key: 'Vtn',   tex: 'V_{TN}',     unit: 'V',    desc: 'Threshold voltage' },
        { key: 'Vds',   tex: 'V_{DS}',     unit: 'V',    desc: 'Drain–source voltage' }
      ]
    }
  ];

  var state = { subject: 'ee', selected: 'triode-draft', unknown: 'Vgs', values: {} };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function tex(el, src, display) {
    katex.render(src, el, { throwOnError: false, trust: false, displayMode: !!display });
  }
  function byId(id) { for (var i = 0; i < LIBRARY.length; i++) if (LIBRARY[i].id === id) return LIBRARY[i]; return null; }

  /* ---------- Subjects & library ---------- */
  function renderLibrary() {
    var list = $('#library-list'), items = LIBRARY.filter(function (e) { return e.subject === state.subject; });
    list.innerHTML = '';
    $('#library-title').textContent = SUBJECTS[state.subject];
    $('#library-count').textContent = items.length ? items.length + (items.length === 1 ? ' draft' : ' drafts') : '0';
    $('#library-empty').hidden = items.length > 0;
    items.forEach(function (e) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'library-item'; b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(e.id === state.selected));
      b.innerHTML = '<span></span><small></small>';
      b.firstChild.textContent = e.name;
      b.lastChild.textContent = (e.klass || 'No class') + (e.draft ? ' · draft' : '');
      b.addEventListener('click', function () { state.selected = e.id; state.unknown = e.vars[0] ? e.vars[0].key : null; if (e.id === 'triode-draft') state.unknown = 'Vgs'; renderLibrary(); renderEquation(); });
      li.appendChild(b); list.appendChild(li);
    });
    if (items.length && !items.some(function (e) { return e.id === state.selected; })) {
      state.selected = items[0].id; state.unknown = items[0].vars[0] ? items[0].vars[0].key : null; renderLibrary();
    }
    if (!items.length) state.selected = null;
  }

  $$('.subject').forEach(function (b) {
    b.addEventListener('click', function () {
      state.subject = b.dataset.subject;
      $$('.subject').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      renderLibrary(); renderEquation(); showTab('equation');
    });
  });

  /* ---------- Equation worksheet ---------- */
  function renderEquation() {
    var eq = byId(state.selected);
    $('#equation-sheet').hidden = !eq;
    $('#equation-empty').hidden = !!eq;
    if (!eq) { $('#empty-title').textContent = SUBJECTS[state.subject]; return; }

    $('#eq-subject').textContent = SUBJECTS[eq.subject];
    $('#eq-class').textContent = eq.klass || 'No class';
    $('#eq-name').textContent = eq.name;
    tex($('#eq-formula'), eq.latex, true);

    var sel = $('#solve-for'); sel.innerHTML = '';
    eq.vars.forEach(function (v) {
      var o = document.createElement('option'); o.value = v.key; o.textContent = v.key; sel.appendChild(o);
    });
    sel.value = state.unknown;

    var rows = $('#var-rows'); rows.innerHTML = '';
    eq.vars.forEach(function (v) {
      var unknown = v.key === state.unknown;
      var row = document.createElement('div');
      row.className = 'var-row' + (unknown ? ' is-unknown' : '');
      var sym = document.createElement('div'); sym.className = 'var-sym'; tex(sym, v.tex);
      var eqs = document.createElement('div'); eqs.className = 'var-eq'; eqs.textContent = '=';
      var cell = document.createElement('div');
      if (unknown) {
        cell.className = 'var-unknown'; cell.textContent = '? unknown · solve for this';
      } else {
        var inp = document.createElement('input');
        inp.type = 'text'; inp.inputMode = 'decimal'; inp.className = 'input';
        inp.id = 'var-' + v.key; inp.setAttribute('aria-label', v.key + (v.unit ? ' in ' + v.unit : ''));
        inp.value = state.values[eq.id + ':' + v.key] || '';
        inp.addEventListener('input', function () { state.values[eq.id + ':' + v.key] = inp.value; });
        cell.appendChild(inp);
      }
      var meta = document.createElement('div'); meta.className = 'var-meta';
      meta.textContent = (v.unit ? v.unit + ' · ' : '') + (v.desc || '');
      row.appendChild(sym); row.appendChild(eqs); row.appendChild(cell); row.appendChild(meta);
      rows.appendChild(row);
    });
  }
  $('#solve-for').addEventListener('change', function (e) { state.unknown = e.target.value; renderEquation(); });

  /* ---------- Tabs ---------- */
  function showTab(name) {
    $$('.tab').forEach(function (t) {
      var on = t.id === 'tab-' + name;
      t.setAttribute('aria-selected', String(on));
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  $$('.tab').forEach(function (t) { t.addEventListener('click', function () { showTab(t.id.replace('tab-', '')); }); });
  $$('[data-open-editor]').forEach(function (b) { b.addEventListener('click', function () { showTab('editor'); $('#ed-name').focus(); }); });

  /* ---------- System of equations ---------- */
  function renderSlots() {
    $$('.slot-select').forEach(function (sel) {
      var cur = sel.value; sel.innerHTML = '<option value="">Empty slot</option>';
      LIBRARY.forEach(function (e) {
        var o = document.createElement('option'); o.value = e.id;
        o.textContent = e.name + ' (' + SUBJECTS[e.subject] + (e.draft ? ', draft' : '') + ')';
        sel.appendChild(o);
      });
      sel.value = cur;
    });
  }
  function renderUnknowns() {
    var chosen = $$('.slot-select').map(function (s) { return byId(s.value); }).filter(Boolean);
    $$('.slot-select').forEach(function (s) {
      var p = $('[data-preview="' + s.dataset.slot + '"]'), e = byId(s.value);
      p.innerHTML = ''; if (e) tex(p, e.latex); else p.textContent = '';
    });
    var seen = {}, list = $('#unknown-list'); list.innerHTML = '';
    chosen.forEach(function (e) {
      e.vars.forEach(function (v) {
        if (seen[v.key]) return; seen[v.key] = true;
        var l = document.createElement('label');
        var c = document.createElement('input'); c.type = 'checkbox'; c.value = v.key;
        var s = document.createElement('span'); tex(s, v.tex);
        l.appendChild(c); l.appendChild(s); list.appendChild(l);
      });
    });
    $('#unknowns-empty').hidden = chosen.length > 0;
  }
  $$('.slot-select').forEach(function (s) { s.addEventListener('change', renderUnknowns); });

  /* ---------- Add equation editor ---------- */
  var edFormula = $('#ed-formula'), edPreview = $('#ed-preview'), edVars = $('#ed-vars tbody');
  edFormula.addEventListener('input', function () {
    var src = edFormula.value.trim();
    if (!src) { edPreview.innerHTML = '<span class="muted">Type a formula above to see it typeset here.</span>'; return; }
    tex(edPreview, src, true);
  });
  function addVarRow() {
    edVars.appendChild($('#var-row-tpl').content.cloneNode(true));
    var tr = edVars.lastElementChild;
    $('button', tr).addEventListener('click', function () { tr.remove(); });
    $('input', tr).focus();
  }
  $('#ed-add-var').addEventListener('click', addVarRow);

  $('#editor-form').addEventListener('reset', function () {
    setTimeout(function () { edVars.innerHTML = ''; edFormula.dispatchEvent(new Event('input')); }, 0);
  });
  $('#editor-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var vars = $$('tr', edVars).map(function (tr) {
      var i = $$('input', tr);
      return { key: i[0].value.trim(), tex: i[1].value.trim() || i[0].value.trim(), unit: i[2].value.trim(), desc: i[3].value.trim() };
    }).filter(function (v) { return v.key; });
    var eq = {
      id: 'draft-' + Date.now(), draft: true,
      name: $('#ed-name').value.trim(), subject: $('#ed-subject').value,
      klass: $('#ed-class').value.trim(), latex: edFormula.value.trim(), vars: vars
    };
    if (!eq.name || !eq.latex) return;
    LIBRARY.push(eq);
    state.subject = eq.subject; state.selected = eq.id; state.unknown = vars[0] ? vars[0].key : null;
    $$('.subject').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.subject === eq.subject)); });
    e.target.reset();
    renderLibrary(); renderEquation(); renderSlots(); showTab('equation');
  });

  /* ---------- Init ---------- */
  renderLibrary(); renderEquation(); renderSlots(); renderUnknowns();
})();
