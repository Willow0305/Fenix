import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiPort = 3343;
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const smtpPort = 1127;
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

    assert(alphabetIndex >= 0, 'Segredo TOTP Base32 inválido.');
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

function createSmtpServer() {
  return net.createServer((socket) => {
    let buffer = '';
    let readingData = false;

    socket.write('220 fenix-phase3-test ESMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += String(chunk);

      while (buffer.includes('\r\n')) {
        const lineEnd = buffer.indexOf('\r\n');
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);

        if (readingData) {
          if (line === '.') {
            readingData = false;
            socket.write('250 message accepted\r\n');
          }
          continue;
        }

        if (/^(EHLO|HELO)\b/iu.test(line)) {
          socket.write('250-fenix-phase3-test\r\n250 SIZE 1048576\r\n');
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
    env: { ...process.env, ...environment },
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
    throw new Error(`Preparação falhou.\n${processState.output.join('').slice(-2_000)}`);
  }
}

async function waitForHealth(processState) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (processState.child.exitCode !== null) {
      throw new Error(`API encerrou.\n${processState.output.join('').slice(-2_000)}`);
    }

    try {
      const response = await fetch(`${apiBaseUrl}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // API em inicialização.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Tempo excedido ao iniciar a API financeira.');
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

  const response = await fetch(`${apiBaseUrl}/api/v1${pathname}`, { ...init, headers });

  if (updateCookies) {
    updateCookieJar(response, jar);
  }

  const body = await parseResponseBody(response);
  const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];

  assert(
    statuses.includes(response.status),
    `${method} ${pathname}: esperado ${statuses.join(' ou ')}, recebido ${
      response.status
    }. Corpo: ${JSON.stringify(body)}`
  );

  return { body, response };
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

async function enrollMfa(jar) {
  const enrollment = await apiRequest('/auth/mfa/enrollment', {
    method: 'POST',
    jar,
    expectedStatus: 201
  });
  const confirmation = await apiRequest('/auth/mfa/enrollment/confirm', {
    method: 'POST',
    body: JSON.stringify({ code: createTotp(enrollment.body.secret) }),
    jar,
    expectedStatus: 201
  });

  assert(confirmation.body.recoveryCodes.length >= 8, 'MFA não gerou códigos de recuperação.');
}

async function createVerifiedUser({ adminJar, email, name, password }) {
  const created = await apiRequest('/users', {
    method: 'POST',
    body: JSON.stringify({ email, name, password }),
    jar: adminJar,
    expectedStatus: 201
  });
  await prisma.user.update({
    where: { id: created.body.id },
    data: { emailVerifiedAt: new Date(), status: 'ACTIVE' }
  });

  return created.body.id;
}

function idempotency(label) {
  return `phase3-${label}-${randomUUID()}`;
}

async function run() {
  assert(process.env.DATABASE_URL, 'DATABASE_URL é obrigatória para a integração.');

  const smtpServer = createSmtpServer();
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
    AUTH_MFA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    AUTH_MFA_KEY_VERSION: 'phase3-integration-v1',
    SPORTS_DUPLICATE_HMAC_KEY: randomBytes(48).toString('base64url'),
    REAL_MINOR_DATA_ENABLED: 'false',
    HEALTH_DATA_COLLECTION_ENABLED: 'false',
    RATE_LIMIT_LOGIN_MAX: '100',
    RATE_LIMIT_CODE_VALIDATION_MAX: '100',
    RATE_LIMIT_EMAIL_RESEND_MAX: '50',
    RATE_LIMIT_MFA_MAX: '100',
    RATE_LIMIT_REFRESH_MAX: '300',
    RATE_LIMIT_ADMIN_SENSITIVE_MAX: '500',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtpPort),
    SMTP_FROM: 'no-reply@fenix.test'
  };
  const adminEmail = 'admin.phase3.integration@example.test';
  const assistantEmail = 'assistant.phase3.integration@example.test';
  const commonEmail = 'user.phase3.integration@example.test';
  const adminPassword = `A3-${randomBytes(18).toString('base64url')}`;
  const assistantPassword = `F3-${randomBytes(18).toString('base64url')}`;
  const commonPassword = `U3-${randomBytes(18).toString('base64url')}`;
  const adminJar = new Map();
  const assistantJar = new Map();
  const commonJar = new Map();
  const auditCanary = `external-${randomBytes(18).toString('base64url')}`;
  const idempotencyCanary = idempotency('secret-canary');

  try {
    await waitForExit(
      startProcess(['apps/api/dist/bootstrap-admin.js'], {
        ...sharedEnvironment,
        BOOTSTRAP_ADMIN_NAME: 'Administrador Fase Três Integração',
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

    const adminLogin = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      jar: adminJar,
      csrf: false
    });
    const adminId = adminLogin.body.user.id;
    await enrollMfa(adminJar);
    await apiRequest(`/users/${adminId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleCodes: ['ADMIN', 'TREASURER'] }),
      jar: adminJar,
      expectedStatus: 204
    });
    const treasurerSession = await apiRequest('/auth/me', { jar: adminJar });
    assert(
      treasurerSession.body.user.permissions.includes('finance.cash.close'),
      'TREASURER não recebeu a permissão de fechamento.'
    );

    const assistantId = await createVerifiedUser({
      adminJar,
      email: assistantEmail,
      name: 'Assistente Financeiro Fictício',
      password: assistantPassword
    });
    await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: assistantEmail, password: assistantPassword }),
      jar: assistantJar,
      csrf: false
    });
    await enrollMfa(assistantJar);
    await apiRequest(`/users/${assistantId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleCodes: ['FINANCE_ASSISTANT'] }),
      jar: adminJar,
      expectedStatus: 204
    });
    const assistantSession = await apiRequest('/auth/me', { jar: assistantJar });
    assert(
      assistantSession.body.user.permissions.includes('finance.entries.create') &&
        !assistantSession.body.user.permissions.includes('finance.entries.approve'),
      'Segregação do assistente financeiro está incorreta.'
    );

    await createVerifiedUser({
      adminJar,
      email: commonEmail,
      name: 'Usuário Comum Financeiro',
      password: commonPassword
    });
    await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: commonEmail, password: commonPassword }),
      jar: commonJar,
      csrf: false
    });
    await apiRequest('/finance/summary', { jar: commonJar, expectedStatus: 403 });

    const cashAccount = await apiRequest('/finance/accounts', {
      method: 'POST',
      body: JSON.stringify({ code: 'CAIXA_TESTE', name: 'Caixa fictício', type: 'CASH' }),
      jar: assistantJar,
      expectedStatus: 201
    });
    const bankAccount = await apiRequest('/finance/accounts', {
      method: 'POST',
      body: JSON.stringify({ code: 'BANCO_TESTE', name: 'Banco fictício', type: 'BANK' }),
      jar: assistantJar,
      expectedStatus: 201
    });
    const incomeCategory = await apiRequest('/finance/categories', {
      method: 'POST',
      body: JSON.stringify({ code: 'RECEITA_TESTE', name: 'Receita fictícia', type: 'INCOME' }),
      jar: assistantJar,
      expectedStatus: 201
    });
    const expenseCategory = await apiRequest('/finance/categories', {
      method: 'POST',
      body: JSON.stringify({ code: 'DESPESA_TESTE', name: 'Despesa fictícia', type: 'EXPENSE' }),
      jar: assistantJar,
      expectedStatus: 201
    });
    const costCenter = await apiRequest('/finance/cost-centers', {
      method: 'POST',
      body: JSON.stringify({ code: 'CENTRO_TESTE', name: 'Centro fictício' }),
      jar: assistantJar,
      expectedStatus: 201
    });
    const cashSession = await apiRequest('/finance/cash-sessions', {
      method: 'POST',
      body: JSON.stringify({ accountId: cashAccount.body.id, openingBalance: '100.00' }),
      jar: adminJar,
      expectedStatus: 201
    });

    const plan = await apiRequest('/finance/plans', {
      method: 'POST',
      body: JSON.stringify({ code: 'PLANO_TESTE', name: 'Plano fictício' }),
      jar: assistantJar,
      expectedStatus: 201
    });
    const planVersion1 = await apiRequest(`/finance/plans/${plan.body.id}/versions`, {
      method: 'POST',
      body: JSON.stringify({
        amount: '100.00',
        billingDay: 10,
        effectiveFrom: '2026-08-01',
        rulesSummary: 'Regra fictícia da integração'
      }),
      jar: assistantJar,
      expectedStatus: 201
    });
    const planVersion2 = await apiRequest(`/finance/plans/${plan.body.id}/versions`, {
      method: 'POST',
      body: JSON.stringify({
        amount: '120.00',
        billingDay: 10,
        effectiveFrom: '2026-09-01'
      }),
      jar: assistantJar,
      expectedStatus: 201
    });
    assert(planVersion2.body.version === 2, 'Alteração de plano não criou nova versão.');
    let immutablePlanVersionBlocked = false;

    try {
      await prisma.financialPlanVersion.update({
        where: { id: planVersion1.body.id },
        data: { amount: '999.00' }
      });
    } catch {
      immutablePlanVersionBlocked = true;
    }
    assert(immutablePlanVersionBlocked, 'O banco permitiu editar versão imutável do plano.');

    async function createCharge(referenceCode, key) {
      return apiRequest('/finance/charges', {
        method: 'POST',
        body: JSON.stringify({
          referenceCode,
          planVersionId: planVersion1.body.id,
          description: `Cobrança fictícia ${referenceCode}`,
          competence: '2026-08-01',
          dueDate: '2026-08-10',
          amount: '100.00'
        }),
        headers: { 'Idempotency-Key': key },
        jar: assistantJar,
        expectedStatus: 201
      });
    }

    const partialCharge = await createCharge('COB-PARCIAL', idempotency('charge-partial'));
    const excessCharge = await createCharge('COB-EXCEDENTE', idempotency('charge-excess'));
    const concurrentCharge = await createCharge(
      'COB-CONCORRENTE',
      idempotency('charge-concurrent')
    );

    const partialPayment = await apiRequest('/finance/payments', {
      method: 'POST',
      body: JSON.stringify({
        accountId: cashAccount.body.id,
        amount: '40.00',
        paidAt: new Date().toISOString(),
        externalReference: auditCanary
      }),
      headers: { 'Idempotency-Key': idempotencyCanary },
      jar: assistantJar,
      expectedStatus: 201
    });
    await apiRequest(`/finance/payments/${partialPayment.body.id}/reconcile`, {
      method: 'POST',
      body: JSON.stringify({
        incomeCategoryId: incomeCategory.body.id,
        allocations: [{ chargeId: partialCharge.body.id, amount: '40.00' }],
        reason: 'Conciliação parcial fictícia'
      }),
      headers: { 'Idempotency-Key': idempotency('reconcile-partial') },
      jar: adminJar,
      expectedStatus: 201
    });
    const partialChargeList = await apiRequest('/finance/charges?limit=100', { jar: adminJar });
    const partialResult = partialChargeList.body.data.find(
      ({ id }) => id === partialCharge.body.id
    );
    assert(
      partialResult.status === 'PARTIALLY_PAID' && partialResult.outstandingAmount === '60.0000',
      'Pagamento parcial não preservou saldo aberto.'
    );

    const excessPaymentKey = idempotency('payment-excess');
    const excessPayment = await apiRequest('/finance/payments', {
      method: 'POST',
      body: JSON.stringify({
        accountId: bankAccount.body.id,
        amount: '120.00',
        paidAt: new Date().toISOString()
      }),
      headers: { 'Idempotency-Key': excessPaymentKey },
      jar: assistantJar,
      expectedStatus: 201
    });
    const excessPaymentRepeat = await apiRequest('/finance/payments', {
      method: 'POST',
      body: JSON.stringify({
        accountId: bankAccount.body.id,
        amount: '120.00',
        paidAt: excessPayment.body.paidAt
      }),
      headers: { 'Idempotency-Key': excessPaymentKey },
      jar: assistantJar,
      expectedStatus: 201
    });
    assert(excessPaymentRepeat.body.id === excessPayment.body.id, 'Pagamento não foi idempotente.');
    const excessReconciliation = await apiRequest(
      `/finance/payments/${excessPayment.body.id}/reconcile`,
      {
        method: 'POST',
        body: JSON.stringify({
          incomeCategoryId: incomeCategory.body.id,
          allocations: [{ chargeId: excessCharge.body.id, amount: '100.00' }],
          surplusDisposition: 'CREDIT',
          reason: 'Excedente convertido em crédito fictício'
        }),
        headers: { 'Idempotency-Key': idempotency('reconcile-excess') },
        jar: adminJar,
        expectedStatus: 201
      }
    );
    assert(
      excessReconciliation.body.surplus.amount === '20.0000' &&
        excessReconciliation.body.credit.remainingAmount === '20.0000',
      'Excedente não virou crédito explícito.'
    );

    const concurrentPayment = await apiRequest('/finance/payments', {
      method: 'POST',
      body: JSON.stringify({
        accountId: bankAccount.body.id,
        amount: '100.00',
        paidAt: new Date().toISOString()
      }),
      headers: { 'Idempotency-Key': idempotency('payment-concurrent') },
      jar: assistantJar,
      expectedStatus: 201
    });
    const reconciliationPayload = JSON.stringify({
      incomeCategoryId: incomeCategory.body.id,
      allocations: [{ chargeId: concurrentCharge.body.id, amount: '100.00' }],
      reason: 'Conciliação concorrente fictícia'
    });
    const concurrentResults = await Promise.all([
      apiRequest(`/finance/payments/${concurrentPayment.body.id}/reconcile`, {
        method: 'POST',
        body: reconciliationPayload,
        headers: { 'Idempotency-Key': idempotency('reconcile-race-a') },
        jar: adminJar,
        expectedStatus: [201, 409]
      }),
      apiRequest(`/finance/payments/${concurrentPayment.body.id}/reconcile`, {
        method: 'POST',
        body: reconciliationPayload,
        headers: { 'Idempotency-Key': idempotency('reconcile-race-b') },
        jar: adminJar,
        expectedStatus: [201, 409]
      })
    ]);
    assert(
      concurrentResults.filter(({ response }) => response.status === 201).length === 1 &&
        concurrentResults.filter(({ response }) => response.status === 409).length === 1,
      'Concorrência deveria produzir uma única conciliação.'
    );
    assert(
      (await prisma.financialReconciliation.count({
        where: { paymentId: concurrentPayment.body.id }
      })) === 1,
      'O banco registrou baixa duplicada.'
    );

    const pendingEntryKey = idempotency('pending-entry');
    const pendingEntry = await apiRequest('/finance/transactions', {
      method: 'POST',
      body: JSON.stringify({
        accountId: cashAccount.body.id,
        categoryId: expenseCategory.body.id,
        costCenterId: costCenter.body.id,
        cashSessionId: cashSession.body.id,
        type: 'EXPENSE',
        amount: '30.00',
        description: 'Despesa fictícia pendente',
        occurredAt: new Date().toISOString()
      }),
      headers: { 'Idempotency-Key': pendingEntryKey },
      jar: assistantJar,
      expectedStatus: 201
    });
    await apiRequest(`/finance/transactions/${pendingEntry.body.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Tentativa sem alçada' }),
      jar: assistantJar,
      expectedStatus: 403
    });
    await apiRequest(`/finance/transactions/${pendingEntry.body.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Aprovação fictícia do tesoureiro' }),
      jar: adminJar,
      expectedStatus: 201
    });
    let approvedMutationBlocked = false;

    try {
      await prisma.financialTransaction.update({
        where: { id: pendingEntry.body.id },
        data: { amount: '999.00' }
      });
    } catch {
      approvedMutationBlocked = true;
    }
    assert(approvedMutationBlocked, 'O banco permitiu editar lançamento aprovado.');
    const reversedEntry = await apiRequest(
      `/finance/transactions/${pendingEntry.body.id}/reverse`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'Correção fictícia por reversão' }),
        headers: { 'Idempotency-Key': idempotency('entry-reversal') },
        jar: adminJar,
        expectedStatus: 201
      }
    );
    assert(reversedEntry.body.original.status === 'REVERSED', 'Reversão não marcou o original.');

    const payable = await apiRequest('/finance/obligations', {
      method: 'POST',
      body: JSON.stringify({
        type: 'PAYABLE',
        categoryId: expenseCategory.body.id,
        costCenterId: costCenter.body.id,
        accountId: cashAccount.body.id,
        referenceCode: 'PAG-TESTE-001',
        description: 'Conta fictícia a pagar',
        dueDate: '2026-08-20',
        amount: '80.00'
      }),
      jar: assistantJar,
      expectedStatus: 201
    });

    async function settleObligation(amount, suffix) {
      const entry = await apiRequest('/finance/transactions', {
        method: 'POST',
        body: JSON.stringify({
          accountId: cashAccount.body.id,
          categoryId: expenseCategory.body.id,
          costCenterId: costCenter.body.id,
          obligationId: payable.body.id,
          cashSessionId: cashSession.body.id,
          type: 'EXPENSE',
          amount,
          description: `Liquidação fictícia ${suffix}`,
          occurredAt: new Date().toISOString()
        }),
        headers: { 'Idempotency-Key': idempotency(`obligation-${suffix}`) },
        jar: assistantJar,
        expectedStatus: 201
      });
      await apiRequest(`/finance/transactions/${entry.body.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reason: `Aprovação fictícia ${suffix}` }),
        jar: adminJar,
        expectedStatus: 201
      });
    }

    await settleObligation('30.00', 'parcial');
    let obligations = await apiRequest('/finance/obligations?limit=100', { jar: adminJar });
    assert(
      obligations.body.data.find(({ id }) => id === payable.body.id).status === 'PARTIALLY_SETTLED',
      'Obrigação parcial não manteve saldo aberto.'
    );
    await settleObligation('50.00', 'final');
    obligations = await apiRequest('/finance/obligations?limit=100', { jar: adminJar });
    assert(
      obligations.body.data.find(({ id }) => id === payable.body.id).status === 'SETTLED',
      'Obrigação não foi liquidada integralmente.'
    );

    const beforeTransfer = await apiRequest('/finance/summary', { jar: adminJar });
    const transfer = await apiRequest('/finance/transfers', {
      method: 'POST',
      body: JSON.stringify({
        sourceAccountId: cashAccount.body.id,
        targetAccountId: bankAccount.body.id,
        amount: '25.00',
        description: 'Transferência fictícia neutra',
        occurredAt: new Date().toISOString()
      }),
      headers: { 'Idempotency-Key': idempotency('transfer') },
      jar: adminJar,
      expectedStatus: 201
    });
    const approvedTransfer = await apiRequest(`/finance/transfers/${transfer.body.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Aprovação fictícia da transferência' }),
      jar: adminJar,
      expectedStatus: 201
    });
    assert(
      approvedTransfer.body.ledgerRowCount === 2,
      'Transferência não criou o par de movimentações.'
    );
    const afterTransfer = await apiRequest('/finance/summary', { jar: adminJar });
    assert(
      beforeTransfer.body.derivedBalance === afterTransfer.body.derivedBalance,
      'Transferência alterou receita/despesa consolidada.'
    );
    const reversedTransfer = await apiRequest(`/finance/transfers/${transfer.body.id}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Reversão fictícia da transferência' }),
      headers: { 'Idempotency-Key': idempotency('transfer-reversal') },
      jar: adminJar,
      expectedStatus: 201
    });
    assert(
      reversedTransfer.body.status === 'REVERSED' && reversedTransfer.body.ledgerRowCount === 4,
      'Reversão de transferência não preservou as quatro pernas auditáveis.'
    );

    const closedCash = await apiRequest(`/finance/cash-sessions/${cashSession.body.id}/close`, {
      method: 'POST',
      body: JSON.stringify({
        countedFinalBalance: '60.00',
        reason: 'Fechamento fictício da integração'
      }),
      jar: adminJar,
      expectedStatus: 201
    });
    assert(
      closedCash.body.status === 'CLOSED' &&
        closedCash.body.closing.openingBalance === '100.0000' &&
        closedCash.body.closing.inflows === '40.0000' &&
        closedCash.body.closing.outflows === '135.0000' &&
        closedCash.body.closing.adjustments === '55.0000' &&
        closedCash.body.closing.expectedFinalBalance === '60.0000' &&
        closedCash.body.closing.differenceAmount === '0.0000',
      `Fechamento de caixa divergente: ${JSON.stringify(closedCash.body.closing)}`
    );

    const audit = await apiRequest('/audit-logs?limit=100', { jar: adminJar });
    const auditPayload = JSON.stringify(audit.body);
    const requiredActions = [
      'FINANCE_PAYMENT_RECONCILED',
      'FINANCE_TRANSACTION_APPROVED',
      'FINANCE_TRANSACTION_REVERSED',
      'FINANCE_TRANSFER_APPROVED',
      'FINANCE_TRANSFER_REVERSED',
      'FINANCE_CASH_CLOSED'
    ];

    for (const action of requiredActions) {
      assert(auditPayload.includes(action), `Auditoria não registrou ${action}.`);
    }
    assert(!auditPayload.includes(idempotencyCanary), 'Auditoria expôs chave de idempotência.');
    assert(
      !auditPayload.includes(auditCanary),
      'Auditoria expôs referência externa desnecessária.'
    );

    console.log(
      'phase3-finance-integration=ok rbac plans charges partial surplus duplicate transfer approval reversal obligation cash audit'
    );
  } catch (error) {
    const processOutput = processes
      .flatMap(({ output }) => output)
      .join('')
      .slice(-10_000);

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
