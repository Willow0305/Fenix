import { render, screen } from '@testing-library/react';

import AccessDeniedPage from './page';

describe('AccessDeniedPage', () => {
  it('explains that authentication does not imply authorization', () => {
    render(<AccessDeniedPage />);

    expect(screen.getByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument();
    expect(screen.getByText(/não possui autorização/i)).toBeInTheDocument();
  });
});
