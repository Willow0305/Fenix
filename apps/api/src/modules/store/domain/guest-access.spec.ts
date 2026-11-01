import {
  formatGuestCode,
  generateGuestCode,
  GUEST_CODE_ALPHABET,
  guestCodeHash,
  guestOrderPath,
  normalizeGuestCode
} from './guest-access';

describe('código do pedido sem conta (DT-096)', () => {
  it('gera 8 caracteres sem os que se confundem', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateGuestCode();

      expect(code).toMatch(new RegExp(`^[${GUEST_CODE_ALPHABET}]{8}$`));
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it('mostra em dois grupos', () => {
    expect(formatGuestCode('K7QH3MXP')).toBe('K7QH-3MXP');
  });

  it('aceita minúsculas, espaços e traço', () => {
    expect(normalizeGuestCode(' k7qh-3mxp ')).toBe('K7QH3MXP');
    expect(normalizeGuestCode('K7QH 3MXP')).toBe('K7QH3MXP');
    expect(guestCodeHash('k7qh-3mxp')).toBe(guestCodeHash('K7QH3MXP'));
  });

  it('mantém o código antigo exatamente como foi enviado', () => {
    expect(normalizeGuestCode(' aB3dE_fG-hIjK1mNo ')).toBe('aB3dE_fG-hIjK1mNo');
  });

  it('monta o link fixo com número e código depois do #', () => {
    expect(guestOrderPath('FNX-261101-ABC123', 'K7QH3MXP')).toBe(
      '/loja/pedido#pedido=FNX-261101-ABC123&codigo=K7QH-3MXP'
    );
  });
});
