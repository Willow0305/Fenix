import { render, screen } from '@testing-library/react';

import { TechnicalStatus } from './technical-status';

describe('TechnicalStatus', () => {
  it('announces its textual status independently of color', () => {
    render(
      <TechnicalStatus label="Base disponível">
        <span>Verificação técnica concluída.</span>
      </TechnicalStatus>
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Base disponívelVerificação técnica concluída.'
    );
  });
});
