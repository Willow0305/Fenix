import { createHmac, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiPort = 3342;
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const smtpPort = 1126;
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
    const alphabetIndex = alphabet.indexOf(character);

    assert(alphabetIndex >= 0, 'O segredo TOTP contém um caractere Base32 inválido.');
    accumulator = (accumulator << 5) | alphabetIndex;
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

function civilDateWithYearOffset(yearOffset) {
  const value = new Date();
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCFullYear(value.getUTCFullYear() + yearOffset);

  return value.toISOString().slice(0, 10);
}

function civilDateWithDayOffset(dayOffset) {
  const value = new Date();
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + dayOffset);

  return value.toISOString().slice(0, 10);
}

function instantWithMinuteOffset(minuteOffset) {
  return new Date(Date.now() + minuteOffset * 60_000).toISOString();
}

function createSmtpServer(messages) {
  return net.createServer((socket) => {
    let buffer = '';
    let readingData = false;
    let message = '';

    socket.write('220 fenix-phase2-test ESMTP\r\n');
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
          socket.write('250-fenix-phase2-test\r\n250 SIZE 1048576\r\n');
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
    throw new Error(`Processo de preparação falhou.\n${processState.output.join('').slice(-1500)}`);
  }
}

async function waitForHealth(processState) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (processState.child.exitCode !== null) {
      throw new Error(
        `API encerrou antes do health.\n${processState.output.join('').slice(-1500)}`
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

  throw new Error('Tempo excedido ao iniciar a API esportiva de integração.');
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

async function parseResponseBody(response) {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function apiRequest(pathname, options = {}) {
  const {
    jar = new Map(),
    csrf = true,
    expectedStatus = 200,
    updateCookies = true,
    ...init
  } = options;
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

  if (updateCookies) {
    updateCookieJar(response, jar);
  }

  const body = await parseResponseBody(response);
  const acceptedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];

  assert(
    acceptedStatuses.includes(response.status),
    `${method} ${pathname}: esperado ${acceptedStatuses.join(' ou ')}, recebido ${
      response.status
    }. Corpo: ${JSON.stringify(body)}`
  );

  return { jar, response, body };
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

async function transitionRegistration(registrationId, status, reason, jar) {
  return apiRequest(`/sports/registrations/${registrationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
    jar
  });
}

async function run() {
  assert(process.env['DATABASE_URL'], 'DATABASE_URL é obrigatória para o teste de integração.');

  const smtpMessages = [];
  const smtpServer = createSmtpServer(smtpMessages);
  await new Promise((resolve, reject) => {
    smtpServer.once('error', reject);
    smtpServer.listen(smtpPort, '127.0.0.1', resolve);
  });

  const duplicateHmacKey = randomBytes(48).toString('base64url');
  const sharedEnvironment = {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    AUTH_ACCESS_TOKEN_SECRET: randomBytes(48).toString('base64url'),
    AUTH_TOKEN_PEPPER: randomBytes(48).toString('base64url'),
    AUTH_CONTEXT_HASH_PEPPER: randomBytes(48).toString('base64url'),
    AUTH_BCRYPT_COST: '10',
    AUTH_INACTIVITY_MINUTES: '45',
    AUTH_SESSION_ABSOLUTE_DAYS: '30',
    AUTH_MAX_LOGIN_ATTEMPTS: '5',
    AUTH_LOGIN_BLOCK_MINUTES: '15',
    AUTH_RECOVERY_CODE_MINUTES: '10',
    AUTH_RECOVERY_CODE_LENGTH: '6',
    AUTH_MFA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    AUTH_MFA_KEY_VERSION: 'phase2-integration-v1',
    SPORTS_DUPLICATE_HMAC_KEY: duplicateHmacKey,
    REAL_MINOR_DATA_ENABLED: 'false',
    HEALTH_DATA_COLLECTION_ENABLED: 'false',
    RATE_LIMIT_LOGIN_MAX: '100',
    RATE_LIMIT_CODE_VALIDATION_MAX: '100',
    RATE_LIMIT_EMAIL_RESEND_MAX: '50',
    RATE_LIMIT_MFA_MAX: '100',
    RATE_LIMIT_REFRESH_MAX: '300',
    RATE_LIMIT_ADMIN_SENSITIVE_MAX: '500',
    REDIS_URL: process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtpPort),
    SMTP_FROM: 'no-reply@fenix.test'
  };
  const adminEmail = 'admin.phase2.integration@example.test';
  const commonEmail = 'user.phase2.integration@example.test';
  const guardianEmail = 'guardian.phase2.integration@example.test';
  const adminPassword = `A2-${randomBytes(18).toString('base64url')}`;
  const commonPassword = `U2-${randomBytes(18).toString('base64url')}`;
  const adminJar = new Map();
  const commonJar = new Map();
  const confidentialAttachmentValue = randomBytes(48).toString('base64url');
  const confidentialAttachmentChecksum = randomBytes(32).toString('hex');
  const attachmentOriginalName = 'autorizacao-ficticia-integracao.pdf';
  const minorName = 'Atleta Menor Fictícia Integração';
  const duplicateName = 'Atleta Duplicada Fictícia Integração';
  const minorBirthDate = civilDateWithYearOffset(-14);
  const adultBirthDate = civilDateWithYearOffset(-24);
  const today = civilDateWithDayOffset(0);

  try {
    await waitForExit(
      startProcess(['apps/api/dist/bootstrap-admin.js'], {
        ...sharedEnvironment,
        BOOTSTRAP_ADMIN_NAME: 'Administrador Fase Dois Integração',
        BOOTSTRAP_ADMIN_EMAIL: adminEmail,
        BOOTSTRAP_ADMIN_PASSWORD: adminPassword
      })
    );

    const api = startProcess(['apps/api/dist/main.js'], {
      ...sharedEnvironment,
      API_PORT: String(apiPort),
      CORS_ORIGINS: 'http://localhost:3000'
    });
    await waitForHealth(api);

    const initialLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      jar: adminJar,
      csrf: false
    });
    const adminId = initialLogin.body.user.id;
    assert(initialLogin.body.user.roles.includes('ADMIN'), 'Bootstrap não atribuiu ADMIN.');
    assert(
      initialLogin.body.user.mfaEnrollmentRequired,
      'ADMIN deveria exigir configuração inicial de MFA.'
    );

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
    assert(
      Array.isArray(mfaConfirmation.body.recoveryCodes) &&
        mfaConfirmation.body.recoveryCodes.length >= 8,
      'Códigos de recuperação MFA não foram gerados.'
    );

    await apiRequest(`/users/${adminId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleCodes: ['ADMIN', 'BOARD'] }),
      jar: adminJar,
      expectedStatus: 204
    });
    const boardSession = await apiRequest('/auth/me', { jar: adminJar });
    assert(boardSession.body.user.roles.includes('BOARD'), 'O administrador não recebeu BOARD.');
    assert(
      boardSession.body.user.permissions.includes('registrations.convert'),
      'BOARD não recebeu a permissão esportiva de conversão.'
    );

    await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Usuário Comum Fase Dois',
        email: commonEmail,
        password: commonPassword
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const verificationMessage = [...smtpMessages]
      .reverse()
      .find((message) => message.includes(commonEmail) && /\b\d{8}\b/u.test(message));
    const verificationCode = verificationMessage?.match(/\b(\d{8})\b/u)?.[1];
    assert(verificationCode, 'O SMTP falso não recebeu o código de verificação do USER.');
    await apiRequest('/auth/email-verification/confirm', {
      method: 'POST',
      body: JSON.stringify({ email: commonEmail, code: verificationCode }),
      expectedStatus: 204,
      csrf: false
    });
    await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: commonEmail, password: commonPassword }),
      jar: commonJar,
      csrf: false
    });
    await apiRequest('/sports/summary', {
      jar: commonJar,
      expectedStatus: 403
    });
    await apiRequest('/sports/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Categoria Proibida', kind: 'OTHER' }),
      jar: commonJar,
      expectedStatus: 403
    });

    const category = await apiRequest('/sports/categories', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Sub-18 Fictícia Integração',
        kind: 'AGE_GROUP',
        minimumAge: 15,
        maximumAge: 17
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const categoryId = category.body.id;
    assert(categoryId, 'A categoria esportiva não retornou UUID.');
    const categoryList = await apiRequest('/sports/categories?limit=100', { jar: adminJar });
    assert(
      categoryList.body.data.some((record) => record.id === categoryId),
      'A categoria criada não apareceu na listagem.'
    );
    await apiRequest(`/sports/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Sub-18 Fictícia Atualizada' }),
      jar: adminJar
    });

    const team = await apiRequest('/sports/teams', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Equipe Fictícia Integração',
        categoryIds: [categoryId]
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const teamId = team.body.id;
    assert(teamId, 'A equipe não retornou UUID.');
    await apiRequest(`/sports/teams/${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify({ description: 'Equipe usada somente em teste automatizado.' }),
      jar: adminJar
    });
    const secondaryCategory = await apiRequest('/sports/categories', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Desenvolvimento Fictício Integração',
        kind: 'LEVEL'
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const linkedTeamCategory = await apiRequest(`/sports/teams/${teamId}/categories`, {
      method: 'POST',
      body: JSON.stringify({
        categoryId: secondaryCategory.body.id,
        startsOn: today
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const teamCategory = await prisma.teamCategory.findFirstOrThrow({
      where: {
        teamId,
        categoryId,
        endsOn: null,
        deletedAt: null
      }
    });

    const guardian = await apiRequest('/sports/guardians', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Responsável Fictício Integração',
        email: guardianEmail,
        isFictitious: true
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const guardianId = guardian.body.id;
    assert(guardianId, 'O responsável não retornou UUID.');
    const guardianList = await apiRequest('/sports/guardians?limit=100', { jar: adminJar });
    assert(
      guardianList.body.data.some((record) => record.id === guardianId),
      'O responsável criado não apareceu na listagem.'
    );

    const tryout = await apiRequest('/sports/tryouts', {
      method: 'POST',
      body: JSON.stringify({
        teamCategoryId: teamCategory.id,
        title: 'Seletiva Fictícia Integração',
        location: 'Ginásio Fictício',
        startsAt: instantWithMinuteOffset(180),
        registrationStartsAt: instantWithMinuteOffset(-60),
        registrationEndsAt: instantWithMinuteOffset(120),
        capacity: 10,
        waitlistCapacity: 5,
        status: 'OPEN'
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const tryoutId = tryout.body.id;
    assert(tryoutId, 'A seletiva não retornou UUID.');
    await apiRequest(`/sports/tryouts/${tryoutId}`, {
      method: 'PATCH',
      body: JSON.stringify({ description: 'Seletiva atualizada no teste de integração.' }),
      jar: adminJar
    });
    const tryoutList = await apiRequest('/sports/tryouts?limit=100', { jar: adminJar });
    assert(
      tryoutList.body.data.some((record) => record.id === tryoutId),
      'A seletiva criada não apareceu na listagem.'
    );

    const rejectedMinor = await apiRequest('/sports/registrations', {
      method: 'POST',
      body: JSON.stringify({
        tryoutId,
        fullName: 'Menor Sem Autorização Fictícia',
        birthDate: minorBirthDate,
        email: 'minor.without.authorization@example.test',
        desiredPosition: 'PONTEIRO',
        isFictitious: true
      }),
      jar: adminJar,
      expectedStatus: 409
    });
    assert(
      typeof rejectedMinor.body?.code === 'string',
      'A rejeição de menor deveria retornar um código de problema estável.'
    );

    const privateAttachment = await prisma.privateAttachment.create({
      data: {
        purpose: 'GUARDIAN_AUTHORIZATION_TEST',
        status: 'AVAILABLE',
        objectKeyCiphertext: confidentialAttachmentValue,
        objectKeyIv: randomBytes(12).toString('hex'),
        objectKeyAuthTag: randomBytes(16).toString('hex'),
        keyVersion: 'phase2-integration-v1',
        originalName: attachmentOriginalName,
        mimeType: 'application/pdf',
        sizeBytes: 512n,
        checksumSha256: confidentialAttachmentChecksum,
        retentionUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdById: adminId
      }
    });

    const minorRegistration = await apiRequest('/sports/registrations', {
      method: 'POST',
      body: JSON.stringify({
        tryoutId,
        fullName: minorName,
        birthDate: minorBirthDate,
        email: 'minor.authorized@example.test',
        desiredPosition: 'LEVANTADOR',
        isFictitious: true,
        guardianAuthorization: {
          guardianId,
          relationship: 'RESPONSÁVEL LEGAL',
          privateAttachmentId: privateAttachment.id,
          version: 'phase2-integration-v1',
          validFrom: civilDateWithDayOffset(-1),
          validUntil: civilDateWithDayOffset(365)
        }
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const minorRegistrationId = minorRegistration.body.id;
    assert(minorRegistrationId, 'A inscrição fictícia de menor não retornou UUID.');
    assert(
      minorRegistration.body.guardianAuthorizationValid === true,
      'A inscrição não indicou a autorização válida do responsável.'
    );

    await transitionRegistration(
      minorRegistrationId,
      'UNDER_REVIEW',
      'Análise fictícia iniciada.',
      adminJar
    );
    await transitionRegistration(
      minorRegistrationId,
      'APPROVED',
      'Aprovação fictícia para validar conversão.',
      adminJar
    );
    const minorConversion = await apiRequest(
      `/sports/registrations/${minorRegistrationId}/convert`,
      {
        method: 'POST',
        body: JSON.stringify({
          teamCategoryId: teamCategory.id,
          affiliationStartsOn: today,
          reason: 'Conversão fictícia autorizada para teste.'
        }),
        jar: adminJar,
        expectedStatus: 201
      }
    );
    const minorAthleteId = minorConversion.body.id;
    assert(minorAthleteId, 'A conversão da inscrição de menor não retornou atleta.');

    const convertedMinor = await prisma.tryoutRegistration.findUniqueOrThrow({
      where: { id: minorRegistrationId },
      include: {
        history: {
          orderBy: { occurredAt: 'asc' }
        }
      }
    });
    assert(convertedMinor.status === 'CONVERTED', 'A inscrição não terminou como CONVERTED.');
    assert(
      convertedMinor.convertedAthleteProfileId === minorAthleteId,
      'A inscrição não preservou o vínculo com o atleta convertido.'
    );
    const minorHistory = convertedMinor.history.map(({ toStatus }) => toStatus);

    for (const expectedStatus of ['NEW', 'UNDER_REVIEW', 'APPROVED', 'CONVERTED']) {
      assert(
        minorHistory.includes(expectedStatus),
        `O histórico da inscrição não registrou ${expectedStatus}.`
      );
    }

    const [minorAffiliation, minorGuardianLink, minorAuthorization] = await Promise.all([
      prisma.athleteAffiliation.findFirst({
        where: {
          athleteProfileId: minorAthleteId,
          teamCategoryId: teamCategory.id
        }
      }),
      prisma.athleteGuardian.findFirst({
        where: {
          athleteProfileId: minorAthleteId,
          guardianId
        }
      }),
      prisma.guardianAuthorization.findFirst({
        where: {
          athleteProfileId: minorAthleteId,
          tryoutRegistrationId: minorRegistrationId,
          guardianId,
          relationship: 'RESPONSÁVEL LEGAL',
          status: 'VALID'
        }
      })
    ]);
    assert(minorAffiliation, 'A conversão não criou o vínculo histórico equipe/categoria.');
    assert(minorGuardianLink, 'A conversão não preservou o vínculo com o responsável.');
    assert(
      minorAuthorization?.privateAttachmentId === privateAttachment.id,
      'A conversão não preservou os metadados protegidos da autorização.'
    );

    const existingDuplicateAthlete = await apiRequest('/sports/athletes', {
      method: 'POST',
      body: JSON.stringify({
        fullName: duplicateName,
        birthDate: adultBirthDate,
        position: 'CENTRAL',
        status: 'ACTIVE',
        isFictitious: true
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const existingDuplicateAthleteId = existingDuplicateAthlete.body.id;
    await apiRequest(`/sports/athletes/${existingDuplicateAthleteId}/affiliations`, {
      method: 'POST',
      body: JSON.stringify({
        teamCategoryId: linkedTeamCategory.body.id,
        startsOn: today,
        reason: 'Vínculo fictício criado para validar o histórico.'
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const duplicateRegistration = await apiRequest('/sports/registrations', {
      method: 'POST',
      body: JSON.stringify({
        tryoutId,
        fullName: duplicateName,
        birthDate: adultBirthDate,
        email: 'duplicate.candidate@example.test',
        desiredPosition: 'CENTRAL',
        isFictitious: true
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const duplicateRegistrationId = duplicateRegistration.body.id;
    assert(
      duplicateRegistration.body.duplicateWarning === true,
      'A possível duplicidade não gerou alerta na inscrição.'
    );
    await transitionRegistration(
      duplicateRegistrationId,
      'UNDER_REVIEW',
      'Análise de possível duplicidade fictícia.',
      adminJar
    );
    await transitionRegistration(
      duplicateRegistrationId,
      'APPROVED',
      'Aprovação consciente sem fusão automática.',
      adminJar
    );
    const blockedDuplicateConversion = await apiRequest(
      `/sports/registrations/${duplicateRegistrationId}/convert`,
      {
        method: 'POST',
        body: JSON.stringify({
          teamCategoryId: teamCategory.id,
          affiliationStartsOn: today,
          reason: 'Revisão fictícia da possível duplicidade.'
        }),
        jar: adminJar,
        expectedStatus: 409
      }
    );
    assert(
      blockedDuplicateConversion.body?.code === 'POSSIBLE_ATHLETE_DUPLICATE_REQUIRES_REVIEW',
      'A conversão com possível duplicidade não foi bloqueada para análise humana.'
    );
    const duplicateSource = await prisma.athleteProfile.findUniqueOrThrow({
      where: { id: existingDuplicateAthleteId }
    });
    const duplicateProfiles = await prisma.athleteProfile.findMany({
      where: {
        duplicateFingerprintHash: duplicateSource.duplicateFingerprintHash,
        deletedAt: null
      }
    });
    assert(
      duplicateProfiles.length === 1,
      'O alerta de duplicidade criou ou fundiu um perfil sem revisão humana.'
    );
    const blockedDuplicateRegistration = await prisma.tryoutRegistration.findUniqueOrThrow({
      where: { id: duplicateRegistrationId }
    });
    assert(
      blockedDuplicateRegistration.status === 'APPROVED' &&
        blockedDuplicateRegistration.convertedAthleteProfileId === null,
      'A tentativa bloqueada alterou parcialmente a inscrição duplicada.'
    );

    const concurrentName = 'Atleta Concorrente Fictícia Integração';
    const concurrentBirthDate = civilDateWithYearOffset(-25);
    const concurrentRegistration = await apiRequest('/sports/registrations', {
      method: 'POST',
      body: JSON.stringify({
        tryoutId,
        fullName: concurrentName,
        birthDate: concurrentBirthDate,
        email: 'concurrent.candidate@example.test',
        desiredPosition: 'LÍBERO',
        isFictitious: true
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    const concurrentRegistrationId = concurrentRegistration.body.id;
    await transitionRegistration(
      concurrentRegistrationId,
      'UNDER_REVIEW',
      'Análise fictícia para teste concorrente.',
      adminJar
    );
    await transitionRegistration(
      concurrentRegistrationId,
      'APPROVED',
      'Aprovação fictícia para teste concorrente.',
      adminJar
    );
    const conversionBody = JSON.stringify({
      teamCategoryId: teamCategory.id,
      affiliationStartsOn: today,
      reason: 'Conversão concorrente fictícia sem fusão automática.'
    });
    const concurrentConversions = await Promise.all([
      apiRequest(`/sports/registrations/${concurrentRegistrationId}/convert`, {
        method: 'POST',
        body: conversionBody,
        jar: adminJar,
        expectedStatus: 201,
        updateCookies: false
      }),
      apiRequest(`/sports/registrations/${concurrentRegistrationId}/convert`, {
        method: 'POST',
        body: conversionBody,
        jar: adminJar,
        expectedStatus: 201,
        updateCookies: false
      })
    ]);
    assert(
      concurrentConversions[0].body.id === concurrentConversions[1].body.id,
      'Repetições concorrentes não retornaram o mesmo atleta convertido.'
    );
    const concurrentFingerprint = (
      await prisma.tryoutRegistration.findUniqueOrThrow({
        where: { id: concurrentRegistrationId }
      })
    ).duplicateFingerprintHash;
    const concurrentProfiles = await prisma.athleteProfile.findMany({
      where: {
        duplicateFingerprintHash: concurrentFingerprint,
        deletedAt: null
      }
    });
    assert(
      concurrentProfiles.length === 1,
      'A conversão concorrente criou mais de um perfil esportivo.'
    );
    const finalConcurrentRegistration = await prisma.tryoutRegistration.findUniqueOrThrow({
      where: { id: concurrentRegistrationId }
    });
    assert(
      finalConcurrentRegistration.convertedAthleteProfileId === concurrentProfiles[0].id,
      'A inscrição concorrente não preservou a única conversão materializada.'
    );

    const sportsAuditActions = [
      'SPORT_CATEGORY_CREATED',
      'SPORT_CATEGORY_UPDATED',
      'TEAM_CREATED',
      'TEAM_UPDATED',
      'TEAM_CATEGORY_LINKED',
      'GUARDIAN_CREATED',
      'TRYOUT_CREATED',
      'TRYOUT_UPDATED',
      'TRYOUT_REGISTRATION_CREATED',
      'TRYOUT_REGISTRATION_STATUS_CHANGED',
      'GUARDIAN_AUTHORIZATION_RECORDED',
      'ATHLETE_CREATED',
      'ATHLETE_AFFILIATION_CREATED',
      'ATHLETE_DUPLICATE_DETECTED',
      'TRYOUT_REGISTRATION_CONVERTED'
    ];
    const audits = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [...sportsAuditActions, 'ACCESS_DENIED']
        }
      },
      orderBy: { occurredAt: 'asc' }
    });
    const recordedActions = new Set(audits.map(({ action }) => action));

    for (const action of sportsAuditActions) {
      assert(recordedActions.has(action), `A auditoria esportiva não registrou ${action}.`);
    }
    assert(
      recordedActions.has('ACCESS_DENIED'),
      'O acesso esportivo negado ao USER não foi auditado.'
    );

    const auditPayload = JSON.stringify(
      audits.map(({ action, beforeData, afterData, metadata, reason }) => ({
        action,
        beforeData,
        afterData,
        metadata,
        reason
      }))
    );
    const forbiddenAuditValues = [
      adminPassword,
      commonPassword,
      enrollment.body.secret,
      ...mfaConfirmation.body.recoveryCodes,
      verificationCode,
      minorName,
      duplicateName,
      concurrentName,
      guardianEmail,
      commonEmail,
      minorBirthDate,
      adultBirthDate,
      concurrentBirthDate,
      confidentialAttachmentValue,
      confidentialAttachmentChecksum,
      attachmentOriginalName
    ];

    for (const value of forbiddenAuditValues) {
      assert(!auditPayload.includes(value), 'A auditoria expôs dado pessoal ou segredo proibido.');
    }

    console.log(
      'phase2-sports-integration=ok mfa board rbac catalog guardian minor tryout conversion history duplicate concurrency audit'
    );
  } catch (error) {
    const processOutput = processes
      .flatMap(({ output }) => output)
      .join('')
      .slice(-8_000);

    throw new Error(`${error instanceof Error ? error.stack : String(error)}\n${processOutput}`, {
      cause: error
    });
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
