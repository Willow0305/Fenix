'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CollectionState, Feedback, SportsPageHeader, StatusBadge } from '../_components/sports-ui';
import {
  type AthleteRecord,
  formatCivilDate,
  getRequestErrorMessage,
  listSportsRecords,
  translateStatus
} from '../_lib/sports-api';
import styles from '../esportivo.module.scss';

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<readonly AthleteRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await listSportsRecords<AthleteRecord>('/athletes');
      setAthletes(response.data);
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Não foi possível carregar os atletas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredAthletes = useMemo(
    () => athletes.filter((athlete) => !statusFilter || athlete.status === statusFilter),
    [athletes, statusFilter]
  );
  const statuses = useMemo(
    () => [...new Set(athletes.map((athlete) => athlete.status))].sort(),
    [athletes]
  );

  return (
    <>
      <SportsPageHeader
        action={
          <Link className={styles.textLink} href="/admin/esportivo/conversao">
            Converter inscrição aprovada
          </Link>
        }
        description="Perfis esportivos são separados de usuários e só surgem por operação administrativa autorizada."
        eyebrow="Pessoas e vínculos"
        title="Atletas"
      />

      <section className={styles.panel} aria-labelledby="athlete-filter-title">
        <div className={styles.panelHeader}>
          <h2 id="athlete-filter-title">Consulta</h2>
          <button className={styles.secondaryButton} onClick={() => void load()} type="button">
            Atualizar
          </button>
        </div>
        <label className={styles.field}>
          Estado do perfil
          <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="">Todos</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {translateStatus(status)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <Feedback error={error} notice="" />

      <CollectionState
        emptyMessage={
          statusFilter
            ? 'Nenhum atleta corresponde ao filtro.'
            : 'Nenhum perfil de atleta fictício foi criado neste ambiente.'
        }
        isEmpty={filteredAthletes.length === 0}
        loading={loading}
      >
        <div className={styles.recordGrid}>
          {filteredAthletes.map((athlete) => (
            <article className={styles.recordCard} key={athlete.id}>
              <div className={styles.cardHeader}>
                <h2>{athlete.fullName}</h2>
                <StatusBadge value={translateStatus(athlete.status)} />
              </div>
              <dl className={styles.metaList}>
                <dt>Nascimento</dt>
                <dd>{formatCivilDate(athlete.birthDate)}</dd>
                <dt>Vínculo atual</dt>
                <dd>
                  {athlete.currentMembership
                    ? `${athlete.currentMembership.team.name} · ${athlete.currentMembership.category.name}`
                    : 'Sem vínculo atual'}
                </dd>
                <dt>Responsável</dt>
                <dd>
                  {!athlete.isMinor
                    ? 'Não aplicável'
                    : athlete.guardianAuthorizationValid
                      ? 'Autorização válida'
                      : 'Autorização pendente ou inválida'}
                </dd>
              </dl>
              {athlete.duplicateWarning ? (
                <p className={styles.notice} role="status">
                  Possível duplicidade: requer análise humana; nenhuma fusão foi realizada.
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </CollectionState>
    </>
  );
}
