'use client';

import { type RefObject, useEffect } from 'react';

/**
 * Menu que abre por um botão (menu do site e menu lateral do painel no celular): Esc fecha e
 * devolve o foco ao botão (WCAG 2.1.1 e 2.4.3). Com `focusInside`, o foco vai para o primeiro
 * link ou botão do painel ao abrir, para quem usa teclado ou leitor de tela começar por ele.
 */
export function useMenuDismiss({
  open,
  onClose,
  trigger,
  panel,
  focusInside = false
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly trigger: RefObject<HTMLElement | null>;
  readonly panel: RefObject<HTMLElement | null>;
  readonly focusInside?: boolean;
}): void {
  useEffect(() => {
    if (!open) {
      return;
    }

    if (focusInside) {
      panel.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        trigger.current?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, trigger, panel, focusInside]);
}
