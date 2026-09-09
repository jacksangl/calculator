const path = require('node:path');
module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: [path.join(__dirname, 'build/solver/equation-solver')],
    ignore: [/^\/\.venv($|\/)/, /^\/mockups($|\/)/, /^\/build($|\/)/, /^\/tests($|\/)/, /^\/\.github($|\/)/, /^\/\.git($|\/)/],
  },
  makers: [{ name: '@electron-forge/maker-zip', platforms: ['darwin', 'win32', 'linux'] }],
};
