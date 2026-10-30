import { render, screen } from '@testing-library/react';

import { PendingTasks } from './pending-tasks';

let badges: Record<string, number> | undefined;

jest.mock('../../lib/auth-context', () => ({ useAuth: () => ({ can: () => true }) }));
jest.mock('../../lib/use-resource', () => ({ useResource: () => ({ data: badges }) }));

describe('tarefas do painel (Onda 5)', () => {
  it('lista em ordem de urgência, com plural por extenso e link para resolver', () => {
    badges = { '/admin/avaliacoes': 2, '/admin/pix': 1, '/admin/pedidos': 3 };
    render(<PendingTasks />);

    const links = screen.getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      '1 PIX recebido para conferir',
      '3 pedidos esperando ação (comprovante, separação ou "não recebi")',
      '2 avaliações para aprovar'
    ]);
    expect(links[0]).toHaveAttribute('href', '/admin/pix');
  });

  it('sem pendência, diz que está tudo em dia', () => {
    badges = {};
    render(<PendingTasks />);

    expect(screen.getByRole('heading', { name: 'Nada pendente agora' })).toBeInTheDocument();
  });
});
