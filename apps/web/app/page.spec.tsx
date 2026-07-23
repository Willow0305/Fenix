import { render, screen } from '@testing-library/react';

import HomePage from './page';

describe('HomePage', () => {
  it('renders the technical Phase 0 status without business actions', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Fênix Vôlei'
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Esqueleto técnico operacional');
    expect(screen.getByText(/nenhum módulo de negócio está ativo/i)).toBeInTheDocument();
  });
});
