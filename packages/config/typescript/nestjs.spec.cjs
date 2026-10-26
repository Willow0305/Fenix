const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const ts = require('typescript');

const apiConfigPath = path.resolve(__dirname, '../../../apps/api/tsconfig.json');

// Node20/NodeNext: permite `require` de pacotes ESM (Nest 12), como o Node 24 (DT-055).
test('a API usa a resolução moderna Node20/NodeNext sem herdar node10', () => {
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
  assert.equal(parsedConfig.options.module, ts.ModuleKind.Node20);
  assert.equal(parsedConfig.options.moduleResolution, ts.ModuleResolutionKind.NodeNext);
  assert.notEqual(parsedConfig.options.moduleResolution, ts.ModuleResolutionKind.Node10);
});
