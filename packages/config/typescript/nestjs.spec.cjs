const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const ts = require('typescript');

const apiConfigPath = path.resolve(__dirname, '../../../apps/api/tsconfig.json');

test('a API usa a resolução moderna Node16 sem herdar node10', () => {
  const configFile = ts.readConfigFile(apiConfigPath, ts.sys.readFile);

  assert.equal(configFile.error, undefined);

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(apiConfigPath),
    undefined,
    apiConfigPath
  );

  assert.equal(parsedConfig.errors.length, 0);
  assert.equal(parsedConfig.options.module, ts.ModuleKind.Node16);
  assert.equal(parsedConfig.options.moduleResolution, ts.ModuleResolutionKind.Node16);
  assert.notEqual(parsedConfig.options.moduleResolution, ts.ModuleResolutionKind.Node10);
});
