const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const ts = require('typescript');

const libraryConfigs = [
  {
    name: '@fenix/types',
    path: path.resolve(__dirname, '../../types/tsconfig.json')
  },
  {
    name: '@fenix/ui',
    path: path.resolve(__dirname, '../../ui/tsconfig.json')
  },
  {
    name: '@fenix/validation',
    path: path.resolve(__dirname, '../../validation/tsconfig.json')
  }
];

for (const libraryConfig of libraryConfigs) {
  test(`${libraryConfig.name} usa a resolução moderna Node16 sem herdar node10`, () => {
    const configFile = ts.readConfigFile(libraryConfig.path, ts.sys.readFile);

    assert.equal(configFile.error, undefined);

    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(libraryConfig.path),
      undefined,
      libraryConfig.path
    );

    assert.equal(parsedConfig.errors.length, 0);
    assert.equal(parsedConfig.options.module, ts.ModuleKind.Node16);
    assert.equal(parsedConfig.options.moduleResolution, ts.ModuleResolutionKind.Node16);
    assert.notEqual(parsedConfig.options.moduleResolution, ts.ModuleResolutionKind.Node10);
  });
}
