'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useAdminSession } from '../../admin-shell';
import { CollectionState, Feedback, SportsPageHeader, StatusBadge } from '../_components/sports-ui';
import {
  createSportsRecord,
  formatCivilDate,
  getRequestErrorMessage,
  type GuardianRecord,
  listSportsRecords
} from '../_lib/sports-api';
import styles from '../esportivo.module.scss';

export default function GuardiansPage() {
  const session = useAdminSession();
  const canManage = session.permissions.includes('guardians.manage');
  const [guardians, setGuardians] = useState<readonly GuardianRecord[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await listSportsRecords<GuardianRecord>('/guardians');
      setGuardians(response.data);
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Não foi possível carregar os responsáveis.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createGuardian(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      await createSportsRecord<GuardianRecord>('/guardians', {
        fullName: fullName.trim(),
        email: email.trim() || null,
        isFictitious: true
      });
      setFullName('');
      setEmail('');
      setNotice('Responsável cadastrado. O vínculo com atleta continua sendo uma ação separada.');
      await load();
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Não foi possível criar o responsável.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SportsPageHeader
        description="Cadastre somente o mínimo necessário. Vínculo e autorização são registros separados, protegidos e auditáveis."
        eyebrow="Proteção de menores"
        title="Responsáveis"
      />

      {canManage ? (
        <section className={styles.panel} aria-labelledby="create-guardian-title">
          <div className={styles.panelHeader}>
            <h2 id="create-guardian-title">Novo responsável fictício</h2>
          </div>
          <form className={styles.formGrid} onSubmit={createGuardian}>
            <label className={styles.field}>
              Nome completo
              <input
                maxLength={160}
                minLength={2}
                onChange={(event) => setFullName(event.target.value)}
                required
                value={fullName}
              />
            </label>
            <label className={styles.field}>
              E-mail, se necessário
              <input
                autoComplete="off"
                maxLength={180}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <button className={styles.button} disabled={submitting} type="submit">
              {submitting ? 'Criando…' : 'Criar responsável'}
            </button>
          </form>
          <p className={styles.privacyNote}>
            Esta tela não recebe documento de identidade. Metadados de eventual autorização
            protegida são tratados por fluxo próprio no servidor.
          </p>
        </section>
      ) : null}

      <Feedback error={error} notice={notice} />

      <section className={styles.panel} aria-labelledby="guardian-list-title">
        <div className={styles.panelHeader}>
          <h2 id="guardian-list-title">Responsáveis cadastrados</h2>
          <button className={styles.secondaryButton} onClick={() => void load()} type="button">
            Atualizar
          </button>
        </div>
        <CollectionState
          emptyMessage="Nenhum responsável fictício foi cadastrado neste ambiente."
          isEmpty={guardians.length === 0}
          loading={loading}
        >
          <div className={styles.recordGrid}>
            {guardians.map((guardian) => (
              <article className={styles.recordCard} key={guardian.id}>
                <div className={styles.cardHeader}>
                  <h3>{guardian.fullName}</h3>
                  <StatusBadge value={`${guardian.athletes.length} vínculo(s)`} />
                </div>
                <dl className={styles.metaList}>
                  <dt>E-mail</dt>
                  <dd>{guardian.email ?? 'Não informado'}</dd>
                  <dt>Atletas</dt>
                  <dd>
                    {guardian.athletes.length === 0
                      ? 'Nenhum vínculo'
                      : guardian.athletes
                          .map(({ athleteName, authorizationValidUntil }) =>
                            authorizationValidUntil
                              ? `${athleteName} (até ${formatCivilDate(authorizationValidUntil)})`
                              : `${athleteName} (autorização pendente)`
                          )
                          .join(', ')}
                  </dd>
                </dl>
              </article>
            ))}
          </div>
        </CollectionState>
      </section>
    </>
  );
}
