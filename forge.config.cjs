const path = require('node:path');
module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'assets/jotter_icon'), // Packager selects .icns on macOS and .ico on Windows; Linux uses BrowserWindow's PNG.
    extraResource: [path.join(__dirname, 'build/solver/equation-solver')],
    ignore: [/^\/\.venv($|\/)/, /^\/build($|\/)/, /^\/tests($|\/)/, /^\/\.github($|\/)/, /^\/\.git($|\/)/],
  },
  makers: [{ name: '@electron-forge/maker-zip', platforms: ['darwin', 'win32', 'linux'] }],
};
