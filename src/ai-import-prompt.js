'use strict';
const AI_IMPORT_PROMPT = String.raw`Convert my source equations into a Jotter JSON library. Preserve the math, units, and conditions; label approximations in the name. Ask if the source is missing, ambiguous, or unsupported. Otherwise return only a complete jotter.json file (UTF-8, no BOM), or raw JSON without Markdown or commentary.

EQUATION SCHEMA
Use the example's structure. Each equation needs name, subject (math/ee/cs), klass ("" if unknown), formula, and vars. Omit IDs to generate them automatically. Every variable on either side must appear exactly once in vars, with all five fields shown below. Use "" for unknown display text, units, or descriptions. Domain: real by default; positive (strictly >0), integer, or complex only when appropriate.

FORMULA RULES
- Exactly one =, expressions on both sides, explicit multiplication (*), parentheses for grouping, / for division, ^ for powers. Example: y = (a+b)/(2*c). No LaTeX in formulas.
- Variable keys: ASCII letters followed by letters/digits/underscores. Avoid Python keywords (rename lambda to lambda_value). Constants pi, e, i and function names are reserved; rename current i to I. Other physical constants need declared variables or source-supported numeric values.
- Functions: sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, sqrt, exp, log, ln, abs, Abs. One argument each; log/ln optionally take a base. Default logs are natural; angles are radians.
- No implicit multiplication, indexing, vectors, matrices, calculus, sums, inequalities, or arbitrary functions. Ask before reformulating unsupported math.
- Units are labels, with no automatic conversion. Use consistent units. Shared quantities across separate equations must have matching keys, unit labels, and domains.
- tex is optional LaTeX display content: use "" or JSON-escaped backslashes as shown below, without dollar signs.
- Character limits: name 150, klass 100, formula 3000, key 40, tex 120, unit 40, desc 200. At most 40 variables per equation. Keep expressions small; numeric literals <=100 characters and magnitude <=10^100, numeric exponents between -100 and 100.

VALID EXAMPLE
{
  "version": 1,
  "equations": [{
    "name": "Capacitor impedance",
    "subject": "ee",
    "klass": "Circuits",
    "formula": "Z = 1/(i*omega*C)",
    "vars": [
      {"key": "Z", "tex": "", "unit": "ohm", "desc": "Impedance", "domain": "complex"},
      {"key": "omega", "tex": "\\omega", "unit": "rad/s", "desc": "Angular frequency", "domain": "positive"},
      {"key": "C", "tex": "", "unit": "F", "desc": "Capacitance", "domain": "positive"}
    ]
  }]
}

FINAL VALIDATION
Check JSON syntax (parse it if tools are available), required fields, limits, formula/variable agreement, and fidelity to the source. No comments, trailing commas, placeholders, or extra fields. Replace the example with my equations. Maximum 100 equations and 5 MB per file; split larger outputs into complete files, never truncate. For text-only output, return one batch per response. Library capacity is 500 equations.`;
