#!/usr/bin/env node
/**
 * Teste de carga básico (Fase 8, RNF de desempenho). Dispara requisições concorrentes de
 * leitura pública contra uma API em execução e mede latência (p50, p95, p99, máx.),
 * vazão e erros. Sem dependências externas.
 *
 * Uso: node scripts/load-test.mjs [baseUrl] [concorrência] [segundos]
 *   ex.: node scripts/load-test.mjs http://127.0.0.1:3399 20 15
 *
 * O rate limit global (300 req/min por IP) responde 429 de propósito; para medir a
 * aplicação, suba uma instância fora de produção com THROTTLE_DISABLED=true. Nunca rode
 * contra produção sem combinar janela e limites.
 */
const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:3333').replace(/\/$/, '');
const concurrency = Number(process.argv[3] ?? 20);
const seconds = Number(process.argv[4] ?? 15);

const PATHS = [
  '/health',
  '/api/v1/public/team',
  '/api/v1/public/products?pageSize=24',
  '/api/v1/public/news?channel=home&pageSize=3',
  '/api/v1/public/events?scope=upcoming',
  '/api/v1/public/partners',
  '/api/v1/forum/categories'
];

const samples = new Map(PATHS.map((path) => [path, []]));
const failures = new Map(PATHS.map((path) => [path, 0]));
const limited = new Map(PATHS.map((path) => [path, 0]));
const deadline = Date.now() + seconds * 1000;
let cursor = 0;

async function worker() {
  while (Date.now() < deadline) {
    const path = PATHS[cursor++ % PATHS.length];
    const started = performance.now();

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { Accept: 'application/json' }
      });

      await response.arrayBuffer();

      if (response.status === 429) {
        limited.set(path, limited.get(path) + 1);
      } else if (!response.ok) {
        failures.set(path, failures.get(path) + 1);
      } else {
        samples.get(path).push(performance.now() - started);
      }
    } catch {
      failures.set(path, failures.get(path) + 1);
    }
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) {
    return 0;
  }

  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

const started = Date.now();

await Promise.all(Array.from({ length: concurrency }, worker));

const elapsed = (Date.now() - started) / 1000;
const rows = PATHS.map((path) => {
  const sorted = samples.get(path).sort((a, b) => a - b);

  return {
    rota: path,
    ok: sorted.length,
    erros: failures.get(path),
    429: limited.get(path),
    'p50 ms': percentile(sorted, 50).toFixed(1),
    'p95 ms': percentile(sorted, 95).toFixed(1),
    'p99 ms': percentile(sorted, 99).toFixed(1),
    'máx ms': (sorted.at(-1) ?? 0).toFixed(1)
  };
});
const total = rows.reduce((sum, row) => sum + row.ok, 0);
const errors = rows.reduce((sum, row) => sum + row.erros, 0);

console.log(`Alvo ${baseUrl} · ${concurrency} conexões · ${elapsed.toFixed(1)} s`);
console.table(rows);
console.log(`Vazão: ${(total / elapsed).toFixed(1)} req/s · erros: ${errors}`);
process.exitCode = errors > 0 ? 1 : 0;
