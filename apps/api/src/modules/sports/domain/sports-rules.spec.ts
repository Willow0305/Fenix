import { addMonths, ageOn, daysInMonth, isCivilDate } from '../../../common/domain/civil-date';
import { canTransition } from '../../../common/domain/state-machine';
import {
  ATHLETE_TRANSITIONS,
  INTERESTED_TRANSITIONS,
  normalizeDocument,
  periodsOverlap,
  registrationBlock,
  slugify,
  TRYOUT_REGISTRATION_TRANSITIONS,
  TRYOUT_TRANSITIONS,
  validateGuardian
} from './sports-rules';

const TODAY = '2026-10-18';

describe('datas civis', () => {
  it('valida datas reais do calendário', () => {
    expect(isCivilDate('2026-02-28')).toBe(true);
    expect(isCivilDate('2026-02-30')).toBe(false);
    expect(isCivilDate('18/10/2026')).toBe(false);
  });

  it('calcula a idade considerando o aniversário', () => {
    expect(ageOn('2008-10-18', TODAY)).toBe(18);
    expect(ageOn('2008-10-19', TODAY)).toBe(17);
  });

  it('soma meses entre anos e conhece o tamanho do mês', () => {
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-01');
    expect(daysInMonth('2028-02-01')).toBe(29);
  });
});

describe('validateGuardian', () => {
  const codes = (
    input: Parameters<typeof validateGuardian>[0],
    ctx: 'admin' | 'public' = 'admin'
  ) => validateGuardian(input, TODAY, ctx).map((e) => e.code);

  it('não exige nada de adulto ou sem data de nascimento', () => {
    expect(codes({ birthDate: '2000-01-01', guardianName: null, guardianPhone: null })).toEqual([]);
    expect(codes({ birthDate: null, guardianName: null, guardianPhone: null })).toEqual([]);
  });

  it('exige nome e telefone do responsável para menor', () => {
    expect(codes({ birthDate: '2012-01-01', guardianName: null, guardianPhone: ' ' })).toEqual([
      'GUARDIAN_REQUIRED',
      'GUARDIAN_REQUIRED'
    ]);
  });

  it('barra inscrição pública de menor de 12 e exige ciência registrada pela diretoria', () => {
    const child = { birthDate: '2016-05-05', guardianName: 'Mãe', guardianPhone: '6899' };

    expect(codes(child, 'public')).toEqual(['UNDER_MINIMUM_AGE']);
    expect(codes(child, 'admin')).toEqual(['GUARDIAN_ACK_REQUIRED']);
    expect(codes({ ...child, guardianAcknowledged: true }, 'admin')).toEqual([]);
  });

  it('recusa data de nascimento impossível', () => {
    expect(codes({ birthDate: '2030-01-01', guardianName: null, guardianPhone: null })).toEqual([
      'INVALID_BIRTH_DATE'
    ]);
  });
});

describe('máquinas de estado', () => {
  it('status do atleta', () => {
    expect(canTransition(ATHLETE_TRANSITIONS, 'PENDING', 'ACTIVE')).toBe(true);
    expect(canTransition(ATHLETE_TRANSITIONS, 'INACTIVE', 'SUSPENDED')).toBe(false);
  });

  it('o ciclo da seletiva termina ao concluir ou cancelar', () => {
    expect(canTransition(TRYOUT_TRANSITIONS, 'CLOSED', 'OPEN')).toBe(true);
    expect(canTransition(TRYOUT_TRANSITIONS, 'COMPLETED', 'OPEN')).toBe(false);
    expect(canTransition(TRYOUT_TRANSITIONS, 'CANCELLED', 'DRAFT')).toBe(false);
  });

  it('fluxo de análise da inscrição', () => {
    expect(canTransition(TRYOUT_REGISTRATION_TRANSITIONS, 'NEW', 'APPROVED')).toBe(true);
    expect(canTransition(TRYOUT_REGISTRATION_TRANSITIONS, 'APPROVED', 'ATTENDED')).toBe(true);
    expect(canTransition(TRYOUT_REGISTRATION_TRANSITIONS, 'ATTENDED', 'NEW')).toBe(false);
  });

  it('interessado só vira atleta pela ação de conversão', () => {
    expect(canTransition(INTERESTED_TRANSITIONS, 'QUALIFIED', 'CONVERTED')).toBe(false);
  });
});

describe('registrationBlock', () => {
  const now = new Date('2026-10-18T15:00:00Z');
  const base = {
    status: 'OPEN' as const,
    registrationStartsAt: null,
    registrationEndsAt: null,
    maxSlots: null
  };

  it('aceita seletiva aberta', () => {
    expect(registrationBlock(base, 0, now)).toBeNull();
  });

  it('barra por status, período e vagas', () => {
    expect(registrationBlock({ ...base, status: 'DRAFT' }, 0, now)).toBe('NOT_OPEN');
    expect(
      registrationBlock({ ...base, registrationStartsAt: new Date('2026-10-19T00:00:00Z') }, 0, now)
    ).toBe('NOT_STARTED');
    expect(
      registrationBlock({ ...base, registrationEndsAt: new Date('2026-10-18T14:59:59Z') }, 0, now)
    ).toBe('ENDED');
    expect(registrationBlock({ ...base, maxSlots: 2 }, 2, now)).toBe('FULL');
  });
});

describe('utilitários', () => {
  it('detecta vínculos com períodos sobrepostos', () => {
    expect(
      periodsOverlap(
        { startsOn: '2026-01-01', endsOn: null },
        { startsOn: '2026-06-01', endsOn: '2026-07-01' }
      )
    ).toBe(true);
    expect(
      periodsOverlap(
        { startsOn: '2026-01-01', endsOn: '2026-05-31' },
        { startsOn: '2026-06-01', endsOn: null }
      )
    ).toBe(false);
  });

  it('gera slug e normaliza documentos', () => {
    expect(slugify('Seletiva Sub-17 Feminino 2026!')).toBe('seletiva-sub-17-feminino-2026');
    expect(normalizeDocument('123.456.789-0x')).toBe('1234567890X');
  });
});
