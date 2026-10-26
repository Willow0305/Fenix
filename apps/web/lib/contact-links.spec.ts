import { mailtoLink, whatsappDigits, whatsappLink } from './contact-links';

describe('links de contato', () => {
  it.each([
    ['68999990000', '5568999990000'],
    ['(68) 3224-0000', '556832240000'],
    ['5568999990000', '5568999990000'],
    ['99990000', null],
    [null, null]
  ])('número do WhatsApp para %p', (phone, expected) => {
    expect(whatsappDigits(phone)).toBe(expected);
  });

  it('monta o wa.me com a mensagem inicial codificada', () => {
    expect(whatsappLink('68999990000', 'Olá, Fênix!')).toBe(
      'https://wa.me/5568999990000?text=Ol%C3%A1%2C%20F%C3%AAnix!'
    );
    expect(whatsappLink('123')).toBeNull();
  });

  it('monta o mailto com assunto', () => {
    expect(mailtoLink('contato@fenix.example', 'Dúvida')).toBe(
      'mailto:contato@fenix.example?subject=D%C3%BAvida'
    );
    expect(mailtoLink('sem-arroba')).toBeNull();
  });
});
