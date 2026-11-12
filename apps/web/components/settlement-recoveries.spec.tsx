import { fireEvent, render, screen } from '@testing-library/react';

import type { SettlementRecovery } from '../lib/partner-types';
import { SettlementRecoveriesPicker } from './settlement-recoveries';

const sale = (id: string, orderNumber: string, amount: string): SettlementRecovery => ({
  settlementItemId: id,
  settlementId: 's1',
  orderId: `o-${id}`,
  orderNumber,
  productName: 'Camisa do parceiro',
  quantity: 1,
  orderStatus: 'CANCELLED',
  amount: { amount, currency: 'BRL' },
  paidOutAt: '2026-11-05T15:00:00.000Z'
});

describe('vendas estornadas depois do repasse (DT-111)', () => {
  it('lista as vendas marcadas, com valor e data do repasse', () => {
    render(
      <SettlementRecoveriesPicker
        items={[sale('a', 'FNX-1', '45.00'), sale('b', 'FNX-2', '10.50')]}
        skipped={new Set()}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByRole('group', { name: 'Vendas estornadas depois do repasse' })).toBeTruthy();

    const boxes = screen.getAllByRole('checkbox');

    expect(boxes).toHaveLength(2);
    expect(boxes.every((box) => (box as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(/Pedido FNX-1: 1× Camisa do parceiro/).textContent).toMatch(
      /R\$\s45,00 \(repassado em 05\/11\/2026/
    );
  });

  it('desmarcar avisa qual venda fica para depois', () => {
    const onToggle = jest.fn();

    render(
      <SettlementRecoveriesPicker
        items={[sale('a', 'FNX-1', '45.00'), sale('b', 'FNX-2', '10.50')]}
        skipped={new Set(['b'])}
        onToggle={onToggle}
      />
    );

    const [first, second] = screen.getAllByRole('checkbox') as HTMLInputElement[];

    expect(first?.checked).toBe(true);
    expect(second?.checked).toBe(false);
    fireEvent.click(first as HTMLInputElement);
    expect(onToggle).toHaveBeenCalledWith('a', false);
    fireEvent.click(second as HTMLInputElement);
    expect(onToggle).toHaveBeenCalledWith('b', true);
  });
});
