import { JsonLogger, useJsonLogs } from './json-logger';

type Line = { line: string; level: string };

function capture(includeStack = false): { logger: JsonLogger; lines: Line[] } {
  const lines: Line[] = [];
  const logger = new JsonLogger((line, level) => lines.push({ line, level }), includeStack);

  return { logger, lines };
}

function parsed(lines: Line[], index = 0): Record<string, unknown> {
  return JSON.parse(lines[index]?.line ?? '{}') as Record<string, unknown>;
}

describe('JsonLogger', () => {
  it('escreve uma linha JSON com instante, nível, contexto e mensagem', () => {
    const { logger, lines } = capture();

    logger.log('API iniciada', 'Bootstrap');

    expect(lines).toHaveLength(1);
    expect(lines[0]?.line).not.toContain('\n');
    expect(parsed(lines)).toEqual({
      time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      level: 'info',
      context: 'Bootstrap',
      msg: 'API iniciada'
    });
  });

  it('espalha mensagem em objeto nos campos da linha', () => {
    const { logger, lines } = capture();

    logger.log({ msg: 'requisição', status: 200, ms: 12 }, 'Acesso');

    expect(parsed(lines)).toMatchObject({
      level: 'info',
      context: 'Acesso',
      msg: 'requisição',
      status: 200,
      ms: 12
    });
  });

  it('usa os níveis do Nest e deixa o contexto de fora quando não vem', () => {
    const { logger, lines } = capture();

    logger.warn('aviso');
    logger.debug('depuração', 'Ctx');
    logger.verbose('detalhe', 'Ctx');
    logger.fatal('queda', 'Ctx');

    expect(lines.map(({ level }) => level)).toEqual(['warn', 'debug', 'verbose', 'fatal']);
    expect(parsed(lines)).not.toHaveProperty('context');
  });

  it('inclui a pilha do erro só quando permitido', () => {
    const fora = capture(true);
    const producao = capture(false);

    fora.logger.error('falhou', 'Error: x\n    at y', 'Pedidos');
    producao.logger.error('falhou', 'Error: x\n    at y', 'Pedidos');

    expect(parsed(fora.lines)).toMatchObject({
      level: 'error',
      context: 'Pedidos',
      stack: 'Error: x\n    at y'
    });
    expect(parsed(producao.lines)).not.toHaveProperty('stack');
    expect(parsed(producao.lines)).toMatchObject({ context: 'Pedidos' });
  });

  it('manda erro e queda para a saída de erro', () => {
    const { logger, lines } = capture();

    logger.error('falhou');

    expect(lines[0]?.level).toBe('error');
  });
});

describe('useJsonLogs', () => {
  it('usa JSON em produção e texto no desenvolvimento por padrão', () => {
    expect(useJsonLogs({ NODE_ENV: 'production' })).toBe(true);
    expect(useJsonLogs({ NODE_ENV: 'development' })).toBe(false);
    expect(useJsonLogs({})).toBe(false);
  });

  it('respeita LOG_FORMAT', () => {
    expect(useJsonLogs({ NODE_ENV: 'production', LOG_FORMAT: 'text' })).toBe(false);
    expect(useJsonLogs({ NODE_ENV: 'development', LOG_FORMAT: 'json' })).toBe(true);
  });
});
