import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { GuestResend } from './guest-resend';

const api = jest.fn();

jest.mock('../lib/api-client', () => ({
  api: (...args: unknown[]) => api(...args),
  errorMessage: () => 'Falha'
}));

describe('"Esqueci o código" (DT-096)', () => {
  it('envia o e-mail e mostra a resposta, que lembra do spam', async () => {
    api.mockResolvedValue({
      message:
        'Se houver pedidos sem conta com este e-mail, enviamos o acesso em instantes. Olhe também a caixa de spam.'
    });
    render(<GuestResend />);

    fireEvent.click(screen.getByText('Esqueci o código ou perdi o link'));
    fireEvent.change(screen.getByLabelText(/E-mail usado na compra/), {
      target: { value: ' rita@exemplo.test ' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar acesso' }));

    await waitFor(() => expect(screen.getByText(/caixa de spam/)).toBeInTheDocument());
    expect(api).toHaveBeenCalledWith('/public/orders/resend-access', {
      method: 'POST',
      body: { email: 'rita@exemplo.test' },
      auth: false
    });
  });
});
