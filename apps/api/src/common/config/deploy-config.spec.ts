import { isInternalRequest } from '../http/internal-request';
import { isInternalHost, loadS3, loadTrustProxy } from './app-config';

describe('implantação (DT-053)', () => {
  it('reconhece serviço da rede interna', () => {
    expect(isInternalHost('http://s3:8333')).toBe(true);
    expect(isInternalHost('http://10.0.0.5:9000')).toBe(true);
    expect(isInternalHost('http://172.20.0.3:8333')).toBe(true);
    expect(isInternalHost('http://storage.exemplo.com')).toBe(false);
    expect(isInternalHost('http://172.40.0.1')).toBe(false);
  });

  it('S3 público em produção exige https; interno pode usar http', () => {
    const base = { S3_BUCKET: 'fenix' };

    expect(() => loadS3({ ...base, S3_ENDPOINT: 'http://storage.exemplo.com' }, true)).toThrow(
      'https'
    );
    expect(loadS3({ ...base, S3_ENDPOINT: 'http://s3:8333' }, true)).toMatchObject({
      forcePathStyle: true,
      serverSideEncryption: true
    });
    expect(loadS3(base, true)).toMatchObject({ endpoint: null, forcePathStyle: false });
    expect(() => loadS3({ ...base, S3_ACCESS_KEY_ID: 'só a chave' }, true)).toThrow('juntos');
  });

  it('proxy confiável: padrão só a própria máquina e valores bem formados', () => {
    expect(loadTrustProxy({})).toBe('loopback');
    expect(loadTrustProxy({ TRUST_PROXY: 'loopback,uniquelocal' })).toBe('loopback,uniquelocal');
    expect(loadTrustProxy({ TRUST_PROXY: '172.16.0.0/12' })).toBe('172.16.0.0/12');
    expect(() => loadTrustProxy({ TRUST_PROXY: 'true; rm' })).toThrow('TRUST_PROXY');
  });

  it('leitura interna do site só com o segredo exato', () => {
    const req = (value?: string) => ({ header: () => value }) as never;

    expect(isInternalRequest(req('segredo-certo'), 'segredo-certo')).toBe(true);
    expect(isInternalRequest(req('segredo-errad'), 'segredo-certo')).toBe(false);
    expect(isInternalRequest(req(undefined), 'segredo-certo')).toBe(false);
    expect(isInternalRequest(req('x'), undefined)).toBe(false);
  });
});
