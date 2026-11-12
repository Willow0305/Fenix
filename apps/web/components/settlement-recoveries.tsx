import { formatDateTime, formatMoney } from '../lib/format';
import type { SettlementRecovery } from '../lib/partner-types';

/**
 * Vendas já repassadas cujo pedido foi estornado depois (PEN-052, DT-111). Vêm marcadas: a
 * diretoria desmarca o que vai combinar de outro jeito, e o desmarcado continua aqui para o
 * próximo repasse.
 */
export function SettlementRecoveriesPicker({
  items,
  skipped,
  onToggle
}: {
  readonly items: readonly SettlementRecovery[];
  readonly skipped: ReadonlySet<string>;
  readonly onToggle: (id: string, include: boolean) => void;
}) {
  return (
    <fieldset className="stack">
      <legend>Vendas estornadas depois do repasse</legend>
      <p className="muted">
        O parceiro já recebeu por estas vendas, mas o pedido foi estornado ou cancelado. As marcadas
        são descontadas deste repasse.
      </p>
      {items.map((item) => (
        <label key={item.settlementItemId} className="checkbox">
          <input
            type="checkbox"
            checked={!skipped.has(item.settlementItemId)}
            onChange={(e) => onToggle(item.settlementItemId, e.target.checked)}
          />
          <span>
            Pedido {item.orderNumber}: {item.quantity}× {item.productName} —{' '}
            {formatMoney(item.amount.amount)}
            {item.paidOutAt ? ` (repassado em ${formatDateTime(item.paidOutAt)})` : ''}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
