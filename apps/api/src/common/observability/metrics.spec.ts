import { Metrics } from './metrics';

describe('Metrics', () => {
  it('conta requisições por método, rota e situação', () => {
    const metrics = new Metrics();

    metrics.observe('GET', '/api/v1/store/products', 200, 0.01);
    metrics.observe('GET', '/api/v1/store/products', 200, 0.02);
    metrics.observe('GET', '/api/v1/store/products', 404, 0.01);

    const text = metrics.render();

    expect(text).toContain(
      'fenix_http_requests_total{method="GET",route="/api/v1/store/products",status="200"} 2'
    );
    expect(text).toContain(
      'fenix_http_requests_total{method="GET",route="/api/v1/store/products",status="404"} 1'
    );
  });

  it('acumula o histograma de tempo por faixa, soma e total', () => {
    const metrics = new Metrics();

    metrics.observe('POST', '/api/v1/cart', 201, 0.03);
    metrics.observe('POST', '/api/v1/cart', 201, 0.7);
    metrics.observe('POST', '/api/v1/cart', 201, 20);

    const text = metrics.render();
    const prefix = 'fenix_http_request_duration_seconds';
    const labels = 'method="POST",route="/api/v1/cart"';

    expect(text).toContain(`${prefix}_bucket{${labels},le="0.025"} 0`);
    expect(text).toContain(`${prefix}_bucket{${labels},le="0.05"} 1`);
    expect(text).toContain(`${prefix}_bucket{${labels},le="1"} 2`);
    expect(text).toContain(`${prefix}_bucket{${labels},le="10"} 2`);
    expect(text).toContain(`${prefix}_bucket{${labels},le="+Inf"} 3`);
    expect(text).toContain(`${prefix}_sum{${labels}} 20.730000`);
    expect(text).toContain(`${prefix}_count{${labels}} 3`);
  });

  it('conta erros inesperados por rota e tipo', () => {
    const metrics = new Metrics();

    metrics.error('/api/v1/cart', 'TypeError');
    metrics.error('/api/v1/cart', 'TypeError');

    expect(metrics.render()).toContain(
      'fenix_http_errors_total{route="/api/v1/cart",error="TypeError"} 2'
    );
  });

  it('escapa aspas e barras nos rótulos', () => {
    const metrics = new Metrics();

    metrics.error('/a"b\\c', 'Erro');

    expect(metrics.render()).toContain('route="/a\\"b\\\\c"');
  });

  it('declara tipo e ajuda de cada métrica e as do processo', () => {
    const text = new Metrics().render();

    expect(text).toContain('# TYPE fenix_http_requests_total counter');
    expect(text).toContain('# TYPE fenix_http_request_duration_seconds histogram');
    expect(text).toContain('# TYPE fenix_http_errors_total counter');
    expect(text).toMatch(/^fenix_process_uptime_seconds \d+$/m);
    expect(text).toMatch(/^fenix_process_resident_memory_bytes \d+$/m);
    expect(text.endsWith('\n')).toBe(true);
  });
});
