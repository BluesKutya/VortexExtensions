const Bluebird = require('bluebird');
const path = require('path');
const winapi = require('winapi-bindings');
const { fs, log, types, util } = require('vortex-api');


const GAME_ID = 'citizensleeper'
const GAME_NAME = 'Citizen Sleeper'
const GAME_EXECUTE = 'Citizen Sleeper.exe'

const STEAMAPP_ID = '1578650';
const GOGAPP_ID = '1137446226';
//const XBOX_ID = '';
//const EPICAPP_ID = '';

const BIX_CONFIG = 'BepInEx.cfg';

function ensureBIXConfig(discovery) {
  const src = path.join(__dirname, BIX_CONFIG);
  const dest = path.join(discovery.path, 'BepInEx', 'config', BIX_CONFIG);
  return fs.ensureDirWritableAsync(path.dirname(dest))
    .then(() => fs.copyAsync(src, dest))
    .catch(err => {
      if (err.code !== 'EEXIST') {
        log('warn', 'failed to write BIX config', err);
      }
      // nop - this is a nice to have, not a must.
      return Bluebird.resolve();
    });
}

function findGame() {
  try {
    const instPath = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      'SOFTWARE\\WOW6432Node\\GOG.com\\Games\\' + GOGAPP_ID,
      'PATH');
    if (!instPath) {
      throw new Error('empty registry key');
    }
    return Bluebird.resolve(instPath.value);
  } catch (err) {
    return util.GameStoreHelper.findByAppId([STEAMAPP_ID, GOGAPP_ID])
      .then(game => game.gamePath);
  }
}

function modPath() {
  return path.join('BepInEx', 'plugins');
}

function prepareForModding(discovery) {
  if (discovery?.path === undefined) {
    return Bluebird.reject(new util.ProcessCanceled('Game not discovered'));
  }
  
  return ensureBIXConfig(discovery)
    .then(() => fs.ensureDirWritableAsync(path.join(discovery.path, 'BepInEx', 'plugins')));
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: GAME_NAME,
    mergeMods: true,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.jpg',
    executable: () => GAME_EXECUTE,
    requiredFiles: [
      GAME_EXECUTE,
      'UnityPlayer.dll',
    ],
    setup: prepareForModding,
  });
  
  context.once(() => {
    if (context.api.ext.bepinexAddGame !== undefined) {
      context.api.ext.bepinexAddGame({
        gameId: GAME_ID,
        autoDownloadBepInEx: true,
        doorstopConfig: {
          doorstopType: 'default',
          ignoreDisableSwitch: true,
        },
      });
    }
  });

  return true;
}

module.exports = {
  default: main,
};
