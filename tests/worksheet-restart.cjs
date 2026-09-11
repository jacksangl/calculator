// Launch separate Electron processes to verify on-disk persistence and close-time flushing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jotter-resume-'));
  const equation = (id, formula, keys) => ({ id, name: id, subject: 'math', klass: '', formula, vars: keys.map(key => ({ key, tex: '', unit: '', desc: '', domain: 'real' })) });
  fs.writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, equations: [equation('first', 'x=y', ['x', 'y']), equation('second', 'a=b*c', ['a', 'b', 'c'])] }));
  try {
    for (const phase of ['single', 'system', 'verify']) {
      const child = spawnSync(require('electron'), [__filename, phase], { env: { ...process.env, JOTTER_DATA_DIR: dir }, encoding: 'utf8', timeout: 30000 });
      assert.equal(child.status, 0, `${phase}: ${child.error || ''}\n${child.stdout}\n${child.stderr}`);
    }
    console.log('Worksheet restart passed: single inputs, system mappings, unknowns, numerical guesses, latest-only storage, clear values and close-time flush.');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
} else {
  const { app, BrowserWindow } = require('electron');
  require('../electron/main.cjs');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  app.whenReady().then(async () => {
    let win;
    while (!(win = BrowserWindow.getAllWindows()[0])) await sleep(10);
    win.hide();
    if (win.webContents.isLoading()) await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
    const run = code => win.webContents.executeJavaScript(code);
    while (!await run('worksheetReady')) await sleep(10);
    const phase = process.argv[2];
    if (phase === 'single') {
      await run(`
        selectEquation(byId('second'));
        state.unknown = 'c'; renderEquation();
        $('#var-rows-a').value = '12'; $('#var-rows-a').dispatchEvent(new Event('input'));
        $('#var-rows-b').value = '1/4'; $('#var-rows-b').dispatchEvent(new Event('input'));
        $('#single-numeric').click();
        $('#single-guesses input').value = '2'; $('#single-guesses input').dispatchEvent(new Event('input'));
      `);
    } else if (phase === 'system') {
      assert.equal(await run('$("#eq-name").textContent'), 'second');
      assert.equal(await run('$("#solve-for").value'), 'c');
      assert.equal(await run('$("#var-rows-a").value'), '12');
      assert.equal(await run('$("#var-rows-b").value'), '1/4');
      assert.equal(await run('$("#single-numeric").checked'), true);
      assert.equal(await run('$("#single-guesses input").value'), '2');
      assert.equal(await run('$("#single-result .answer-row")'), null);
      // Clear values is persisted, including when reloading before the debounce expires.
      await run('$("#clear-values").click()');
      await win.webContents.reload();
      await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
      while (!await run('worksheetReady')) await sleep(10);
      assert.equal(await run('$("#var-rows-a").value'), '');
      await run(`
        $('#tab-system').click();
        for (const [index, id] of ['first', 'second'].entries()) {
          const input = $('#slot-' + index); input.value = id; input.dispatchEvent(new Event('change'));
        }
        const mapping = $('#mappings input[aria-label="Equation 2 shared symbol for a"]');
        mapping.value = 'x'; mapping.dispatchEvent(new Event('change'));
        $('#unknown-list input[aria-label="Solve for x"]').click();
        for (const [key, value] of Object.entries({ y: '12', b: '3', c: '4' })) {
          const input = $('#system-vars-' + key); input.value = value; input.dispatchEvent(new Event('input'));
        }
        $('#system-numeric').click();
        $('#system-guesses input').value = '10'; $('#system-guesses input').dispatchEvent(new Event('input'));
      `);
    } else {
      assert.equal(await run('$("#panel-system").hidden'), false);
      assert.deepEqual(await run('$$("#slots select").map(input => input.value)'), ['first', 'second']);
      assert.equal(await run('$(\'#mappings input[aria-label="Equation 2 shared symbol for a"]\').value'), 'x');
      assert.equal(await run('$(\'#unknown-list input[aria-label="Solve for x"]\').checked'), true);
      assert.deepEqual(await run('$$("#system-vars input").map(input => input.value)'), ['12', '3', '4']);
      assert.equal(await run('$("#system-numeric").checked'), true);
      assert.equal(await run('$("#system-guesses input").value'), '10');
      const snapshots = await run('Object.values(localStorage)');
      assert.equal(snapshots.length, 1);
      assert.ok(snapshots[0].length < 1024);
      assert.equal(JSON.parse(snapshots[0]).mode, 'system');
      assert.equal(Object.hasOwn(JSON.parse(snapshots[0]), 'selected'), false);
    }
    // Normal shutdown invokes beforeunload, even if the debounce has not fired.
    app.quit();
  }).catch(error => { console.error(error); app.exit(1); });
}
