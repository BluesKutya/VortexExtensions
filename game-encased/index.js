const Bluebird = require('bluebird');
const path = require('path');
const winapi = require('winapi-bindings');
const { fs, log, types, util } = require('vortex-api');


const GAME_ID = 'encased'
const GAME_NAME = 'Encased'
const GAME_EXECUTE = 'Encased.exe'

const STEAMAPP_ID = '921800';
const GOGAPP_ID = '1988363275';
//const XBOX_ID = '';
//const EPICAPP_ID = '';

const BIX_CONFIG = 'BepInEx.cfg';

const BIX_RELEASE_ASSET = 'BepInEx_UnityIL2CPP_x64_6.0.0-pre.1.zip';

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

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

function unpackFileData(archivePath, targetDirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const sevenZip = new util.SevenZip();
        try {
            yield fs.ensureDirWritableAsync(targetDirPath);
            yield sevenZip.extractFull(archivePath, targetDirPath);
            return Bluebird.resolve();
        } catch (err) {
            return Bluebird.reject(err);
        }
    });
}

function main(context) {
  // Inform Vortex that your game extension requires the BepInEx extension.
  context.requireExtension('modtype-bepinex');
  
  context.registerGame({
    id: GAME_ID,
    name: GAME_NAME,
    mergeMods: true,
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'assets/gameart.jpg',
    executable: () => GAME_EXECUTE,
    requiredFiles: [
      GAME_EXECUTE,
      'UnityPlayer.dll'
    ],
    setup: prepareForModding,
  });
  
  context.once(() => {
    if (context.api.ext.bepinexAddGame !== undefined) {
      context.api.ext.bepinexAddGame({
        gameId: GAME_ID,
        autoDownloadBepInEx: false,
        doorstopConfig: {
          doorstopType: 'default',
          ignoreDisableSwitch: true,
        },
      });
      
      //unpack BepInEx
      let archivePath = path.join(__dirname, 'assets', BIX_RELEASE_ASSET);
      const state = context.api.store.getState();
      const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
      if (discovery !== undefined)
        unpackFileData(archivePath, discovery.path);
      
    }
  });
  
  return true;
}

module.exports = {
  default: main,
};
