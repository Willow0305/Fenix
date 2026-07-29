'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAdminSession } from '../../admin-shell';
import { CollectionState, Feedback, SportsPageHeader, StatusBadge } from '../_components/sports-ui';
import {
  formatCivilDate,
  formatInstant,
  getRequestErrorMessage,
  listSportsRecords,
  type RegistrationRecord,
  translateStatus,
  updateSportsRecord
} from '../_lib/sports-api';
import styles from '../esportivo.module.scss';

const ALLOWED_STATUS_ACTIONS = [
  'UNDER_REVIEW',
  'WAITLISTED',
  'ATTENDED',
  'NO_SHOW',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
] as const;

export default function RegistrationsPage() {
  const session = useAdminSession();
  const canManage = session.permissions.includes('registrations.review');
  const canConvert = session.permissions.includes('registrations.convert');
  const [registrations, setRegistrations] = useState<readonly RegistrationRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [pendingStatus, setPendingStatus] = useState<Readonly<Record<string, string>>>({});
  const [pendingReason, setPendingReason] = useState<Readonly<Record<string, string>>>({});
  const [updatingId, setUpdatingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await listSportsRecords<RegistrationRecord>('/registrations');
      setRegistrations(response.data);
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Não foi possível carregar as inscrições.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRegistrations = useMemo(
    () =>
      registrations.filter((registration) => !statusFilter || registration.status === statusFilter),
    [registrations, statusFilter]
  );
  const statuses = useMemo(
    () => [...new Set(registrations.map((registration) => registration.status))].sort(),
    [registrations]
  );

  async function changeStatus(registration: RegistrationRecord) {
    const status = pendingStatus[registration.id];
    const reason = pendingReason[registration.id]?.trim();

    if (!status || !reason) {
      return;
    }

    setUpdatingId(registration.id);
    setError('');
    setNotice('');

    try {
      await updateSportsRecord(`/registrations/${registration.id}/status`, { status, reason });
      setNotice(
        `Inscrição de ${registration.fullName} enviada para a transição ${translateStatus(status)}.`
      );
      await load();
    } catch (requestError) {
      setError(
        getRequestErrorMessage(requestError, 'A transição da inscrição não pôde ser concluída.')
      );
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <>
      <SportsPageHeader
        description="Acompanhe estados, presença, resultado e alertas sem fundir cadastros automaticamente."
        eyebrow="Processo seletivo"
        title="Inscrições"
      />

      <section className={styles.panel} aria-labelledby="registration-filter-title">
        <div className={styles.panelHeader}>
          <h2 id="registration-filter-title">Consulta</h2>
          <button className={styles.secondaryButton} onClick={() => void load()} type="button">
            Atualizar
          </button>
        </div>
        <label className={styles.field}>
          Estado da inscrição
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

      <Feedback error={error} notice={notice} />

      <CollectionState
        emptyMessage={
          statusFilter
            ? 'Nenhuma inscrição corresponde ao filtro.'
            : 'Nenhuma inscrição fictícia foi registrada neste ambiente.'
        }
        isEmpty={filteredRegistrations.length === 0}
        loading={loading}
      >
        <div className={styles.recordGrid}>
          {filteredRegistrations.map((registration) => (
            <article className={styles.recordCard} key={registration.id}>
              <div className={styles.cardHeader}>
                <h2>{registration.fullName}</h2>
                <StatusBadge value={translateStatus(registration.status)} />
              </div>
              <dl className={styles.metaList}>
                <dt>Seletiva</dt>
                <dd>{registration.tryout.title}</dd>
                <dt>Nascimento</dt>
                <dd>{formatCivilDate(registration.birthDate)}</dd>
                <dt>Inscrição</dt>
                <dd>{formatInstant(registration.createdAt)}</dd>
                <dt>Presença</dt>
                <dd>{translateStatus(registration.attendanceStatus)}</dd>
                <dt>Resultado</dt>
                <dd>{translateStatus(registration.result)}</dd>
                <dt>Proteção de menor</dt>
                <dd>
                  {!registration.isMinor
                    ? 'Não aplicável'
                    : registration.guardianAuthorizationValid
                      ? 'Responsável e autorização válidos'
                      : 'Bloqueada: vínculo ou autorização pendente'}
                </dd>
              </dl>

              {registration.duplicateWarning ? (
                <p className={styles.notice} role="status">
                  Possível duplicidade. Revise os registros; a plataforma não realiza fusão
                  automática.
                </p>
              ) : null}

              {canManage && registration.status !== 'CONVERTED' ? (
                <div className={styles.cardActions}>
                  <div className={styles.inlineForm}>
                    <label>
                      Próxima transição
                      <select
                        aria-label={`Próxima transição de ${registration.fullName}`}
                        onChange={(event) =>
                          setPendingStatus((current) => ({
                            ...current,
                            [registration.id]: event.target.value
                          }))
                        }
                        value={pendingStatus[registration.id] ?? ''}
                      >
                        <option value="">Selecione</option>
                        {ALLOWED_STATUS_ACTIONS.map((status) => (
                          <option key={status} value={status}>
                            {translateStatus(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Motivo ou observação
                      <input
                        aria-label={`Motivo da transição de ${registration.fullName}`}
                        maxLength={500}
                        onChange={(event) =>
                          setPendingReason((current) => ({
                            ...current,
                            [registration.id]: event.target.value
                          }))
                        }
                        required
                        value={pendingReason[registration.id] ?? ''}
                      />
                    </label>
                    <button
                      className={styles.secondaryButton}
                      disabled={
                        updatingId === registration.id ||
                        !pendingStatus[registration.id] ||
                        !pendingReason[registration.id]?.trim()
                      }
                      onClick={() => void changeStatus(registration)}
                      type="button"
                    >
                      {updatingId === registration.id ? 'Salvando…' : 'Aplicar'}
                    </button>
                  </div>
                </div>
              ) : null}

              {canConvert &&
              registration.status === 'APPROVED' &&
              !registration.convertedAthleteId ? (
                <div className={styles.cardActions}>
                  <Link
                    className={styles.button}
                    href={`/admin/esportivo/conversao?registrationId=${encodeURIComponent(
                      registration.id
                    )}`}
                  >
                    Preparar conversão
                  </Link>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </CollectionState>
    </>
  );
}
