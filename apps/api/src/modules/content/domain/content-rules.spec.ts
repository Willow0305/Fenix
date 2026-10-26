import { canTransition } from '../../../common/domain/state-machine';
import {
  ANONYMOUS,
  authorCanEdit,
  canRead,
  NEWS_TRANSITIONS,
  newsIsPublic,
  publicationState,
  rateExceeded,
  readableVisibilities,
  sanitizeText,
  strictestVisibility,
  visibleTopicStatuses
} from './content-rules';

describe('regras de conteúdo', () => {
  const now = new Date('2026-10-19T12:00:00Z');

  it('mostra notícia só quando publicada e depois do horário agendado', () => {
    const base = { status: 'PUBLISHED' as const, publishedAt: now, deletedAt: null };

    expect(newsIsPublic(base, now)).toBe(true);
    expect(
      newsIsPublic(
        { ...base, status: 'SCHEDULED', publishedAt: new Date('2026-10-20T00:00:00Z') },
        now
      )
    ).toBe(false);
    expect(
      newsIsPublic(
        { ...base, status: 'SCHEDULED', publishedAt: new Date('2026-10-19T11:59:59Z') },
        now
      )
    ).toBe(true);
    expect(newsIsPublic({ ...base, status: 'HIDDEN' }, now)).toBe(false);
    expect(newsIsPublic({ ...base, status: 'DRAFT' }, now)).toBe(false);
    expect(newsIsPublic({ ...base, deletedAt: now }, now)).toBe(false);
  });

  it('agenda publicação futura e publica na hora nos demais casos', () => {
    const future = new Date('2026-10-25T10:00:00Z');

    expect(publicationState(future, now)).toEqual({ status: 'SCHEDULED', publishedAt: future });
    expect(publicationState(null, now)).toEqual({ status: 'PUBLISHED', publishedAt: now });
    expect(publicationState(new Date('2026-10-01T00:00:00Z'), now).status).toBe('PUBLISHED');
    expect(canTransition(NEWS_TRANSITIONS, 'ARCHIVED', 'PUBLISHED')).toBe(false);
  });

  it('aplica a visibilidade do fórum para cada pessoa', () => {
    const member = { authenticated: true, member: true, staff: false };
    const staff = { authenticated: true, member: false, staff: true };
    const user = { authenticated: true, member: false, staff: false };

    expect(canRead('PUBLIC', ANONYMOUS)).toBe(true);
    expect(canRead('MEMBERS', user)).toBe(false);
    expect(canRead('MEMBERS', member)).toBe(true);
    expect(canRead('STAFF', member)).toBe(false);
    expect(canRead('STAFF', staff)).toBe(true);
    expect(readableVisibilities(user)).toEqual(['PUBLIC']);
    expect(readableVisibilities(staff)).toEqual(['PUBLIC', 'MEMBERS', 'STAFF']);
    expect(strictestVisibility('PUBLIC', 'MEMBERS')).toBe('MEMBERS');
    expect(strictestVisibility('STAFF', 'PUBLIC')).toBe('STAFF');
    expect(visibleTopicStatuses(user)).not.toContain('HIDDEN');
    expect(visibleTopicStatuses(staff)).toContain('HIDDEN');
  });

  it('remove marcação e caracteres de controle do texto do usuário', () => {
    expect(
      sanitizeText('  Olá <script>alert(1)</script> <b>time</b>\r\n\r\n\r\n\r\nFim\u0007 ')
    ).toBe('Olá alert(1) time\n\nFim');
    expect(sanitizeText('2 < 3 e 5 > 4')).toBe('2 < 3 e 5 > 4');
  });

  it('aplica limites de publicação e o prazo de edição do autor', () => {
    expect(rateExceeded({ recentCount: 5, limit: 6 })).toBe(false);
    expect(rateExceeded({ recentCount: 6, limit: 6 })).toBe(true);
    expect(authorCanEdit(new Date('2026-10-18T13:00:00Z'), now)).toBe(true);
    expect(authorCanEdit(new Date('2026-10-18T11:00:00Z'), now)).toBe(false);
  });
});
