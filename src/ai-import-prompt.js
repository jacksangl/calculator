'use strict';
const AI_IMPORT_PROMPT = String.raw`Convert the equations I provide (a PDF, notebook images, or a written description) into an importable Jotter JSON library. Read all provided material carefully. Preserve the intended math, grouping, variable meanings, and units. Ask me to clarify unreadable symbols, ambiguous grouping, missing relationships, or unsupported notation before producing the final file. Do not invent equations or silently change their meaning.

OUTPUT
Return a UTF-8 file named jotter.json if file creation is available. Otherwise return only the JSON text, without Markdown fences, comments, or surrounding prose, so I can save it as jotter.json. Use strict JSON: double-quoted keys and strings, no trailing commas, no undefined, NaN, or Infinity. The root must be an object with numeric "version": 1 and an "equations" array, not a bare array or a JSON string.

EQUATION SCHEMA
Each equations entry is an object with these fields:
- "id": an optional nonempty unique string of at most 100 characters. Omit it to let the app generate an ID, or supply a unique ID for every equation in the file. Never repeat an ID within a file.
- "name": required nonempty descriptive string, at most 150 characters. If the equation is an approximation (including a source written with an approximately-equal sign or an agreed approximate reformulation), explicitly include "(approximation)" in its name, for example "Small-angle sine (approximation)". Use the required single equals sign in formula, but never present an approximate relationship as exact.
- "subject": required, exactly "math", "ee" (Electrical Engineering), or "cs" (Computer Science). Select the closest subject; do not use its full display name.
- "klass": optional course/class name string, at most 100 characters. Use "" when unspecified. The key is "klass", not "class".
- "formula": required nonempty plain-math string, at most 3000 characters, with exactly one equals sign and a nonempty expression on each side.
- "vars": required array of at most 40 variable objects. Include every variable appearing anywhere in the formula exactly once, including variables on both sides and inside functions. Do not include unused variables, function names, or built-in constants. Keys are case-sensitive.

Each vars entry must include ALL of these fields, even when its optional display information is empty:
- "key": the exact formula variable name, at most 40 characters; match [A-Za-z][A-Za-z0-9_]*. Start with an ASCII letter, then letters, digits, or underscores only. No spaces, Greek characters, or subscripts in the key; translate them to names such as omega, theta, or V_out.
- "tex": LaTeX display string, at most 120 characters, or "" for automatic display. No dollar-sign delimiters. Escape every backslash in JSON: a display value for omega is written "\\omega" in the JSON file. LaTeX belongs here only, never in formula.
- "unit": unit label string, at most 40 characters, or "". Units are labels only: the app does not convert them. Keep quantities in consistent units and put any necessary conversion factors explicitly in the formula.
- "desc": variable description string, at most 200 characters, or "". Use this to clarify physical meaning or symbol renaming.
- "domain": exactly "real", "positive", "integer", or "complex". Use "real" unless the source requires another domain. "positive" means strictly greater than zero, "integer" restricts values to integers, and "complex" allows complex values. Do not invent assumptions that exclude valid solutions.

FORMULA NOTATION
- Use +, -, *, /, and ^ (or **) with explicit multiplication: 2*x, R*I, and (a+b)*(c+d), never 2x or adjacent parentheses for multiplication.
- Preserve grouping with parentheses. Square brackets may group a single expression, but are not arrays or indexing. Write (a+b)/(c+d) when the entire sums form the fraction.
- Use decimals with a dot, fractions such as 1/3, or scientific notation such as 1e-6. Do not append units to numeric literals or use thousands separators.
- Supported functions: sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, sqrt, exp, log, ln, abs, Abs. Functions take one argument, except log and ln also accept a second argument for the base. log(x) and ln(x) are natural logarithms; log(x, 10) is base 10. Trigonometric angles are in radians.
- Built-in constants: pi, e (Euler's number), and i (imaginary unit). These names and all supported function names are reserved, case-sensitive, and must not be variable keys. If the source uses i for electric current, rename it I or i_current throughout and explain it in desc. Use i for the imaginary unit, not an undeclared j.
- No LaTeX commands, Unicode math symbols in variable names, implicit multiplication, chained equalities, inequalities, matrices, vectors, indexing, piecewise expressions, derivatives, integrals, summation syntax, attributes, or arbitrary function calls. Ask for clarification or an agreed scalar/algebraic reformulation when needed; do not silently discard unsupported math.
- Represent each equation in a system as its own equations entry. Use matching variable keys only when they mean the same quantity; the app can combine equations later. Do not invent system/unknown/value fields or solve for a chosen unknown in the import file.
- Avoid overly large expressions: each side is limited to 300 parser AST nodes and nesting depth 40. Numeric literals must be at most 100 characters with magnitude at most 10^100; numeric exponents must be real and between -100 and 100. Ask before breaking a large expression into meaningful auxiliary equations.

VALID EXAMPLE
{
  "version": 1,
  "equations": [
    {
      "id": "ohms-law",
      "name": "Ohm's law",
      "subject": "ee",
      "klass": "Circuits",
      "formula": "V_out = I*R",
      "vars": [
        { "key": "V_out", "tex": "V_{out}", "unit": "V", "desc": "Voltage across the resistor", "domain": "real" },
        { "key": "I", "tex": "I", "unit": "A", "desc": "Current through the resistor", "domain": "real" },
        { "key": "R", "tex": "R", "unit": "ohm", "desc": "Resistance", "domain": "positive" }
      ]
    }
  ]
}

FINAL VALIDATION
Before responding, parse your output as JSON if you have tools. Check every field type, length, enum, unique ID, and exact match between formula variable names and vars keys. Verify the mathematical transcription against the source. Do not include the example unless it is actually requested. Limit each import file to 100 equations and 5,000,000 bytes; split larger collections into separately named version-1 JSON files. The app's total library limit is 500 equations. Import validates all equations before saving and merges with existing entries. An existing identical entry with the same ID is skipped; a different entry with a colliding ID receives a new ID, so importing does not update an existing equation. Reusing the same formulas with new IDs can create duplicates.

Now use the equations or source material I provide. If none is attached or described yet, ask me for it.`;
