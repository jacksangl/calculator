const { app, BrowserWindow, ipcMain, dialog, Menu, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { SolverWorker } = require('./bridge.cjs');
const { snapshot, readHistory, appendHistory } = require('./history.cjs');
const { readLibrary, writeLibrary, validateEquation, validateLibrary } = require('./library.cjs');
let window, active, inspecting;
if (!app.isPackaged && process.env.JOTTER_DATA_DIR) app.setPath('userData', path.resolve(process.env.JOTTER_DATA_DIR));
const page = pathToFileURL(path.join(__dirname, '../src/index.html')).href;
const worker = new SolverWorker({ resources: app.isPackaged ? process.resourcesPath : undefined });
const solver = (request, options = {}) => worker.request(request, options);
const historyPath = () => path.join(app.getPath('userData'), 'history.json');
const libraryPath = () => path.join(app.getPath('userData'), 'library.json');
function migrateLegacyLibrary() {
  // ponytail: one-time copy from the pre-Jotter "Class Equations" data dir; delete this once nobody is upgrading from 0.1.0.
  const sync = require('node:fs'), legacy = path.join(app.getPath('userData'), '..', 'Class Equations', 'library.json');
  if (sync.existsSync(libraryPath()) || !sync.existsSync(legacy)) return;
  sync.mkdirSync(path.dirname(libraryPath()), { recursive: true });
  sync.copyFileSync(legacy, libraryPath());
}
let writes = Promise.resolve();
function mutate(work) {
  const next = writes.then(work);
  writes = next.catch(() => {});
  return next;
}
function handle(name, action) {
  ipcMain.handle(name, async (event, arg) => {
    if (event.senderFrame !== window?.webContents.mainFrame || event.senderFrame.url !== page) return { ok: false, error: 'Untrusted request.' };
    try { return { ok: true, data: await action(arg) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}
async function checkedEquation(input) {
  const eq = validateEquation(input);
  const metadata = Object.fromEntries(eq.vars.map(v => [v.key, v]));
  const inspected = await solver({ operation: 'inspect', equations: [eq.formula], metadata });
  if (inspected.variables.length !== eq.vars.length || inspected.variables.some(v => !metadata[v.key])) throw new Error('Variable fields must match the formula. Wait for its preview to update.');
  return eq;
}
handle('equation:menu', () => new Promise(resolve => {
  Menu.buildFromTemplate([
    { label: 'Rename…', click: () => resolve('rename') },
    { label: 'Delete', click: () => resolve('delete') },
  ]).popup({ window, callback: () => setImmediate(() => resolve(null)) });
}));
handle('history:load', async () => { await writes; return readHistory(historyPath()); });
handle('library:load', async () => { await writes; return readLibrary(libraryPath()); });
handle('library:save', input => mutate(async () => {
  const equation = await checkedEquation(input);
  const library = await readLibrary(libraryPath());
  const index = library.equations.findIndex(e => e.id === equation.id);
  if (index < 0) library.equations.push(equation); else library.equations[index] = equation;
  return writeLibrary(libraryPath(), library);
}));
handle('library:delete', id => mutate(async () => {
  const library = await readLibrary(libraryPath());
  const equation = library.equations.find(e => e.id === id);
  if (!equation) throw new Error('Equation not found.');
  const { response } = await dialog.showMessageBox(window, { type: 'question', buttons: ['Cancel', 'Delete equation'], defaultId: 0, cancelId: 0, message: `Delete “${equation.name}”?`, detail: 'A backup of the previous library is kept locally.' });
  if (response !== 1) return library;
  library.equations = library.equations.filter(e => e.id !== id);
  return writeLibrary(libraryPath(), library);
}));
handle('library:export', async () => {
  await writes;
  const data = await readLibrary(libraryPath());
  const { canceled, filePath } = await dialog.showSaveDialog(window, { defaultPath: 'jotter.json', filters: [{ name: 'Equation library', extensions: ['json'] }] });
  if (canceled) return false;
  if (path.resolve(filePath) === path.resolve(libraryPath())) throw new Error('Choose a separate export location.');
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  return true;
});
handle('library:import', () => mutate(async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'Equation library', extensions: ['json'] }] });
  if (canceled) return null;
  if ((await fs.stat(filePaths[0])).size > 5_000_000) throw new Error('Import is too large.');
  const imported = validateLibrary(JSON.parse(await fs.readFile(filePaths[0], 'utf8')));
  if (imported.equations.length > 100) throw new Error('Import at most 100 equations at a time.');
  for (const equation of imported.equations) await checkedEquation(equation);
  const library = await readLibrary(libraryPath());
  for (const equation of imported.equations) {
    const same = library.equations.find(e => e.id === equation.id);
    if (same && JSON.stringify(same) === JSON.stringify(equation)) continue;
    if (same) equation.id = require('node:crypto').randomUUID();
    library.equations.push(equation);
  }
  return writeLibrary(libraryPath(), library);
}));
handle('clipboard:write-text', text => {
  if (typeof text !== 'string') throw new Error('Clipboard content must be text.');
  clipboard.writeText(text);
  return true;
});
handle('equation:inspect', async input => {
  inspecting?.abort();
  const controller = inspecting = new AbortController();
  try { return await solver({ ...input, operation: 'inspect' }, { signal: controller.signal, timeout: 5000 }); }
  finally { if (inspecting === controller) inspecting = null; }
});
// Hover previews share the serial worker but never cancel the sheet's or editor's inspect.
handle('equation:preview', input => solver({ ...input, operation: 'inspect' }, { timeout: 5000 }));
handle('equation:solve', async input => {
  if (active) throw new Error('A calculation is already running.');
  const controller = active = new AbortController();
  try {
    const saved = input.history ? snapshot(input) : null;
    const result = await solver({ ...(saved ? saved.request : input), operation: 'solve' }, { signal: controller.signal });
    if (saved && result.status === 'solved' && !controller.signal.aborted) {
      try { result.historyEntry = await mutate(() => appendHistory(historyPath(), saved, result)); }
      catch (error) { result.historyError = `Calculation complete, but history could not be saved. ${error.message}`; }
    }
    return result;
  }
  finally { if (active === controller) active = null; }
});
handle('equation:cancel', () => { active?.abort(); return true; });
const appIcon = path.join(__dirname, `../assets/jotter_icon.${process.platform === 'win32' ? 'ico' : 'png'}`);
function createWindow() {
  window = new BrowserWindow({ width: 1320, height: 920, minWidth: 820, minHeight: 620, backgroundColor: '#f0eee9', title: 'Jotter', icon: appIcon,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== page) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_web, _permission, callback) => callback(false));
  window.on('closed', () => { active?.abort(); inspecting?.abort(); window = null; });
  window.loadURL(page);
}
app.whenReady().then(() => {
  if (process.platform === 'darwin' && !app.isPackaged) app.dock.setIcon(appIcon);
  migrateLegacyLibrary();
  worker.start();
  // Linux renders the application menu inside the window, above Jotter's toolbar.
  Menu.setApplicationMenu(process.platform === 'linux' ? null : Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { active?.abort(); inspecting?.abort(); worker.close(); });
