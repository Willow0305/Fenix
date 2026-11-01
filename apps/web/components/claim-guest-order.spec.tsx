import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Order } from '../lib/store-types';
import { ClaimGuestOrder } from './claim-guest-order';
import { EmailVerificationNotice } from './email-verification-notice';
import type { Profile } from '../lib/api-types';

let authStatus: 'authenticated' | 'anonymous' = 'authenticated';
const api = jest.fn();

jest.mock('../lib/auth-context', () => ({
  useAuth: () => ({ status: authStatus })
}));
jest.mock('../lib/api-client', () => ({
  api: (...args: unknown[]) => api(...args),
  errorMessage: () => 'Falha'
}));

const access = { orderNumber: 'FNX-261101-ABC123', code: 'K7QH-3MXP' };
const guestOrder = { id: 'o1', orderNumber: access.orderNumber, isGuest: true } as Order;

describe('trazer pedido sem conta para a conta (DT-096)', () => {
  beforeEach(() => api.mockReset());

  it('logado, traz o pedido e mostra o link para Meus pedidos', async () => {
    authStatus = 'authenticated';
    api.mockResolvedValue({ ...guestOrder, isGuest: false });
    render(<ClaimGuestOrder order={guestOrder} access={access} />);

    fireEvent.click(screen.getByRole('button', { name: 'Trazer para minha conta' }));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Ver em Meus pedidos' })).toHaveAttribute(
        'href',
        '/minha-conta/pedidos/o1'
      )
    );
    expect(api).toHaveBeenCalledWith('/me/orders/claim', { method: 'POST', body: access });
  });

  it('sem login, não aparece', () => {
    authStatus = 'anonymous';
    render(<ClaimGuestOrder order={guestOrder} access={access} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('aviso de confirmar o e-mail só aparece para e-mail não confirmado', () => {
    const profile = { email: 'rita@exemplo.test', emailVerified: false } as Profile;
    const { rerender } = render(<EmailVerificationNotice profile={profile} />);

    expect(screen.getByText(/caixa de spam/)).toBeInTheDocument();
    rerender(<EmailVerificationNotice profile={{ ...profile, emailVerified: true }} />);
    expect(screen.queryByText(/Confirme seu e-mail/)).not.toBeInTheDocument();
  });
});
