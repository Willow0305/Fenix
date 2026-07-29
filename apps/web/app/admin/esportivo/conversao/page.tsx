'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAdminSession } from '../../admin-shell';
import { Feedback, SportsPageHeader } from '../_components/sports-ui';
import {
  type AthleteRecord,
  type CategoryRecord,
  createSportsRecord,
  getRequestErrorMessage,
  listSportsRecords,
  type RegistrationRecord,
  type TeamRecord
} from '../_lib/sports-api';
import styles from '../esportivo.module.scss';

export default function ConversionPage() {
  const session = useAdminSession();
  const canConvert = session.permissions.includes('registrations.convert');
  const [registrations, setRegistrations] = useState<readonly RegistrationRecord[]>([]);
  const [teams, setTeams] = useState<readonly TeamRecord[]>([]);
  const [categories, setCategories] = useState<readonly CategoryRecord[]>([]);
  const [registrationId, setRegistrationId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [affiliationStartsOn, setAffiliationStartsOn] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [registrationResponse, teamResponse, categoryResponse] = await Promise.all([
        listSportsRecords<RegistrationRecord>('/registrations'),
        listSportsRecords<TeamRecord>('/teams'),
        listSportsRecords<CategoryRecord>('/categories')
      ]);
      const eligible = registrationResponse.data.filter(
        (registration) =>
          registration.status === 'APPROVED' && registration.convertedAthleteId === null
      );
      setRegistrations(eligible);
      setTeams(teamResponse.data.filter((team) => team.isActive));
      setCategories(categoryResponse.data.filter((category) => category.isActive));

      const requestedRegistrationId =
        typeof window === 'undefined'
          ? null
          : new URLSearchParams(window.location.search).get('registrationId');

      if (
        requestedRegistrationId &&
        eligible.some((registration) => registration.id === requestedRegistrationId)
      ) {
        setRegistrationId(requestedRegistrationId);
      }
    } catch (requestError) {
      setError(
        getRequestErrorMessage(requestError, 'Não foi possível preparar os dados da conversão.')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRegistration = registrations.find(
    (registration) => registration.id === registrationId
  );
  const selectedTeam = teams.find((team) => team.id === teamId);
  const availableCategories = useMemo(() => {
    if (!selectedTeam || selectedTeam.categories.length === 0) {
      return categories;
    }

    const linkedIds = new Set(selectedTeam.categories.map((category) => category.id));

    return categories.filter((category) => linkedIds.has(category.id));
  }, [categories, selectedTeam]);

  async function convert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRegistration) {
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      await createSportsRecord<AthleteRecord>(`/registrations/${selectedRegistration.id}/convert`, {
        teamId,
        categoryId,
        affiliationStartsOn: affiliationStartsOn || null,
        reason: reason.trim()
      });
      setNotice(
        `A inscrição de ${selectedRegistration.fullName} foi convertida de forma transacional e auditada.`
      );
      setRegistrationId('');
      setTeamId('');
      setCategoryId('');
      setAffiliationStartsOn('');
      setReason('');
      await load();
    } catch (requestError) {
      setError(
        getRequestErrorMessage(
          requestError,
          'A conversão não pôde ser concluída. Nenhum perfil parcial deve ter sido criado.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SportsPageHeader
        description="Uma inscrição aprovada gera um perfil esportivo separado, vínculo histórico e auditoria em uma única operação do servidor."
        eyebrow="Conversão controlada"
        title="Converter inscrição em atleta"
      />

      {!canConvert ? (
        <div className={styles.notice} role="status">
          Sua sessão pode consultar o módulo, mas não possui permissão para converter inscrições.
        </div>
      ) : (
        <section className={styles.panel} aria-labelledby="conversion-form-title">
          <div className={styles.panelHeader}>
            <h2 id="conversion-form-title">Dados da conversão</h2>
          </div>
          {loading ? (
            <p className={styles.empty} aria-busy="true">
              Carregando inscrições elegíveis…
            </p>
          ) : registrations.length === 0 ? (
            <p className={styles.empty}>
              Não há inscrição aprovada e ainda não convertida neste ambiente.
            </p>
          ) : (
            <form className={styles.formGrid} onSubmit={convert}>
              <label className={`${styles.field} ${styles.wideField}`}>
                Inscrição aprovada
                <select
                  onChange={(event) => {
                    setRegistrationId(event.target.value);
                  }}
                  required
                  value={registrationId}
                >
                  <option value="">Selecione</option>
                  {registrations.map((registration) => (
                    <option key={registration.id} value={registration.id}>
                      {registration.fullName} · {registration.tryout.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Equipe inicial
                <select
                  onChange={(event) => {
                    setTeamId(event.target.value);
                    setCategoryId('');
                  }}
                  required
                  value={teamId}
                >
                  <option value="">Selecione</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Categoria inicial
                <select
                  disabled={!teamId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  required
                  value={categoryId}
                >
                  <option value="">Selecione</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Início do vínculo
                <input
                  onChange={(event) => setAffiliationStartsOn(event.target.value)}
                  type="date"
                  value={affiliationStartsOn}
                />
                <small>Opcional; o servidor aplica a data operacional quando não informada.</small>
              </label>
              <label className={`${styles.field} ${styles.wideField}`}>
                Motivo da conversão
                <textarea
                  maxLength={500}
                  minLength={3}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  value={reason}
                />
              </label>
              {selectedRegistration?.isMinor ? (
                <div className={styles.notice} role="status">
                  {selectedRegistration.guardianAuthorizationValid
                    ? 'A inscrição informa responsável e autorização válidos. O servidor fará a validação definitiva.'
                    : 'Conversão bloqueada: a inscrição não possui autorização válida de responsável.'}
                </div>
              ) : null}
              <button
                className={styles.button}
                disabled={
                  submitting ||
                  !selectedRegistration ||
                  !teamId ||
                  !categoryId ||
                  !reason.trim() ||
                  (selectedRegistration.isMinor && !selectedRegistration.guardianAuthorizationValid)
                }
                type="submit"
              >
                {submitting ? 'Convertendo…' : 'Confirmar conversão auditada'}
              </button>
            </form>
          )}
          <p className={styles.privacyNote}>
            A tela não cria conta de acesso, não funde duplicidades e não recebe dados de saúde.
          </p>
        </section>
      )}

      <Feedback error={error} notice={notice} />
    </>
  );
}
