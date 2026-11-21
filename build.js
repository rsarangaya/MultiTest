// Builds a PORTABLE Windows folder: SuperSlasher5000.exe next to an editable resources/app folder
// (asar is OFF on purpose, so the game's source stays loose and readable beside the exe).
const packager = require('@electron/packager');

packager({
  dir: '.',
  name: 'SuperSlasher5000',
  platform: 'win32',
  arch: 'x64',
  out: 'dist',
  overwrite: true,
  asar: false,
  ignore: [/^\/deadendtest/, /^\/dist/, /^\/\.claude/, /^\/BUILD EXE\.bat/, /^\/START HERE\.bat/, /^\/build\.js/, /^\/README/, /^\/package-lock\.json/],
}).then(paths => {
  console.log('\nBuilt: ' + paths.join('\n'));
  console.log('Run SuperSlasher5000.exe inside that folder. Game source is in resources\\app\\ (edit and relaunch, no rebuild needed).');
}).catch(err => { console.error('BUILD FAILED:', err); process.exit(1); });
