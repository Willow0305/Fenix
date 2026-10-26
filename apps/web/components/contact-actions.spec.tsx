import { render, screen } from '@testing-library/react';

import { ContactActions } from './contact-actions';
import { WhatsAppButton } from './whatsapp-button';

describe('contato direto', () => {
  it('mostra WhatsApp e e-mail com destino e assunto', () => {
    render(
      <ContactActions phone="68999990000" email="ana@exemplo.com" who="atleta" subject="Treino" />
    );

    expect(screen.getByRole('link', { name: 'Abrir WhatsApp do(a) atleta' })).toHaveAttribute(
      'href',
      'https://wa.me/5568999990000'
    );
    expect(screen.getByRole('link', { name: 'Enviar e-mail ao(à) atleta' })).toHaveAttribute(
      'href',
      'mailto:ana@exemplo.com?subject=Treino'
    );
  });

  it('não mostra nada sem contato válido', () => {
    const { container } = render(<ContactActions phone="123" email={null} who="atleta" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('atalho do site só aparece com o telefone do clube', () => {
    const { container, rerender } = render(<WhatsAppButton phone={null} teamName="Fênix" />);

    expect(container).toBeEmptyDOMElement();

    rerender(<WhatsAppButton phone="68999990000" teamName="Fênix" />);

    expect(screen.getByRole('link', { name: 'Conversar com o Fênix no WhatsApp' })).toHaveAttribute(
      'href',
      `https://wa.me/5568999990000?text=${encodeURIComponent('Olá, Fênix! Vim pelo site.')}`
    );
  });
});
