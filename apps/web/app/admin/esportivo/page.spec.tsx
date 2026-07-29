import { render, screen } from '@testing-library/react';

import SportsHomePage from './page';

describe('SportsHomePage', () => {
  it('exposes the approved sports administration destinations and safety boundaries', () => {
    render(<SportsHomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Módulo esportivo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /equipes e categorias/i })).toHaveAttribute(
      'href',
      '/admin/esportivo/equipes'
    );
    expect(screen.getByRole('link', { name: /conversão auditada/i })).toHaveAttribute(
      'href',
      '/admin/esportivo/conversao'
    );
    expect(screen.getByText(/conta comum não é convertida automaticamente/i)).toBeInTheDocument();
    expect(screen.getByText(/nenhum campo médico/i)).toBeInTheDocument();
  });
});
