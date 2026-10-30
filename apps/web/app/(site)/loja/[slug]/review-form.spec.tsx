import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { MyReview } from '../../../../lib/store-types';
import { ReviewForm } from './review-form';

let mine: MyReview | undefined;
const api = jest.fn();

jest.mock('../../../../lib/auth-context', () => ({
  useAuth: () => ({ status: 'authenticated' })
}));
jest.mock('../../../../lib/use-resource', () => ({
  useResource: () => ({ data: mine, reload: jest.fn() })
}));
jest.mock('../../../../lib/api-client', () => ({
  api: (...args: unknown[]) => api(...args),
  errorMessage: () => 'Falha'
}));

describe('formulário de avaliação', () => {
  beforeEach(() => {
    api.mockReset().mockResolvedValue(undefined);
  });

  it('não aparece para quem não comprou e recebeu', () => {
    mine = { canReview: false, review: null };
    const { container } = render(<ReviewForm productId="p1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('pede a nota antes de enviar e envia nota e comentário', async () => {
    mine = { canReview: true, review: null };
    render(<ReviewForm productId="p1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));
    expect(await screen.findByText('Escolha de 1 a 5 estrelas.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('4 estrelas'));
    fireEvent.change(screen.getByLabelText(/Comentário/), { target: { value: 'Boa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/me/reviews/p1', {
        method: 'PUT',
        body: { rating: 4, comment: 'Boa' }
      })
    );
  });

  it('mostra o motivo quando não foi publicada', () => {
    mine = {
      canReview: true,
      review: { rating: 2, comment: null, status: 'REJECTED', moderationReason: 'Outro produto.' }
    };
    render(<ReviewForm productId="p1" />);

    expect(screen.getByText('Não publicada')).toBeInTheDocument();
    expect(screen.getByText(/Outro produto\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizar avaliação' })).toBeInTheDocument();
  });
});
