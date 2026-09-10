const path = require('node:path');
module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'assets/jotter_icon'), // Packager selects .icns on macOS and .ico on Windows; Linux uses BrowserWindow's PNG.
    extraResource: [path.join(__dirname, 'build/solver/equation-solver')],
    ignore: [/^\/\.venv($|\/)/, /^\/build($|\/)/, /^\/tests($|\/)/, /^\/\.github($|\/)/, /^\/\.git($|\/)/],
  },
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['darwin', 'win32', 'linux'] },
    { name: '@reforged/maker-appimage', platforms: ['linux'], config: {
      options: { bin: 'Jotter', icon: path.join(__dirname, 'assets/jotter_icon.png'), categories: ['Education', 'Science'] },
    } },
    // Native installers are opt-in; AppImage/ZIP builds need neither dpkg nor rpmbuild.
    ...(process.env.JOTTER_LINUX_INSTALLERS === '1' ? [
      { name: '@electron-forge/maker-deb', platforms: ['linux'], config: {
        options: { bin: 'Jotter', icon: path.join(__dirname, 'assets/jotter_icon.png'), categories: ['Education', 'Science'] },
      } },
      { name: '@electron-forge/maker-rpm', platforms: ['linux'], config: {
        options: { bin: 'Jotter', icon: path.join(__dirname, 'assets/jotter_icon.png'), categories: ['Education', 'Science'] },
      } },
    ] : []),
  ],
};
