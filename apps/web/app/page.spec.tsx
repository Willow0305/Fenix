import { render, screen } from '@testing-library/react';

import HomePage from './page';

describe('HomePage', () => {
  it('renders the authorized local entry point for the Phase 1 to 3 slices', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Uma base segura para organizar o Fênix.'
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /acessar área restrita/i })).toHaveAttribute(
      'href',
      '/login'
    );
    expect(
      screen.getByText(/somente ambiente local\/teste e dados fictícios/i)
    ).toBeInTheDocument();
  });
});
