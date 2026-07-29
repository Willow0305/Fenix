import { render, screen } from '@testing-library/react';

import LoginPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: jest.fn()
  })
}));

describe('LoginPage', () => {
  it('renders an accessible credential form and recovery link', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('link', { name: /esqueci minha senha/i })).toHaveAttribute(
      'href',
      '/recuperar-senha'
    );
  });
});
