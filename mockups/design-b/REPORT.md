# Design B · Notebook

UI-only mockup. Open `index.html` over any static HTTP server from the `mockups/` root (KaTeX is loaded from `../vendor`).

## Layout
- Top bar: serif app name, three subject buttons (Math / Electrical Engineering / Computer Science) as horizontal navigation, "Add equation" on the right.
- Left 220px library margin listing the current subject's equations with class and draft label.
- Centered warm paper worksheet (860px max) with document tabs: **Equation**, **System of equations**, **Add equation**.
- Equation sheet: breadcrumb (subject / class), Georgia title, "Your draft · grouping unconfirmed" tag, full-width display-mode KaTeX formula, "Solve for" select, then one row per variable: typeset symbol `=` input, unit and description on the right.
- Warm monochrome palette, 1px borders, no gradients, system sans + Georgia + system mono, visible focus rings, reduced-motion support. Fits 1280x800 without scrolling for the draft equation.

## Interactive behaviour
- Subject buttons filter the library; Math and CS show an honest empty state with an "Add equation" button.
- Clicking a library item loads it into the sheet.
- "Solve for" changes the unknown; that row turns yellow, loses its input and reads "? unknown · solve for this". Default unknown is Vgs. All inputs start blank; typed values persist per equation while switching unknowns.
- Solve button is disabled with an explanatory note. Result box is an explicit empty state.
- System tab: three empty slots whose selects list library entries (only the draft exists). Choosing one shows its formula inline and lists its variables as unknown checkboxes. "Solve system" disabled, result empty.
- Add equation tab: name, subject, optional class, LaTeX formula with live KaTeX preview, variable table (key, display LaTeX, unit, description, remove). Submit adds the draft to the in-memory library and opens it. Labelled as preview / session-only.

## Deliberately omitted
- No solver, no calculation, no numeric results.
- No persistence, file I/O, API, Electron/Tauri scaffolding, Python.
- No equations other than the user's literal draft; `uncox` treated as one parameter shown as u_n C_ox.
