import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';

import { useMenuDismiss } from './use-menu-dismiss';

function Menu({ focusInside = false }: { readonly focusInside?: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  useMenuDismiss({ open, onClose: () => setOpen(false), trigger, panel, focusInside });

  return (
    <>
      <button ref={trigger} type="button" aria-expanded={open} onClick={() => setOpen(true)}>
        Menu
      </button>
      {open ? (
        <nav ref={panel}>
          <a href="/loja">Loja</a>
        </nav>
      ) : null}
    </>
  );
}

describe('useMenuDismiss', () => {
  it('Esc fecha o menu e devolve o foco ao botão', () => {
    render(<Menu />);
    const button = screen.getByRole('button', { name: 'Menu' });

    fireEvent.click(button);
    expect(screen.getByRole('link', { name: 'Loja' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('link', { name: 'Loja' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('leva o foco ao primeiro link quando pedido', () => {
    render(<Menu focusInside />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));

    expect(screen.getByRole('link', { name: 'Loja' })).toHaveFocus();
  });

  it('não reage a Esc com o menu fechado', () => {
    render(<Menu />);
    const button = screen.getByRole('button', { name: 'Menu' });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).not.toHaveFocus();
  });
});
