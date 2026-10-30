import { fireEvent, render, screen } from '@testing-library/react';

import { NewsGallery } from './news-gallery';

const images = [
  { id: 'a', url: '/a.webp', altText: 'Bloqueio triplo' },
  { id: 'b', url: '/b.webp', altText: null }
];

describe('galeria da notícia', () => {
  beforeAll(() => {
    // O jsdom não implementa a janela modal nativa.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  it('abre a foto com legenda e passa para a próxima e a anterior, em volta', () => {
    render(<NewsGallery images={images} />);

    expect(screen.getByRole('heading', { name: 'Galeria (2 fotos)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir foto 1 de 2: Bloqueio triplo' }));
    expect(screen.getByRole('img', { name: 'Bloqueio triplo' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima foto' }));
    expect(screen.getByRole('img', { name: 'Foto 2 da galeria' })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('dialog', { hidden: true }), { key: 'ArrowRight' });
    expect(screen.getByRole('img', { name: 'Bloqueio triplo' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fechar/ }));
    expect(screen.queryByRole('img', { name: 'Bloqueio triplo' })).not.toBeInTheDocument();
  });
});
