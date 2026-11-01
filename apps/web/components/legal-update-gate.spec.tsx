import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LegalUpdateGate } from './legal-update-gate';

type Pending = {
  field: 'termsOfUse' | 'privacyPolicy';
  id: string;
  version: number;
  publishedAt: string;
};

let pending: Pending[] = [];
const api = jest.fn();
const reloadProfile = jest.fn();
const logout = jest.fn();

jest.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    status: 'authenticated',
    profile: { pendingLegal: pending },
    reloadProfile,
    logout
  })
}));
jest.mock('../lib/use-resource', () => ({
  useResource: (path: string | null) => ({
    data: path
      ? {
          legalVersions: {
            termsOfUse: { id: 't2', version: 2, publishedAt: '2026-11-01T12:00:00Z' },
            privacyPolicy: { id: 'p1', version: 1, publishedAt: '2026-10-01T12:00:00Z' }
          }
        }
      : undefined,
    reload: jest.fn()
  })
}));
jest.mock('../lib/api-client', () => ({
  api: (...args: unknown[]) => api(...args),
  errorMessage: () => 'Falha'
}));

describe('aceite da versão nova dos termos (DT-094)', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  beforeEach(() => {
    api.mockReset();
    reloadProfile.mockReset();
  });

  it('não aparece sem versão pendente', () => {
    pending = [];
    render(<LegalUpdateGate />);

    expect(screen.queryByRole('button', { name: 'Aceitar e continuar' })).not.toBeInTheDocument();
  });

  it('pede o aceite da versão nova e envia as versões em vigor', async () => {
    pending = [{ field: 'termsOfUse', id: 't2', version: 2, publishedAt: '2026-11-01T12:00:00Z' }];
    render(<LegalUpdateGate />);

    expect(screen.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos');
    expect(screen.getByText(/versão 2, em vigor desde 01\/11\/2026/)).toBeInTheDocument();

    const accept = screen.getByRole('button', { name: 'Aceitar e continuar' });

    expect(accept).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Li e aceito a versão nova.'));
    fireEvent.click(accept);

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/me/legal-acceptances', {
        method: 'POST',
        body: { termsVersionId: 't2', privacyVersionId: 'p1' }
      })
    );
    expect(reloadProfile).toHaveBeenCalled();
  });

  it('a alternativa a aceitar é sair da conta', () => {
    pending = [
      { field: 'privacyPolicy', id: 'p1', version: 1, publishedAt: '2026-10-01T12:00:00Z' }
    ];
    render(<LegalUpdateGate />);

    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(logout).toHaveBeenCalled();
  });
});
