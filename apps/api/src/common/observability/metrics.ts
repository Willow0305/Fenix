/**
 * Métricas da API no formato Prometheus (R-07), em memória por processo: requisições por
 * rota e situação, tempo de resposta e erros inesperados. A rota é o modelo
 * (`/api/v1/store/orders/:id`), nunca o endereço com ids ou parâmetros de busca.
 */
const BUCKETS = [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

interface Histogram {
  buckets: number[];
  sum: number;
  count: number;
}

function key(labels: Record<string, string>): string {
  return Object.entries(labels)
    .map(([name, value]) => `${name}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',');
}

export class Metrics {
  private readonly requests = new Map<string, number>();
  private readonly durations = new Map<string, Histogram>();
  private readonly errors = new Map<string, number>();
  private readonly startedAt = Date.now();

  observe(method: string, route: string, status: number, seconds: number): void {
    const labels = key({ method, route, status: String(status) });

    this.requests.set(labels, (this.requests.get(labels) ?? 0) + 1);

    const histogramKey = key({ method, route });
    const histogram = this.durations.get(histogramKey) ?? {
      buckets: BUCKETS.map(() => 0),
      sum: 0,
      count: 0
    };

    BUCKETS.forEach((limit, index) => {
      if (seconds <= limit) {
        histogram.buckets[index] = (histogram.buckets[index] ?? 0) + 1;
      }
    });
    histogram.sum += seconds;
    histogram.count += 1;
    this.durations.set(histogramKey, histogram);
  }

  error(route: string, name: string): void {
    const labels = key({ route, error: name });

    this.errors.set(labels, (this.errors.get(labels) ?? 0) + 1);
  }

  render(): string {
    const lines: string[] = [
      '# HELP fenix_http_requests_total Requisições HTTP por método, rota e situação.',
      '# TYPE fenix_http_requests_total counter'
    ];

    for (const [labels, value] of this.requests) {
      lines.push(`fenix_http_requests_total{${labels}} ${value}`);
    }

    lines.push(
      '# HELP fenix_http_request_duration_seconds Tempo de resposta por método e rota.',
      '# TYPE fenix_http_request_duration_seconds histogram'
    );

    for (const [labels, histogram] of this.durations) {
      BUCKETS.forEach((limit, index) => {
        lines.push(
          `fenix_http_request_duration_seconds_bucket{${labels},le="${limit}"} ${histogram.buckets[index] ?? 0}`
        );
      });
      lines.push(
        `fenix_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${histogram.count}`,
        `fenix_http_request_duration_seconds_sum{${labels}} ${histogram.sum.toFixed(6)}`,
        `fenix_http_request_duration_seconds_count{${labels}} ${histogram.count}`
      );
    }

    lines.push(
      '# HELP fenix_http_errors_total Erros inesperados (500) por rota e tipo.',
      '# TYPE fenix_http_errors_total counter'
    );

    for (const [labels, value] of this.errors) {
      lines.push(`fenix_http_errors_total{${labels}} ${value}`);
    }

    const memory = process.memoryUsage();

    lines.push(
      '# HELP fenix_process_uptime_seconds Tempo desde que o processo subiu.',
      '# TYPE fenix_process_uptime_seconds gauge',
      `fenix_process_uptime_seconds ${((Date.now() - this.startedAt) / 1000).toFixed(0)}`,
      '# HELP fenix_process_resident_memory_bytes Memória residente do processo.',
      '# TYPE fenix_process_resident_memory_bytes gauge',
      `fenix_process_resident_memory_bytes ${memory.rss}`,
      '# HELP fenix_process_heap_used_bytes Memória usada pelo JavaScript.',
      '# TYPE fenix_process_heap_used_bytes gauge',
      `fenix_process_heap_used_bytes ${memory.heapUsed}`
    );

    return `${lines.join('\n')}\n`;
  }
}

/** Uma instância por processo (cada servidor expõe as próprias métricas). */
export const metrics = new Metrics();
