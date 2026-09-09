// Run with: npx electron tests/ui-smoke.cjs
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

app.whenReady().then(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'equation-ui-'));
  let win;
  try {
    const preload = path.join(dir, 'preload.cjs');
    await fs.writeFile(preload, `
      const { contextBridge } = require('electron');
      let equations = ['math', 'ee', 'cs'].map((subject, index) => ({ id: String(index), name: subject + ' equation', subject, klass: subject + ' class', formula: 'x=1', vars: [{ key: 'x' }] }));
      let choice = 'rename';
      contextBridge.exposeInMainWorld('calculator', {
        load: async () => ({ equations }),
        inspect: async () => ({ latex: ['x=1'], variables: [{ key: 'x' }] }),
        equationMenu: async () => { const result = choice; choice = 'delete'; return result; },
        save: async eq => { equations = equations.map(e => e.id === eq.id ? eq : e); return { equations }; },
        remove: async id => { equations = equations.filter(e => e.id !== id); return { equations }; },
        export: async () => true,
      });
    `);
    win = new BrowserWindow({ show: false, webPreferences: { preload, contextIsolation: true, sandbox: true } });
    await win.loadFile(path.join(__dirname, '../src/index.html'));
    const run = code => win.webContents.executeJavaScript(code);
    const tick = () => run('new Promise(resolve => setTimeout(resolve, 50))');
    await tick();
    assert.equal(await run('document.querySelectorAll(".library-item").length'), 3);
    assert.equal(await run('document.querySelectorAll(".subject").length'), 0);
    assert.equal(await run('document.querySelector("#class-filter").options.length'), 4);
    await run('document.querySelector("#class-filter").value = "ee class"; document.querySelector("#class-filter").dispatchEvent(new Event("change"))');
    assert.equal(await run('document.querySelector(".library-item").textContent'), 'ee equationee class');
    await run('document.querySelector(".library-item").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))');
    await tick();
    assert.equal(await run('document.querySelector("#rename-dialog").open'), true);
    await run('document.querySelector("#rename-name").value = "Renamed equation"; document.querySelector("#rename-form").requestSubmit()');
    await tick();
    assert.equal(await run('document.querySelector(".library-item span").textContent'), 'Renamed equation');
    await run('document.querySelector(".library-item").click(); document.querySelector(".library-item").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))');
    await tick();
    assert.equal(await run('document.querySelectorAll(".library-item").length'), 2);
    assert.equal(await run('document.querySelector("#eq-name").textContent'), 'math equation');
    await run('document.querySelector("#toggle-sidebar").click()');
    assert.equal(await run('document.querySelector("#library").hidden'), true);
    assert.equal(await run('document.querySelector("#toggle-sidebar").getAttribute("aria-expanded")'), 'false');
    await run('document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true }))');
    assert.equal(await run('document.querySelector("#library").hidden'), false);
    assert.equal(await run('document.activeElement.id'), 'search');
    await run('document.querySelector("#export").click()');
    await tick();
    assert.equal(await run('document.querySelector("#notice").hidden'), false);
    await run('document.querySelector("#dismiss-notice").click()');
    assert.equal(await run('document.querySelector("#notice").hidden'), true);
    console.log('UI smoke passed: all subjects, class filtering, rename, delete, sidebar, notifications.');
  } finally {
    win?.destroy();
    await fs.rm(dir, { recursive: true, force: true });
  }
}).then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
