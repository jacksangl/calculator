const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { statSync } = require('node:fs');
const { productName, version } = require('../package.json');

const root = path.resolve(__dirname, '..');
function fail(message) {
  console.error(message);
  process.exit(1);
}
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}

if (process.platform !== 'linux') fail('Build on Linux: the bundled Python solver cannot be cross-compiled. Use the Desktop builds GitHub Actions workflow.');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--installers')) fail('Usage: npm run build:linux [-- --installers] (builds for the host CPU architecture).');
const installers = args.includes('--installers');
const required = installers ? ['mksquashfs', 'dpkg', 'fakeroot', 'rpmbuild'] : ['mksquashfs'];
const missing = required.filter(command => spawnSync('which', [command], { stdio: 'ignore' }).status !== 0);
if (missing.length) fail(`Missing Linux build tools: ${missing.join(', ')}.\nInstall squashfs-tools (Arch: sudo pacman -S squashfs-tools; Ubuntu: sudo apt install squashfs-tools).\nFor --installers also install dpkg, fakeroot and rpm. See README.md.`);

console.log(`Building Linux ${process.arch}. For distribution, build on the oldest supported Linux release; an Arch build may not run on older Ubuntu. See README.md.`);
run(process.execPath, ['scripts/solver.cjs', 'setup']);
run(process.execPath, ['scripts/solver.cjs', 'build']);
const started = Date.now();
run(path.join(root, 'node_modules/.bin/electron-forge'), ['make', '--platform=linux', `--arch=${process.arch}`], {
  ...process.env, JOTTER_LINUX_INSTALLERS: installers ? '1' : '0',
});
const appImage = path.join(root, 'out/make/AppImage', process.arch, `${productName}-${version}-${process.arch}.AppImage`);
const zip = path.join(root, 'out/make/zip/linux', process.arch, `${productName}-linux-${process.arch}-${version}.zip`);
for (const artifact of [appImage, zip]) {
  const stat = statSync(artifact, { throwIfNoEntry: false });
  if (!stat || !stat.size || stat.mtimeMs < started) fail(`Forge exited without producing a fresh ${artifact}. Retry with Node.js 24 (the supported build version).`);
}
console.log(`Linux packages created in ${path.join(root, 'out/make')}`);
