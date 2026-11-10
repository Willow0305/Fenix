import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { Alert } from './ui';
import { LiveAnnouncer, resetAnnouncerForTests } from './live-announcer';

jest.mock('next/navigation', () => ({ usePathname: () => '/admin' }));

function Page() {
  const [saved, setSaved] = useState(false);

  return (
    <>
      <Alert kind="info">Aviso que já estava na página.</Alert>
      <button type="button" onClick={() => setSaved(true)}>
        Salvar
      </button>
      {saved ? <Alert kind="success">Alterações salvas.</Alert> : null}
    </>
  );
}

describe('anunciador fixo para o leitor de tela (WCAG 4.1.3)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetAnnouncerForTests();
  });
  afterEach(() => jest.useRealTimers());

  it('lê a mensagem que aparece depois de uma ação, não o aviso que já estava na página', () => {
    render(
      <>
        <LiveAnnouncer />
        <Page />
      </>
    );

    const polite = screen.getByRole('status');

    act(() => jest.advanceTimersByTime(100));
    expect(polite).toHaveTextContent('');

    const button = screen.getByRole('button', { name: 'Salvar' });

    fireEvent.pointerDown(button);
    fireEvent.click(button);
    act(() => jest.advanceTimersByTime(100));
    expect(polite).toHaveTextContent('Alterações salvas.');
  });

  it('erro vai para a região que interrompe', () => {
    function Failing() {
      const [failed, setFailed] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setFailed(true)}>
            Enviar
          </button>
          {failed ? <Alert kind="error">Não foi possível salvar.</Alert> : null}
        </>
      );
    }

    render(
      <>
        <LiveAnnouncer />
        <Failing />
      </>
    );

    const button = screen.getByRole('button', { name: 'Enviar' });

    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button);
    act(() => jest.advanceTimersByTime(100));
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar.');
  });
});
