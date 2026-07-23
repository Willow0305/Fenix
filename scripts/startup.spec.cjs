const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');

test('o frontend usa a variável PORT sem expansão dependente do shell', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
  );
  const environmentExample = fs.readFileSync(path.join(repositoryRoot, '.env.example'), 'utf8');

  assert.equal(
    packageJson.scripts['dev:web'],
    'dotenv -e .env -- npm run dev --workspace=@fenix/web'
  );
  assert.match(environmentExample, /^PORT=3000$/m);
  assert.doesNotMatch(environmentExample, /^WEB_PORT=/m);
});
