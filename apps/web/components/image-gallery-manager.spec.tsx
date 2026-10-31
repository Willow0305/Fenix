import { render, screen } from '@testing-library/react';

import { type GalleryImage, ImageGalleryManager } from './image-gallery-manager';

jest.mock('../lib/api-client', () => ({
  api: jest.fn(),
  ApiError: class extends Error {},
  errorMessage: () => 'Falha'
}));

const photo = (id: string): GalleryImage => ({ id, url: `/api/v1/media/${id}`, altText: null });

function renderManager(images: readonly GalleryImage[]) {
  render(
    <ImageGalleryManager<{ images: GalleryImage[] }>
      basePath="/team-settings/photos"
      images={images}
      onChange={jest.fn()}
      max={2}
      title="Fotos do clube"
      intro="Passam sozinhas na página Sobre."
      emptyText="Nenhuma foto."
      placeholder="Descrição da foto"
      removeDescription="A foto sai do site."
      noun="no clube"
      imagesOf={(detail) => detail.images}
    />
  );
}

describe('gerenciador de fotos', () => {
  it('no limite, o motivo de não poder recortar fica escrito na tela', () => {
    renderManager([photo('a'), photo('b')]);

    expect(screen.getAllByRole('button', { name: /Recortar/ })[0]).toBeDisabled();
    expect(
      screen.getByText(
        'Limite de 2 fotos no clube atingido. Para enviar ou recortar, remova uma foto antes.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Adicionar fotos/)).not.toBeInTheDocument();
  });

  it('abaixo do limite, recortar fica livre e o envio aparece', () => {
    renderManager([photo('a')]);

    expect(screen.getByRole('button', { name: /Recortar/ })).toBeEnabled();
    expect(screen.queryByText(/Limite de/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Adicionar fotos/)).toBeInTheDocument();
  });
});
