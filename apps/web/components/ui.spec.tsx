import { render, screen } from '@testing-library/react';

import { ApiError } from '../lib/api-client';
import { ErrorSummary, Pagination, TextField } from './ui';

describe('ui', () => {
  it('associates label, hint and error with the input', () => {
    render(<TextField label="E-mail" hint="Use seu e-mail" error="Obrigatório" required />);

    const input = screen.getByLabelText(/E-mail/);

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('hint');
    expect(screen.getByText('Obrigatório')).toBeInTheDocument();
  });

  it('renders problem details with field errors and hides request id for client errors', () => {
    const error = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      title: 'Dados inválidos',
      detail: 'Revise os campos informados.',
      requestId: 'abc',
      errors: [{ field: 'email', code: 'isEmail', message: 'E-mail inválido.' }]
    });

    render(<ErrorSummary error={error} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Revise os campos informados.');
    expect(screen.getByText('E-mail inválido.')).toBeInTheDocument();
    expect(screen.queryByText(/Código para suporte/)).not.toBeInTheDocument();
  });

  it('shows pagination only when there is more than one page', () => {
    const { rerender } = render(
      <Pagination page={1} pageSize={20} total={5} onChange={() => undefined} />
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    rerender(<Pagination page={1} pageSize={20} total={45} onChange={() => undefined} />);
    expect(screen.getByRole('navigation')).toHaveTextContent('Página 1 de 3');
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });
});
