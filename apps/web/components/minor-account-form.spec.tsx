import { fireEvent, render, screen } from '@testing-library/react';

import type { AthleteDetail } from '../lib/sports-types';
import { MinorAccountForm } from './minor-account-form';

function athlete(extra: Partial<AthleteDetail>): AthleteDetail {
  return {
    id: 'a1',
    fullName: 'Ana Sub 18',
    status: 'ACTIVE',
    memberships: [],
    ...extra
  } as AthleteDetail;
}

const membership = {
  id: 'm1',
  team: { id: 't1', name: 'Sub-18', type: 'FEMALE' },
  startsOn: '2026-01-10',
  endsOn: null,
  position: null,
  status: 'ACTIVE'
};

describe('conta do atleta menor (DT-092)', () => {
  it('só para atleta ativo em equipe do time', () => {
    render(<MinorAccountForm athlete={athlete({})} onCreated={jest.fn()} />);

    expect(screen.getByText(/só tem conta própria se estiver Ativo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar conta do atleta' })).not.toBeInTheDocument();
  });

  it('pede e-mail e a declaração assinada, com link para imprimir o modelo', () => {
    render(
      <MinorAccountForm athlete={athlete({ memberships: [membership] })} onCreated={jest.fn()} />
    );

    const submit = screen.getByRole('button', { name: 'Criar conta do atleta' });

    expect(submit).toBeDisabled();
    expect(screen.getByRole('link', { name: /Imprimir a declaração/ })).toHaveAttribute(
      'href',
      '/imprimir/declaracao-responsavel/a1'
    );

    fireEvent.change(screen.getByLabelText(/E-mail da conta/), {
      target: { value: 'ana@exemplo.test' }
    });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Declaração assinada/), {
      target: { files: [new File(['%PDF'], 'declaracao.pdf', { type: 'application/pdf' })] }
    });
    expect(submit).toBeEnabled();
  });
});
