// Run with: npx electron tests/ui-smoke.cjs
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const dir = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'equation-ui-'));
app.setPath('userData', dir);
// Let the promise report failures after window destruction and async cleanup.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  let win;
  try {
    const preload = path.join(dir, 'preload.cjs');
    await fs.writeFile(preload, `
      const { contextBridge } = require('electron');
      let equations = ['math', 'ee', 'cs'].map((subject, index) => ({ id: String(index), name: subject + ' equation', subject, klass: subject + ' class', formula: 'x=I_d+V_gs', vars: [{ key: 'x' }, { key: 'I_d' }, { key: 'V_gs', tex: 'V_{GS}' }] }));
      let choice = 'rename', inspections = 0;
      contextBridge.exposeInMainWorld('calculator', {
        load: async () => ({ equations }),
        inspect: async () => { inspections += 1; return { latex: ['x=1'], variables: [{ key: 'x' }] }; },
        inspections: () => inspections,
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
    assert.equal(await run('document.querySelector(".brand-logo")?.getAttribute("src")'), '../assets/jotter.svg');
    assert.equal(await run('document.querySelector(".brand-logo").complete && document.querySelector(".brand-logo").naturalWidth > 0'), true);
    assert.equal(await run('document.querySelectorAll(".library-item").length'), 3);
    assert.equal(await run('document.querySelectorAll(".subject").length'), 0);
    assert.equal(await run('document.querySelector("#class-filter").options.length'), 4);
    assert.equal(await run('getComputedStyle(document.querySelector("#class-filter")).appearance'), 'base-select');
    assert.equal(await run('getComputedStyle(document.querySelector("#solve-for")).appearance'), 'base-select');
    assert.equal(await run('document.querySelectorAll("#solve-for option .katex").length'), 3);
    assert.equal(await run('getComputedStyle(document.querySelector("#slot-0")).appearance'), 'base-select');
    assert.equal(await run('document.querySelectorAll("#slot-0 option .slot-formula .katex").length'), 3);
    assert.equal(await run('document.querySelector("#slot-0 option[value=\'1\']").getAttribute("aria-label")'), 'ee equation · Electrical Engineering');
    assert.equal(await run('document.querySelector("#solve-for option[value=I_d] annotation").textContent'), 'I_{d}');
    assert.equal(await run('document.querySelector("#solve-for option[value=V_gs] annotation").textContent'), 'V_{GS}');
    // The formula's LaTeX depends only on the equation, so changing the unknown must not re-inspect or flicker.
    assert.equal(await run('!!document.querySelector("#eq-formula .katex")'), true);
    const inspections = await run('window.calculator.inspections()');
    await run('document.querySelector("#solve-for").value = "V_gs"; document.querySelector("#solve-for").dispatchEvent(new Event("change"))');
    assert.equal(await run('document.querySelector("#solve-for selectedcontent annotation").textContent'), 'V_{GS}');
    assert.equal(await run('!!document.querySelector("#var-rows-I_d") && !document.querySelector("#var-rows-V_gs")'), true);
    assert.equal(await run('!!document.querySelector("#eq-formula .katex")'), true);
    assert.equal(await run('window.calculator.inspections()'), inspections);
    await win.webContents.executeJavaScript('document.querySelector("#solve-for").focus(); document.querySelector("#solve-for").showPicker()', true);
    assert.equal(await run('document.querySelector("#solve-for").matches(":open")'), true);
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'ESCAPE' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'ESCAPE' });
    await tick();
    assert.equal(await run('document.querySelector("#solve-for").matches(":open")'), false);
    assert.equal(await run('document.querySelector("#solve-for").value'), 'V_gs');
    await win.webContents.executeJavaScript('document.querySelector("#solve-for").showPicker()', true);
    for (const keyCode of ['UP', 'ENTER']) {
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode });
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode });
    }
    await tick();
    assert.equal(await run('document.querySelector("#solve-for").value'), 'I_d');
    assert.equal(await run('document.querySelector("#solve-for selectedcontent annotation").textContent'), 'I_{d}');
    // Switching equations renders cached LaTeX synchronously; the plain formula never shows in between.
    assert.equal(await run('document.querySelectorAll(".library-item")[1].click(); !!document.querySelector("#eq-formula .katex")'), true);
    assert.equal(await run('document.querySelectorAll(".library-item")[0].click(); !!document.querySelector("#eq-formula .katex")'), true);
    assert.equal(await run('window.calculator.inspections()'), inspections);
    await run('document.querySelector("#class-filter").value = "ee class"; document.querySelector("#class-filter").dispatchEvent(new Event("change"))');
    assert.equal(await run('document.querySelector(".library-item").textContent'), 'ee equationee class');
    assert.equal(await run('document.querySelector("#class-filter selectedcontent").textContent'), 'ee class');
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
    assert.equal(await run('document.querySelector("#toggle-sidebar").getAttribute("aria-label")'), 'Expand sidebar');
    await run('document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true }))');
    assert.equal(await run('document.querySelector("#library").hidden'), false);
    assert.equal(await run('document.querySelector("#toggle-sidebar").getAttribute("aria-label")'), 'Collapse sidebar');
    assert.equal(await run('document.activeElement.id'), 'search');
    await run('document.querySelector("#export").click()');
    await tick();
    assert.equal(await run('document.querySelector("#notice").hidden'), false);
    await run('document.querySelector("#dismiss-notice").click()');
    assert.equal(await run('document.querySelector("#notice").hidden'), true);
    await run('document.querySelector("#ai-import").focus(); document.querySelector("#ai-import").click()');
    assert.equal(await run('document.querySelector("#ai-import-dialog").open'), true);
    assert.equal(await run('document.querySelector("#ai-import-dialog").textContent.includes("EQUATION SCHEMA")'), false);
    await run('document.dispatchEvent(new KeyboardEvent("keydown", { key: "n", ctrlKey: true }))');
    assert.equal(await run('document.querySelector("#panel-editor").hidden'), true);
    await run('Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async text => { window.copiedPrompt = text; } }); document.querySelector("#copy-ai-prompt").click()');
    await tick();
    assert.equal(await run('document.querySelector("#copy-ai-prompt").textContent'), 'Copied');
    const prompt = await run('window.copiedPrompt');
    assert.match(prompt, /EQUATION SCHEMA/);
    const example = JSON.parse(prompt.split('VALID EXAMPLE\n')[1].split('\n\nFINAL VALIDATION')[0]);
    require('../electron/library.cjs').validateLibrary(example);
    await run('Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async () => { throw new Error("Denied"); } }); document.querySelector("#copy-ai-prompt").click()');
    await tick();
    assert.match(await run('document.querySelector("#ai-import-status").textContent'), /Could not copy/);
    await run('document.querySelector("#ai-import-dialog form button").click()');
    assert.equal(await run('document.querySelector("#ai-import-dialog").open'), false);
    assert.equal(await run('document.activeElement.id'), 'ai-import');
    console.log('UI smoke passed: LaTeX dropdowns, keyboard selection and dismissal, library controls, AI import dialog, copy success/failure, prompt schema, modal shortcuts and focus.');
  } finally {
    win?.destroy();
    await fs.rm(dir, { recursive: true, force: true });
  }
}).then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
