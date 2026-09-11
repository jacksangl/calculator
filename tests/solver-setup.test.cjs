const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

test('solver setup bootstraps missing pip before installing requirements', () => {
  const source = readFileSync(path.join(__dirname, '../scripts/solver.cjs'), 'utf8');
  for (const pipAvailable of [false, true]) {
    const calls = [];
    runInNewContext(source, {
      __dirname: path.join(__dirname, '../scripts'),
      process: { platform: process.platform, argv: ['node', 'solver.cjs', 'setup'] },
      require(name) {
        if (name === 'node:fs') return { existsSync: () => true };
        if (name === 'node:child_process') return {
          spawnSync(command, args) {
            calls.push({ command, args: Array.from(args) });
            return { status: args.includes('--version') && !pipAvailable ? 1 : 0 };
          },
        };
        return require(name);
      },
    });
    assert.deepEqual(calls.map(({ args }) => args), [
      ['-m', 'pip', '--version'],
      ...(!pipAvailable ? [['-m', 'ensurepip', '--upgrade']] : []),
      ['-m', 'pip', 'install', '-r', 'requirements.txt'],
    ]);
    assert.ok(calls.every(({ command }) => command === path.resolve(
      __dirname, '../.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
    )));
  }
});
