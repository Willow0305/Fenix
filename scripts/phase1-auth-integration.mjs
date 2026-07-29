import { createHmac, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiPort = 3341;
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const smtpPort = 1125;
const processes = [];
const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let accumulator = 0;
  let bits = 0;
  const bytes = [];

  for (const character of value.toUpperCase()) {
    accumulator = (accumulator << 5) | alphabet.indexOf(character);
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >>> bits) & 255);
    }
  }

  return Buffer.from(bytes);
}

function createTotp(secret) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = (digest.at(-1) ?? 0) & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;

  return String(binary % 1_000_000).padStart(6, '0');
}

function createSmtpServer(messages) {
  return net.createServer((socket) => {
    let buffer = '';
    let readingData = false;
    let message = '';

    socket.write('220 fenix-test ESMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += String(chunk);

      while (buffer.includes('\r\n')) {
        const lineEnd = buffer.indexOf('\r\n');
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);

        if (readingData) {
          if (line === '.') {
            messages.push(message);
            message = '';
            readingData = false;
            socket.write('250 message accepted\r\n');
          } else {
            message += `${line}\n`;
          }
          continue;
        }

        if (/^(EHLO|HELO)\b/iu.test(line)) {
          socket.write('250-fenix-test\r\n250 SIZE 1048576\r\n');
        } else if (/^(MAIL FROM|RCPT TO)\b/iu.test(line)) {
          socket.write('250 ok\r\n');
        } else if (line === 'DATA') {
          readingData = true;
          socket.write('354 end with .\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 bye\r\n');
        } else {
          socket.write('250 ok\r\n');
        }
      }
    });
  });
}

function startProcess(args, environment) {
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
  processes.push({ child, output });

  return { child, output };
}

async function waitForExit(processState) {
  const exitCode = await new Promise((resolve) => processState.child.once('exit', resolve));

  if (exitCode !== 0) {
    throw new Error(`Processo de preparação falhou.\n${processState.output.join('').slice(-1000)}`);
  }
}

async function waitForHealth(processState) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (processState.child.exitCode !== null) {
      throw new Error(
        `API encerrou antes do health.\n${processState.output.join('').slice(-1000)}`
      );
    }

    try {
      const response = await fetch(`${apiBaseUrl}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Inicialização ainda em andamento.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Tempo excedido ao iniciar a API de integração.');
}

function updateCookieJar(response, jar) {
  for (const value of response.headers.getSetCookie()) {
    const [pair] = value.split(';');
    const separator = pair.indexOf('=');
    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);

    if (cookieValue === '') {
      jar.delete(name);
    } else {
      jar.set(name, cookieValue);
    }
  }
}

async function apiRequest(pathname, options = {}) {
  const { jar = new Map(), csrf = true, expectedStatus = 200, ...init } = options;
  const headers = new Headers(init.headers);
  const method = (init.method ?? 'GET').toUpperCase();

  if (jar.size > 0) {
    headers.set('Cookie', [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; '));
  }

  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method) && jar.has('fenix_csrf')) {
    headers.set('X-CSRF-Token', jar.get('fenix_csrf'));
  }

  const response = await fetch(`${apiBaseUrl}/api/v1${pathname}`, {
    ...init,
    headers
  });

  updateCookieJar(response, jar);
  assert(
    response.status === expectedStatus,
    `${method} ${pathname}: esperado ${expectedStatus}, recebido ${response.status}.`
  );

  if (response.status === 204) {
    return { jar, response, body: undefined };
  }

  return { jar, response, body: await response.json() };
}

async function loginWithSecondFactor(email, password, jar, code) {
  const firstStep = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    jar,
    csrf: false
  });

  if (firstStep.body.status !== 'MFA_REQUIRED') {
    return firstStep;
  }

  assert(code, 'O login exigiu MFA sem código de teste disponível.');

  return apiRequest('/auth/mfa/challenge', {
    method: 'POST',
    body: JSON.stringify({
      challengeToken: firstStep.body.challengeToken,
      code
    }),
    jar,
    csrf: false
  });
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

async function run() {
  assert(process.env['DATABASE_URL'], 'DATABASE_URL é obrigatória para o teste de integração.');

  const smtpMessages = [];
  const smtpServer = createSmtpServer(smtpMessages);
  await new Promise((resolve, reject) => {
    smtpServer.once('error', reject);
    smtpServer.listen(smtpPort, '127.0.0.1', resolve);
  });

  const sharedEnvironment = {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    AUTH_ACCESS_TOKEN_SECRET: randomBytes(48).toString('base64url'),
    AUTH_TOKEN_PEPPER: randomBytes(48).toString('base64url'),
    AUTH_CONTEXT_HASH_PEPPER: randomBytes(48).toString('base64url'),
    AUTH_BCRYPT_COST: '10',
    AUTH_INACTIVITY_MINUTES: '5',
    AUTH_SESSION_ABSOLUTE_DAYS: '30',
    AUTH_MAX_LOGIN_ATTEMPTS: '5',
    AUTH_LOGIN_BLOCK_MINUTES: '15',
    AUTH_RECOVERY_CODE_MINUTES: '10',
    AUTH_RECOVERY_CODE_LENGTH: '6',
    AUTH_MFA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    AUTH_MFA_KEY_VERSION: 'integration-v1',
    RATE_LIMIT_LOGIN_MAX: '100',
    RATE_LIMIT_CODE_VALIDATION_MAX: '100',
    RATE_LIMIT_EMAIL_RESEND_MAX: '50',
    RATE_LIMIT_MFA_MAX: '100',
    RATE_LIMIT_REFRESH_MAX: '300',
    RATE_LIMIT_ADMIN_SENSITIVE_MAX: '500',
    REDIS_URL: 'redis://127.0.0.1:6379',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtpPort),
    SMTP_FROM: 'no-reply@fenix.test'
  };
  const initialPassword = `A-${randomBytes(18).toString('base64url')}`;
  const newPassword = `B-${randomBytes(18).toString('base64url')}`;
  const commonPassword = `C-${randomBytes(18).toString('base64url')}`;

  try {
    await waitForExit(
      startProcess(['apps/api/dist/bootstrap-admin.js'], {
        ...sharedEnvironment,
        BOOTSTRAP_ADMIN_NAME: 'Administrador de Integração',
        BOOTSTRAP_ADMIN_EMAIL: 'admin.integration@example.test',
        BOOTSTRAP_ADMIN_PASSWORD: initialPassword
      })
    );

    const api = startProcess(['apps/api/dist/main.js'], {
      ...sharedEnvironment,
      API_PORT: String(apiPort),
      CORS_ORIGINS: 'http://localhost:3000'
    });
    await waitForHealth(api);

    await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin.integration@example.test',
        password: 'senha-incorreta'
      }),
      expectedStatus: 401,
      csrf: false
    });

    const adminJar = new Map();
    const adminLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin.integration@example.test',
        password: initialPassword
      }),
      jar: adminJar,
      csrf: false
    });
    assert(adminLogin.body.user.roles.includes('ADMIN'), 'Bootstrap não atribuiu ADMIN.');
    assert(!adminLogin.body.user.password, 'Resposta de login expôs senha.');
    assert(
      adminLogin.body.user.mfaEnrollmentRequired,
      'ADMIN deveria exigir configuração inicial de MFA.'
    );

    await apiRequest('/users?limit=10', {
      jar: adminJar,
      expectedStatus: 403
    });
    const enrollment = await apiRequest('/auth/mfa/enrollment', {
      method: 'POST',
      jar: adminJar,
      expectedStatus: 201
    });
    assert(enrollment.body.secret, 'Configuração MFA não retornou segredo temporário.');
    const mfaConfirmation = await apiRequest('/auth/mfa/enrollment/confirm', {
      method: 'POST',
      body: JSON.stringify({ code: createTotp(enrollment.body.secret) }),
      jar: adminJar,
      expectedStatus: 201
    });
    const adminRecoveryCodes = [...mfaConfirmation.body.recoveryCodes];
    assert(adminRecoveryCodes.length >= 8, 'Códigos de recuperação MFA não foram gerados.');

    await apiRequest('/auth/me', { jar: adminJar });
    await apiRequest(`/users/${adminLogin.body.user.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'INACTIVE' }),
      jar: adminJar,
      expectedStatus: 409
    });
    await apiRequest(`/users/${adminLogin.body.user.id}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleCodes: [] }),
      jar: adminJar,
      expectedStatus: 409
    });
    await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Usuário de Integração',
        email: 'user.integration@example.test',
        password: commonPassword
      }),
      jar: adminJar,
      csrf: false,
      expectedStatus: 400
    });
    const created = await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Usuário de Integração',
        email: 'user.integration@example.test',
        password: commonPassword
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const commonUserId = created.body.id;
    const verificationMessage = [...smtpMessages]
      .reverse()
      .find((message) => /\b\d{8}\b/u.test(message));
    const verificationCode = verificationMessage?.match(/\b(\d{8})\b/u)?.[1];
    assert(verificationCode, 'O adaptador SMTP não entregou o código de verificação.');
    await apiRequest('/auth/email-verification/confirm', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user.integration@example.test',
        code: verificationCode
      }),
      expectedStatus: 204,
      csrf: false
    });

    const commonJar = new Map();
    await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user.integration@example.test',
        password: commonPassword
      }),
      jar: commonJar,
      csrf: false
    });
    await apiRequest('/users', {
      jar: commonJar,
      expectedStatus: 403
    });

    const oldRefresh = adminJar.get('fenix_refresh');
    const oldCsrf = adminJar.get('fenix_csrf');
    await apiRequest('/auth/refresh', {
      method: 'POST',
      jar: adminJar
    });
    assert(adminJar.get('fenix_refresh') !== oldRefresh, 'Refresh token não foi rotacionado.');
    const replayJar = new Map([
      ['fenix_refresh', oldRefresh],
      ['fenix_csrf', oldCsrf]
    ]);
    await apiRequest('/auth/refresh', {
      method: 'POST',
      jar: replayJar,
      expectedStatus: 401
    });

    adminJar.clear();
    await loginWithSecondFactor(
      'admin.integration@example.test',
      initialPassword,
      adminJar,
      adminRecoveryCodes.shift()
    );
    await apiRequest(`/users/${commonUserId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'BLOCKED' }),
      jar: adminJar,
      expectedStatus: 204
    });
    await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user.integration@example.test',
        password: commonPassword
      }),
      expectedStatus: 401,
      csrf: false
    });
    await apiRequest(`/users/${commonUserId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'ACTIVE' }),
      jar: adminJar,
      expectedStatus: 204
    });
    await apiRequest(`/users/${commonUserId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleCodes: ['USER', 'FINANCE'] }),
      jar: adminJar,
      expectedStatus: 204
    });
    await apiRequest('/auth/logout', {
      method: 'POST',
      jar: adminJar,
      expectedStatus: 204
    });

    await apiRequest('/auth/password-recovery', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin.integration@example.test' }),
      expectedStatus: 202,
      csrf: false
    });
    const recoveryMessage = smtpMessages.at(-1);
    const recoveryCode = recoveryMessage?.match(/(?:Código|digo):\s*(\d{6,8})/u)?.[1];
    assert(recoveryCode, 'O adaptador SMTP não entregou o código de recuperação.');

    await apiRequest('/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin.integration@example.test',
        code: recoveryCode,
        newPassword
      }),
      expectedStatus: 204,
      csrf: false
    });
    await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin.integration@example.test',
        password: initialPassword
      }),
      expectedStatus: 401,
      csrf: false
    });

    adminJar.clear();
    const finalLogin = await loginWithSecondFactor(
      'admin.integration@example.test',
      newPassword,
      adminJar,
      adminRecoveryCodes.shift()
    );
    const finalSessionId = finalLogin.body.user.id
      ? (
          await prisma.userSession.findFirstOrThrow({
            where: {
              userId: finalLogin.body.user.id,
              revokedAt: null
            },
            orderBy: { createdAt: 'desc' }
          })
        ).id
      : undefined;
    assert(finalSessionId, 'Sessão final não encontrada.');

    await prisma.$executeRaw`
      UPDATE "user_sessions"
      SET
        "created_at" = CURRENT_TIMESTAMP - INTERVAL '10 minutes',
        "last_activity_at" = CURRENT_TIMESTAMP - INTERVAL '6 minutes'
      WHERE "id" = ${finalSessionId}::uuid
    `;
    await apiRequest('/auth/me', {
      jar: adminJar,
      expectedStatus: 401
    });

    adminJar.clear();
    await loginWithSecondFactor(
      'admin.integration@example.test',
      newPassword,
      adminJar,
      adminRecoveryCodes.shift()
    );
    const auditResponse = await apiRequest('/audit-logs?limit=100', { jar: adminJar });
    const auditActions = new Set(auditResponse.body.data.map((record) => record.action));

    for (const expectedAction of [
      'INITIAL_ADMIN_CREATED',
      'LOGIN_FAILED',
      'LOGIN_SUCCEEDED',
      'LOGOUT',
      'EMAIL_VERIFICATION_REQUESTED',
      'EMAIL_VERIFIED',
      'MFA_ENROLLMENT_STARTED',
      'MFA_ENABLED',
      'MFA_CHALLENGE_SUCCEEDED',
      'MFA_RECOVERY_CODE_USED',
      'PASSWORD_RECOVERY_REQUESTED',
      'PASSWORD_RECOVERY_CODE_VALIDATED',
      'PASSWORD_RESET',
      'USER_CREATED',
      'USER_BLOCKED',
      'USER_UNBLOCKED',
      'USER_ROLES_CHANGED',
      'ACCESS_DENIED',
      'SESSION_REUSE_DETECTED'
    ]) {
      assert(auditActions.has(expectedAction), `Auditoria não registrou ${expectedAction}.`);
    }

    const auditId = auditResponse.body.data[0].id;
    let mutationBlocked = false;

    try {
      await prisma.auditLog.update({
        where: { id: auditId },
        data: { reason: 'MUTATION_SHOULD_FAIL' }
      });
    } catch {
      mutationBlocked = true;
    }
    assert(mutationBlocked, 'A proteção append-only permitiu alteração do AuditLog.');

    const rawSecretLeak = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM "users"
        WHERE "password_hash" IN (${initialPassword}, ${newPassword}, ${commonPassword})
      ) AS "found"
    `;
    assert(rawSecretLeak[0]?.found === false, 'Uma senha foi persistida em texto puro.');

    const serializedAudit = JSON.stringify(auditResponse.body.data);

    for (const secret of [
      enrollment.body.secret,
      ...mfaConfirmation.body.recoveryCodes,
      recoveryCode,
      verificationCode
    ]) {
      assert(!serializedAudit.includes(secret), 'A auditoria expôs um segredo de autenticação.');
    }

    console.log(
      'phase1-auth-integration=ok email mfa redis login logout refresh recovery rbac csrf inactivity audit'
    );
  } finally {
    await Promise.all(processes.map(stopProcess));
    await new Promise((resolve) => smtpServer.close(resolve));
  }
}

try {
  await run();
} finally {
  await prisma.$disconnect();
}
