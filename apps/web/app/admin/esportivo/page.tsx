import Link from 'next/link';

import { SportsPageHeader } from './_components/sports-ui';
import styles from './esportivo.module.scss';

const DESTINATIONS = [
  {
    href: '/admin/esportivo/equipes',
    title: 'Equipes e categorias',
    description: 'Organize os agrupamentos esportivos sem perder o histórico dos vínculos.'
  },
  {
    href: '/admin/esportivo/atletas',
    title: 'Atletas',
    description: 'Consulte perfis separados das contas e seus vínculos esportivos.'
  },
  {
    href: '/admin/esportivo/responsaveis',
    title: 'Responsáveis',
    description: 'Acompanhe vínculos e a validade das autorizações protegidas.'
  },
  {
    href: '/admin/esportivo/seletivas',
    title: 'Seletivas',
    description: 'Planeje vagas, período, presença, lista de espera e resultados.'
  },
  {
    href: '/admin/esportivo/inscricoes',
    title: 'Inscrições',
    description: 'Analise estados e alertas de duplicidade sem realizar fusão automática.'
  },
  {
    href: '/admin/esportivo/conversao',
    title: 'Conversão auditada',
    description: 'Converta apenas inscrições aprovadas por uma operação autorizada.'
  }
] as const;

export default function SportsHomePage() {
  return (
    <>
      <SportsPageHeader
        description="Fundação administrativa para equipes, atletas, responsáveis e seletivas, isolada da conta de acesso."
        eyebrow="Operação esportiva"
        title="Módulo esportivo"
      />

      <div className={styles.hubGrid}>
        {DESTINATIONS.map((destination) => (
          <Link className={styles.hubCard} href={destination.href} key={destination.href}>
            <strong>{destination.title}</strong>
            <span>{destination.description}</span>
            <small>Abrir área →</small>
          </Link>
        ))}
      </div>

      <section className={styles.panel} aria-labelledby="phase-two-boundaries">
        <h2 id="phase-two-boundaries">Limites desta entrega</h2>
        <ul className={styles.boundaryList}>
          <li>Conta comum não é convertida automaticamente em atleta.</li>
          <li>Possíveis duplicidades são apenas sinalizadas para análise humana.</li>
          <li>Menores exigem responsável e autorização válida no servidor.</li>
          <li>Nenhum campo médico, diagnóstico, laudo ou dado de saúde é coletado.</li>
        </ul>
      </section>
    </>
  );
}
