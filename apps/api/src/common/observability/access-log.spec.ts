import { EventEmitter } from 'node:events';

import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

import { accessLogMiddleware, routeOf } from './access-log';
import { metrics } from './metrics';

function fakeRequest(route?: string): Request {
  return {
    method: 'GET',
    baseUrl: '/api/v1/store',
    originalUrl: '/api/v1/store/orders/123?busca=maria',
    ...(route ? { route: { path: route } } : {}),
    fenix: { requestId: 'id-da-requisicao' }
  } as unknown as Request;
}

function fakeResponse(status: number): Response & EventEmitter {
  return Object.assign(new EventEmitter(), { statusCode: status }) as Response & EventEmitter;
}

describe('routeOf', () => {
  it('usa o modelo da rota, sem ids nem busca', () => {
    expect(routeOf(fakeRequest('/orders/:id'))).toBe('/api/v1/store/orders/:id');
  });

  it('marca como não encontrada quando nenhuma rota casou', () => {
    expect(routeOf(fakeRequest())).toBe('nao-encontrada');
  });
});

describe('accessLogMiddleware', () => {
  const original = process.env['ACCESS_LOG'];
  let log: jest.SpyInstance;
  let observe: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    observe = jest.spyOn(metrics, 'observe');
  });

  afterEach(() => {
    jest.restoreAllMocks();

    if (original === undefined) {
      delete process.env['ACCESS_LOG'];
    } else {
      process.env['ACCESS_LOG'] = original;
    }
  });

  it('registra a métrica e a linha de acesso ao terminar a resposta', () => {
    process.env['ACCESS_LOG'] = 'on';
    const req = fakeRequest('/orders/:id');
    const res = fakeResponse(200);
    const next = jest.fn();

    accessLogMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(observe).not.toHaveBeenCalled();

    res.emit('finish');

    expect(observe).toHaveBeenCalledWith(
      'GET',
      '/api/v1/store/orders/:id',
      200,
      expect.any(Number)
    );
    expect(log).toHaveBeenCalledWith({
      msg: 'requisição',
      requestId: 'id-da-requisicao',
      method: 'GET',
      route: '/api/v1/store/orders/:id',
      status: 200,
      ms: expect.any(Number)
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('maria');
  });

  it('com ACCESS_LOG=off só conta a métrica', () => {
    process.env['ACCESS_LOG'] = 'off';
    const res = fakeResponse(404);

    accessLogMiddleware(fakeRequest(), res, jest.fn());
    res.emit('finish');

    expect(observe).toHaveBeenCalledWith('GET', 'nao-encontrada', 404, expect.any(Number));
    expect(log).not.toHaveBeenCalled();
  });
});
