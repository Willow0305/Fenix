import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextCli = path.join(repositoryRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const processes = [];

function startNode(args, environment) {
  const child = spawn(process.execPath, args, {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ...environment
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  const output = [];

  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));
  processes.push({
    child,
    output
  });

  return {
    child,
    output
  };
}

async function waitForResponse(url, validate, processState) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (processState.child.exitCode !== null) {
      throw new Error(
        `Processo encerrou antes de responder em ${url}.\n${processState.output.join('').slice(-2000)}`
      );
    }

    try {
      const response = await fetch(url);

      if (response.ok && (await validate(response))) {
        return response.status;
      }
    } catch {
      // O processo ainda pode estar inicializando.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Tempo excedido ao consultar ${url}.`);
}

async function stopProcess(processState) {
  if (processState.child.exitCode !== null) {
    return;
  }

  processState.child.kill();
  await Promise.race([
    new Promise((resolve) => processState.child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000))
  ]);

  if (processState.child.exitCode === null) {
    processState.child.kill('SIGKILL');
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

async function run() {
  const api = startNode(['apps/api/dist/main.js'], {
    API_PORT: '3333',
    NODE_ENV: 'test'
  });
  const web = startNode([nextCli, 'start', 'apps/web', '--port', '3000'], {
    NODE_ENV: 'production'
  });

  const healthStatus = await waitForResponse(
    'http://localhost:3333/health',
    async (response) => {
      const payload = await response.json();

      return isRecord(payload) && payload['service'] === 'fenix-api' && payload['status'] === 'ok';
    },
    api
  );
  const swaggerStatus = await waitForResponse(
    'http://localhost:3333/docs',
    async (response) => (await response.text()).includes('swagger-ui'),
    api
  );
  const openApiStatus = await waitForResponse(
    'http://localhost:3333/docs/openapi.json',
    async (response) => {
      const payload = await response.json();

      return isRecord(payload) && typeof payload['openapi'] === 'string';
    },
    api
  );
  const webStatus = await waitForResponse(
    'http://localhost:3000',
    async (response) => (await response.text()).includes('Fênix Vôlei'),
    web
  );

  console.log(
    `web=${webStatus} health=${healthStatus} swagger=${swaggerStatus} openapi=${openApiStatus}`
  );
}

try {
  await run();
} finally {
  await Promise.all(processes.map(stopProcess));
}
