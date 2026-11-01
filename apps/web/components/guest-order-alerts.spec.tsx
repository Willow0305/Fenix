import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Order } from '../lib/store-types';
import { GuestOrderAlerts } from './guest-order-alerts';

const api = jest.fn();

jest.mock('../lib/api-client', () => ({
  api: (...args: unknown[]) => api(...args),
  errorMessage: () => 'Falha'
}));

function order(extra: Partial<Order>): Order {
  return {
    orderNumber: 'FNX-261101-ABC123',
    customerEmail: 'rita@exemplo.test',
    customerPhone: '68999994321',
    guestWhatsappOptIn: false,
    ...extra
  } as Order;
}

describe('avisos do pedido sem conta (DT-096)', () => {
  beforeEach(() => api.mockReset());

  it('lembra de olhar o spam e liga o WhatsApp', async () => {
    const onChanged = jest.fn();

    api.mockResolvedValue(order({ guestWhatsappOptIn: true }));
    render(
      <GuestOrderAlerts
        order={order({})}
        access={{ orderNumber: 'FNX-261101-ABC123', code: 'K7QH-3MXP' }}
        onChanged={onChanged}
      />
    );

    expect(screen.getByText(/caixa de spam/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Receber também por WhatsApp' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/public/orders/whatsapp', {
        method: 'POST',
        body: { orderNumber: 'FNX-261101-ABC123', code: 'K7QH-3MXP', enabled: true },
        auth: false
      })
    );
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ guestWhatsappOptIn: true }));
  });

  it('sem celular, não oferece WhatsApp', () => {
    render(
      <GuestOrderAlerts
        order={order({ customerPhone: null })}
        access={{ orderNumber: 'FNX-261101-ABC123', code: 'K7QH-3MXP' }}
        onChanged={jest.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /WhatsApp/ })).not.toBeInTheDocument();
  });
});
