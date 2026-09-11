const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (process.argv[2] === 'setup') {
  if (!existsSync(python)) run(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'venv', '.venv']);
  if (spawnSync(python, ['-m', 'pip', '--version'], { stdio: 'ignore' }).status !== 0) {
    run(python, ['-m', 'ensurepip', '--upgrade']);
  }
  run(python, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
} else {
  if (!existsSync(python)) throw new Error('Run npm run setup:solver first.');
  run(python, ['-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--name', 'equation-solver',
    '--distpath', 'build/solver', '--workpath', 'build/pyinstaller', '--specpath', 'build', 'solver/engine.py']);
}
