import {
  categoryOf,
  channelsFor,
  emailText,
  feeReminderDueDates,
  feeReminderKind,
  feeReminderText,
  MAX_ATTEMPTS,
  retryDelayMs,
  whatsappNumber,
  whatsappParameters,
  whatsappSendAt
} from './channel-rules';

const BOTH = new Set(['EMAIL', 'WHATSAPP'] as const);
const recipient = { email: 'ana@exemplo.com', whatsapp: '5568999990000', whatsappOptIn: true };

describe('categoryOf', () => {
  it.each([
    ['fee.created', 'FINANCE'],
    ['fee.reminder.due-soon', 'FINANCE'],
    ['order.status', 'STORE'],
    ['campaign.arrived', 'STORE'],
    ['tryout_registration.approved', 'SPORTS'],
    ['tryout.cancelled', 'SPORTS'],
    ['athlete.linked', 'SPORTS'],
    ['appointment.status', 'AGENDA'],
    ['announcement', 'ANNOUNCEMENTS'],
    ['forum.reply', 'COMMUNITY'],
    ['content.news', 'NEWS'],
    ['content.event', 'EVENTS'],
    ['content.forum_topic', 'FORUM_TOPICS'],
    ['privacy.request.answered', 'ACCOUNT'],
    ['tipo.desconhecido', 'ACCOUNT']
  ])('%s → %s', (type, category) => {
    expect(categoryOf(type)).toBe(category);
  });
});

describe('channelsFor', () => {
  it('por padrão manda cobrança por e-mail e WhatsApp, e fórum só no painel', () => {
    expect(channelsFor('FINANCE', [], recipient, BOTH)).toEqual(['EMAIL', 'WHATSAPP']);
    expect(channelsFor('COMMUNITY', [], recipient, BOTH)).toEqual([]);
    // Notícias, eventos e novos tópicos só chegam para quem escolheu receber (DT-067).
    expect(channelsFor('NEWS', [], recipient, BOTH)).toEqual([]);
    expect(channelsFor('EVENTS', [], recipient, BOTH)).toEqual([]);
    expect(channelsFor('FORUM_TOPICS', [], recipient, BOTH)).toEqual([]);
  });

  it('respeita a escolha registrada', () => {
    const preferences = [
      { category: 'FINANCE' as const, channel: 'EMAIL', enabled: false },
      { category: 'COMMUNITY' as const, channel: 'EMAIL', enabled: true }
    ];

    expect(channelsFor('FINANCE', preferences, recipient, BOTH)).toEqual(['WHATSAPP']);
    expect(channelsFor('COMMUNITY', preferences, recipient, BOTH)).toEqual(['EMAIL']);
  });

  it('WhatsApp só com consentimento, celular e canal ligado', () => {
    expect(channelsFor('STORE', [], { ...recipient, whatsappOptIn: false }, BOTH)).toEqual([
      'EMAIL'
    ]);
    expect(channelsFor('STORE', [], { ...recipient, whatsapp: null }, BOTH)).toEqual(['EMAIL']);
    expect(channelsFor('STORE', [], recipient, new Set(['EMAIL'] as const))).toEqual(['EMAIL']);
  });
});

describe('whatsappNumber', () => {
  it.each([
    ['68999990000', '5568999990000'],
    ['5568999990000', '5568999990000'],
    ['(68) 99999-0000', '5568999990000']
  ])('aceita celular %s', (phone, expected) => {
    expect(whatsappNumber(phone)).toBe(expected);
  });

  it.each([[null], [''], ['6832240000'], ['01999990000'], ['999990000'], ['68899990000']])(
    'recusa %p (fixo, sem DDD ou inválido)',
    (phone) => {
      expect(whatsappNumber(phone)).toBeNull();
    }
  );
});

describe('retryDelayMs', () => {
  it('espera cada vez mais e desiste na quinta tentativa', () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([60_000, 300_000, 1_800_000, 7_200_000]);
    expect(retryDelayMs(MAX_ATTEMPTS)).toBeNull();
  });
});

describe('whatsappSendAt', () => {
  // Rio Branco é UTC−5 o ano todo.
  const zone = 'America/Rio_Branco';

  it('envia na hora durante o dia', () => {
    const now = new Date('2026-10-25T15:00:00Z'); // 10h

    expect(whatsappSendAt(now, zone)).toBe(now);
  });

  it('adia para as 8h do dia seguinte depois das 21h', () => {
    expect(whatsappSendAt(new Date('2026-10-26T03:00:00Z'), zone).toISOString()).toBe(
      '2026-10-26T13:00:00.000Z'
    );
  });

  it('adia para as 8h do mesmo dia de madrugada', () => {
    expect(whatsappSendAt(new Date('2026-10-26T08:00:00Z'), zone).toISOString()).toBe(
      '2026-10-26T13:00:00.000Z'
    );
  });
});

describe('lembretes de mensalidade', () => {
  it.each([
    ['2026-10-28', 'due-soon'],
    ['2026-10-25', 'due-today'],
    ['2026-10-24', 'overdue-1'],
    ['2026-10-18', 'overdue-7'],
    ['2026-10-27', null],
    ['2026-10-20', null]
  ])('vencimento %s em 25/10 → %p', (dueDate, kind) => {
    expect(feeReminderKind(dueDate, '2026-10-25')).toBe(kind);
  });

  it('consulta exatamente as datas que geram lembrete', () => {
    expect(feeReminderDueDates('2026-10-25')).toEqual([
      '2026-10-28',
      '2026-10-25',
      '2026-10-24',
      '2026-10-18'
    ]);
  });

  it('monta o texto com mês e vencimento, sem valor', () => {
    expect(feeReminderText('due-soon', '2026-11-01', '2026-11-10')).toEqual({
      title: 'Mensalidade vence em 3 dias',
      message:
        'A mensalidade de 11/2026 vence em 10/11. Confira o valor e pague pelo PIX em Minha conta.'
    });
    expect(feeReminderText('overdue-7', '2026-10-01', '2026-10-10').title).toBe(
      'Mensalidade em atraso'
    );
  });
});

describe('conteúdo das mensagens', () => {
  const content = {
    firstName: 'Ana',
    title: 'Pedido 1042: Pronto para retirada',
    message: 'Seu pedido está pronto.\nRetire na sede.',
    url: 'https://fenix.example/minha-conta/pedidos/1',
    preferencesUrl: 'https://fenix.example/minha-conta/notificacoes'
  };

  it('e-mail com saudação, link e onde mudar as preferências', () => {
    const mail = emailText(content);

    expect(mail.subject).toBe('Pedido 1042: Pronto para retirada — Fênix Vôlei');
    expect(mail.text).toContain('Olá, Ana.');
    expect(mail.text).toContain('Acesse: https://fenix.example/minha-conta/pedidos/1');
    expect(mail.text).toContain('https://fenix.example/minha-conta/notificacoes');
  });

  it('parâmetros do WhatsApp sem quebra de linha nem espaços seguidos', () => {
    expect(whatsappParameters({ ...content, title: 'Muitos     espaços' })).toEqual([
      'Ana',
      'Muitos espaços',
      'Seu pedido está pronto. Retire na sede.',
      'https://fenix.example/minha-conta/pedidos/1'
    ]);
  });
});
