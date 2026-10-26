import { jobErrorLabel, jobErrorTrace, scheduledJobsEnabled } from './job-scheduler';

describe('jobErrorLabel', () => {
  it('guarda só o tipo do erro, sem a mensagem', () => {
    expect(jobErrorLabel(new RangeError('cpf 123.456.789-00'))).toBe('RangeError');
  });

  it('inclui o código quando o erro tem um', () => {
    const error = Object.assign(new Error('falha'), { name: 'PrismaClientKnownRequestError' });

    expect(jobErrorLabel(Object.assign(error, { code: 'P2002' }))).toBe(
      'PrismaClientKnownRequestError (P2002)'
    );
  });

  it('trata valores que não são erro', () => {
    expect(jobErrorLabel('texto')).toBe('Erro desconhecido');
  });
});

describe('jobErrorTrace', () => {
  it('mostra onde o erro ocorreu sem repetir a mensagem', () => {
    const trace = jobErrorTrace(new Error('e-mail ana@exemplo.com'));

    expect(trace).toContain('at ');
    expect(trace).not.toContain('ana@exemplo.com');
  });
});

describe('scheduledJobsEnabled', () => {
  it('liga fora de testes', () => {
    expect(scheduledJobsEnabled({ NODE_ENV: 'production' })).toBe(true);
  });

  it.each([
    [{ NODE_ENV: 'test' }],
    [{ NODE_ENV: 'production', SCHEDULED_JOBS: 'off' }],
    [{ NODE_ENV: 'production', ORDER_EXPIRY_JOB: 'off' }]
  ])('desliga com %p', (env) => {
    expect(scheduledJobsEnabled(env)).toBe(false);
  });
});
