'use client';

import Link from 'next/link';

import { Icon } from '../../components/icon';
import { useAuth } from '../../lib/auth-context';
import { plural } from '../../lib/format';
import { useResource } from '../../lib/use-resource';

/**
 * Tarefas da diretoria em ordem de urgência (docs/31, Onda 5). Usa as mesmas contagens das
 * bolinhas do menu (DT-061): dinheiro parado primeiro, depois prazo legal e quem espera
 * resposta, por fim o que só precisa de aprovação.
 */
export const TASKS: readonly {
  readonly href: string;
  readonly icon: string;
  readonly one: string;
  readonly many: string;
}[] = [
  {
    href: '/admin/pix',
    icon: 'qr-code',
    one: 'PIX recebido para conferir',
    many: 'PIX recebidos para conferir'
  },
  {
    href: '/admin/pedidos',
    icon: 'receipt',
    one: 'pedido esperando ação (comprovante, separação ou "não recebi")',
    many: 'pedidos esperando ação (comprovante, separação ou "não recebi")'
  },
  {
    href: '/admin/mensalidades',
    icon: 'calendar-check',
    one: 'pagamento de mensalidade para confirmar',
    many: 'pagamentos de mensalidade para confirmar'
  },
  {
    href: '/admin/privacidade',
    icon: 'incognito',
    one: 'pedido de dados pessoais (LGPD), com prazo legal',
    many: 'pedidos de dados pessoais (LGPD), com prazo legal'
  },
  {
    href: '/admin/devolucoes',
    icon: 'arrow-counterclockwise',
    one: 'desistência ou defeito para resolver',
    many: 'desistências ou defeitos para resolver'
  },
  {
    href: '/admin/seletivas',
    icon: 'clipboard-check',
    one: 'inscrição nova em seletiva',
    many: 'inscrições novas em seletivas'
  },
  {
    href: '/admin/interessados',
    icon: 'person-raised-hand',
    one: 'interessado novo',
    many: 'interessados novos'
  },
  {
    href: '/admin/agendamentos',
    icon: 'calendar-event',
    one: 'agendamento para confirmar',
    many: 'agendamentos para confirmar'
  },
  { href: '/admin/forum', icon: 'flag', one: 'denúncia no fórum', many: 'denúncias no fórum' },
  {
    href: '/admin/avaliacoes',
    icon: 'star',
    one: 'avaliação para aprovar',
    many: 'avaliações para aprovar'
  }
];

export function PendingTasks() {
  const { can } = useAuth();
  const badges = useResource<Record<string, number>>(
    can('dashboard.read') ? '/dashboard/badges' : null
  );
  const open = TASKS.map((task) => ({ ...task, count: badges.data?.[task.href] ?? 0 })).filter(
    (task) => task.count > 0
  );

  if (!badges.data) {
    return null;
  }

  return (
    <section className="card stack" aria-labelledby="para-fazer">
      <h2 id="para-fazer" className="list-title">
        {open.length === 0 ? 'Nada pendente agora' : 'Para fazer agora'}
      </h2>
      {open.length === 0 ? (
        <p className="muted m-0">
          Sem pagamentos para conferir, pedidos parados ou pedidos de resposta. Os indicadores
          abaixo mostram como está o clube.
        </p>
      ) : (
        <ol className="list-plain pending-tasks">
          {open.map((task) => (
            <li key={task.href}>
              <Link href={task.href}>
                <Icon name={task.icon} />
                <span>{plural(task.count, task.one, task.many)}</span>
                <Icon name="chevron-right" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
