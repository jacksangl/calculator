# Jotter

An offline Electron equation notebook. Apple Silicon macOS is the primary target; Windows and Linux use the same source.

## Run

The Apple Silicon application and ZIP are generated in `out/`. `npm run dmg` builds a drag-to-Applications disk image at `out/Jotter.dmg`; it is unsigned, so the first launch needs right-click → Open. Open `out/Jotter-darwin-arm64/Jotter.app`. Python is bundled in this application; you do not need to install it separately.

For development, install Node.js 24 and Python 3.12 or newer, then run:

```sh
npm ci
npm run setup:solver
npm start
```

On Arch, Node.js and Python are required for development; the packaged app includes its runtimes. The Linux ZIP contains an executable named `Jotter`. Build on the target operating system; PyInstaller cannot cross-compile its helper. Windows uses the same npm commands with Python on PATH.

## Build for Linux

Install Node.js 24, Python 3.12 or newer, and the AppImage packaging tool:

```sh
# Arch / EndeavourOS / Omarchy
sudo pacman -S squashfs-tools

# Ubuntu / Debian (python3-venv enables Python virtual environments)
sudo apt install squashfs-tools python3-venv
```

Then build on Linux:

```sh
npm ci
npm run build:linux
```

Use Node.js 24 for packaging. With Node.js 26 on the development machine, Forge
exited during extraction without creating artifacts; `build:linux` detects this
instead of reporting a successful build.

This sets up and bundles the Python solver, then creates an AppImage in
`out/make/AppImage/<arch>/` and a ZIP in `out/make/zip/linux/<arch>/`.
Build tools and internet access are needed when building; end users do not need
Node.js or Python. Builds target the host CPU architecture; build separately on
an ARM64 machine for ARM64 users.

Run the AppImage with `chmod +x Jotter-*.AppImage` followed by
`./Jotter-<version>-<arch>.AppImage`. If mounting is unavailable, try
`./Jotter-<version>-<arch>.AppImage --appimage-extract-and-run`, or extract the
ZIP and run `./Jotter` from its directory. A graphical Linux desktop and Electron's
system libraries are still required. Keep Chromium's sandbox enabled; systems
that restrict unprivileged user namespaces may need an administrator-provided
AppArmor policy or a native installation with a correctly configured sandbox.

For optional Ubuntu/Debian and Fedora/RHEL-family installers:

```sh
# Ubuntu build machine
sudo apt install dpkg fakeroot rpm
npm run build:linux -- --installers
```

That produces DEB and RPM files as well as AppImage and ZIP. On Arch, the
corresponding build packages are `dpkg`, `fakeroot`, and `rpm-tools`.
Arch users should use AppImage or ZIP, not DEB/RPM.

### Distribution compatibility

AppImage is the common download format, but it does not make every Linux
installation compatible. In particular, [PyInstaller does not bundle glibc](https://pyinstaller.org/en/stable/usage.html#making-gnu-linux-apps-forward-compatible).
A solver built on rolling-release Arch can require a newer glibc than Ubuntu has.
For shared releases, use the **Desktop builds** workflow (Ubuntu 22.04 baseline),
or build in an Ubuntu 22.04 VM with Python 3.12 and Node.js 24. This targets Ubuntu
22.04 and newer and recent glibc-based distributions, including Arch; it is a
compatibility target, not a guarantee until tested on each distribution.

Older distributions, Alpine/musl, different CPU architectures, missing desktop
libraries, and sandbox policies can require separate work. For broader runtime
consistency, a future Flatpak package could provide a shared runtime; that is not
implemented here. Changing to DEB/RPM alone does not fix glibc compatibility.

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

Jotter automatically resumes the last equation or system worksheet when reopened,
including unknowns, shared-variable mappings, entered values, and numerical starting
guesses. It keeps one local snapshot, replacing it after 300 ms without changes and
on normal window close. Only the last-used worksheet is kept across restarts;
results are recalculated when you press Solve. Editor drafts are not included.

The snapshot lives in Electron's local storage and is capped at 128 KiB of text
(the storage engine has additional overhead). It stores equation IDs, not copies
of the library, with no history or queue. Removed equations and obsolete variable
fields are discarded on restore. If a worksheet exceeds the cap, its snapshot is
cleared and a notice appears; equation-library saves remain independent.

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

`npm run test:app` starts with a UI smoke test with a stubbed bridge, then `tests/app-e2e.cjs`, which boots `electron/main.cjs` with a temporary library, solves single equations (linear, multiple roots, numerical), saves an equation through the editor, and solves linear, inconsistent, nonlinear, numerical and renamed-variable systems through the real IPC bridge and SymPy worker. It needs a display; on a Linux desktop without one in the shell, run it with `DISPLAY=:0`.

It also runs `tests/worksheet-restart.cjs`, which launches three separate app
processes with temporary storage to check worksheet recovery after quitting,
including numerical guesses, renamed system variables, and cleared values.

The Node test runner checks parser restrictions, variable detection, exact rearrangement, linear/nonlinear systems, multiple roots, domains, zero denominators, numerical roots, cancellation, persistence, backups and corrupt-file handling. Test equations live only in tests, not the product library.

The manually triggered **Desktop builds** GitHub Actions workflow builds ZIPs on macOS arm64 and Windows, and AppImage, ZIP, DEB and RPM artifacts on Ubuntu 22.04 x64. These builds are unsigned and not notarized. The updated workflow still needs a remote run; cross-distribution runtime verification is not yet complete.

`JOTTER_DATA_DIR` may point to a temporary directory for isolated development UI checks; it is ignored in packaged builds.

Keyboard shortcuts: Cmd/Ctrl+N adds an equation, Cmd/Ctrl+F searches, and Cmd/Ctrl+Enter saves or solves the current worksheet.

## Structure

- `src/`: the notebook interface; local KaTeX rendering.
- `electron/`: restricted IPC, local storage and solver process management.
- `solver/engine.py`: whitelisted expression parser and SymPy solving, without evaluating user code.

Ordinary equations live in library data. A new mathematical operation beyond the supported function list requires a small engine change and a regression check. There is no cloud service or automatic syncing.
