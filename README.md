# Jotter

An offline Electron equation notebook using the selected **B / Notebook** interface. Apple Silicon macOS is the primary target; Windows and Arch Linux use the same source. A and C were removed, and all three Claude Code Fable workers have finished.

## Run

The Apple Silicon application and ZIP are generated in `out/`. `npm run dmg` builds a drag-to-Applications disk image at `out/Jotter.dmg`; it is unsigned, so the first launch needs right-click → Open. Open `out/Jotter-darwin-arm64/Jotter.app`. Python is bundled in this application; you do not need to install it separately.

For development, install Node.js 24 and Python 3.12 or newer, then run:

```sh
npm ci
npm run setup:solver
npm start
```

On Arch, Node.js and Python are required for development; the packaged app includes its runtimes. The ZIP contains an executable named `jotter`. Build on the target operating system; PyInstaller cannot cross-compile its helper. Windows uses the same npm commands with Python on PATH.

## Add an equation

The library starts empty. No example equations are installed.

1. Click **Add equation**, enter a name, select a subject, and optionally enter a class.
2. Write the formula in plain mathematical notation with exactly one `=`. Use explicit `*`, `/`, `^`, and parentheses. The app generates the LaTeX preview; you do not need to write LaTeX for the formula.
3. Variables are detected automatically. Optional metadata includes a LaTeX display label, unit label, description, and a real/positive/integer/complex domain.
4. Check the preview and save. The equation appears in its subject library. You can edit or duplicate it later without code changes.
5. Select an equation, choose the unknown, enter known values, and solve. Fractions and scientific notation are accepted. Supported functions and reserved constants are listed in the editor.

Units are descriptive labels in this version. Supply mutually consistent units; the app does not convert or dimension-check them. Trigonometric inputs use radians.

## Systems

Select two to eight equations. Matching variable names are shared by default. Expand **Shared variables** to rename symbols that represent different quantities. Shared variables must have matching unit labels and domains. Select unknowns and enter the remaining values.

The app handles supported symbolic linear and nonlinear systems, checks finite answers by substitution into the original equations, and distinguishes no solution, free variables, conditional sets, and solver failure. It does not promise closed-form answers for every formula. Numerical mode needs a starting guess for each unknown and returns one verified root; other roots may exist. Each calculation has a 12-second timeout and can be cancelled.

The math engine starts with the app and stays warm. On the development Apple Silicon machine, a small linear-equation benchmark improved from about 219 ms per request with process startup to a 1.7 ms median with the persistent worker (12 requests with changing values; process round trip included, screen rendering excluded). More complex symbolic work still takes longer. Cancellation or a timeout stops the worker; the next request starts a fresh one.

## Library files

Equations are saved as versioned JSON in Electron's user-data folder:

- macOS: `~/Library/Application Support/Jotter/library.json`
- Windows: `%APPDATA%/Jotter/library.json`
- Linux: `~/.config/Jotter/library.json` (or your XDG config directory)

Saves write a temporary file before replacement and retain `library.json.bak`. Corrupt libraries are reported without being overwritten. To restore the previous save, quit the app, keep a copy of the damaged file, and copy the backup to `library.json`.

**Export** creates a portable JSON library. **Import** validates formulas and merges into the local library; different equations with colliding IDs are imported with new IDs, preserving existing equations. Exact duplicates are skipped. Import currently accepts at most 100 equations per file; the library limit is 500.

## Checks and packages

```sh
npm test
npm run make
```

The Node test runner checks parser restrictions, variable detection, exact rearrangement, linear/nonlinear systems, multiple roots, domains, zero denominators, numerical roots, cancellation, persistence, backups and corrupt-file handling. Test equations live only in tests, not the product library.

The optional GitHub Actions workflow builds ZIPs on macOS arm64, Windows and Linux. It is manually triggered and has not been run remotely. These initial builds are unsigned and not notarized. Windows and Arch runtime verification remains to be done on those machines.

`JOTTER_DATA_DIR` may point to a temporary directory for isolated development UI checks; it is ignored in packaged builds.

Keyboard shortcuts: Cmd/Ctrl+N adds an equation, Cmd/Ctrl+F searches, and Cmd/Ctrl+Enter saves or solves the current worksheet.

## Structure

- `src/`: the selected notebook interface; local KaTeX rendering.
- `electron/`: restricted IPC, local storage and solver process management.
- `solver/engine.py`: whitelisted expression parser and SymPy solving, without evaluating user code.

Ordinary equations live in library data. A new mathematical operation beyond the supported function list requires a small engine change and a regression check. There is no cloud service or automatic syncing.
