'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { AthleteFeePlans } from '../../../../components/athlete-fee-plans';
import { AthleteForm } from '../../../../components/athlete-form';
import {
  Alert,
  ConfirmDialog,
  ErrorSummary,
  Loading,
  PageHeader,
  SelectField,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { Avatar } from '../../../../components/avatar';
import { Icon } from '../../../../components/icon';
import { api } from '../../../../lib/api-client';
import { ageFrom } from '../../../../lib/age';
import type { AuditLog, Page } from '../../../../lib/api-types';
import { useAuth } from '../../../../lib/auth-context';
import { formatDate, formatDateTime, todayCivil } from '../../../../lib/format';
import {
  ATHLETE_NEXT,
  ATHLETE_STATUS,
  type AthleteDetail,
  type AthleteStatus,
  type Category,
  type Membership,
  type StatusImpact,
  type Team
} from '../../../../lib/sports-types';
import { teamOptions } from '../../../../lib/team-options';
import { useResource } from '../../../../lib/use-resource';

export default function AthleteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const athlete = useResource<AthleteDetail>(`/athletes/${id}`);
  const teams = useResource<Team[]>('/teams');
  const categories = useResource<Category[]>('/sport-categories');
  const history = useResource<Page<AuditLog>>(can('audit.read') ? '/audit-logs' : null, {
    entityType: 'Athlete',
    entityId: id,
    pageSize: 50
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<AthleteStatus | null>(null);
  const leaving = nextStatus === 'INACTIVE' || nextStatus === 'SUSPENDED';
  const impact = useResource<StatusImpact>(leaving ? `/athletes/${id}/status-impact` : null);
  const [effects, setEffects] = useState({
    cancelFutureFees: false,
    endPlan: false,
    endMemberships: false
  });
  const [feesKey, setFeesKey] = useState(0);
  const [outOfRangeOk, setOutOfRangeOk] = useState(false);
  const [ending, setEnding] = useState<Membership | null>(null);
  const [endsOn, setEndsOn] = useState(todayCivil());
  const [unlinking, setUnlinking] = useState(false);
  const [consenting, setConsenting] = useState<boolean | null>(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [membership, setMembership] = useState({
    teamId: '',
    startsOn: todayCivil(),
    position: ''
  });

  const chosenTeam = teams.data?.find((t) => t.id === membership.teamId);
  const chosenCategory = categories.data?.find((c) => c.id === chosenTeam?.category?.id);
  const athleteAge = athlete.data?.birthDate ? ageFrom(athlete.data.birthDate) : null;
  const ageWarning =
    chosenCategory &&
    athleteAge !== null &&
    ((chosenCategory.minimumAge !== null && athleteAge < chosenCategory.minimumAge) ||
      (chosenCategory.maximumAge !== null && athleteAge > chosenCategory.maximumAge))
      ? `Atleta com ${athleteAge} anos, fora da faixa da categoria ${chosenCategory.name} (${chosenCategory.minimumAge ?? '…'}–${chosenCategory.maximumAge ?? '…'} anos).`
      : null;

  const link = useSubmit(async () => {
    athlete.setData(
      await api<AthleteDetail>(`/athletes/${id}/user`, {
        method: 'PUT',
        body: { email: linkEmail }
      })
    );
    setLinkEmail('');
    setNotice('Conta vinculada. A pessoa agora acessa a área do atleta.');
  });
  const addMembership = useSubmit(async () => {
    athlete.setData(
      await api<AthleteDetail>(`/athletes/${id}/memberships`, {
        method: 'POST',
        body: {
          teamId: membership.teamId,
          startsOn: membership.startsOn,
          ...(membership.position ? { position: membership.position } : {})
        }
      })
    );
    setNotice('Vínculo adicionado.');
  });

  if (!athlete.data) {
    return athlete.error ? <Alert kind="error">{athlete.error}</Alert> : <Loading />;
  }

  const a = athlete.data;

  return (
    <>
      <PageHeader
        title={a.fullName}
        description={`Cadastrado em ${formatDateTime(a.createdAt)} · atualizado em ${formatDateTime(a.updatedAt)}`}
        actions={
          <Link href="/admin/atletas">
            <Icon name="arrow-left" /> Voltar
          </Link>
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {a.documentNeedsReview ? (
        <Alert kind="warning">
          O documento cadastrado não é um CPF válido (cadastro anterior ao padrão). Informe o CPF em
          Dados cadastrais.
        </Alert>
      ) : null}

      <section className="card row" aria-label="Status">
        <span>Status:</span>
        <span className={`badge ${ATHLETE_STATUS[a.status].badge}`}>
          {ATHLETE_STATUS[a.status].label}
        </span>
        <span className="spacer" />
        {can('athletes.status.change')
          ? ATHLETE_NEXT[a.status].map((status) => (
              <button
                key={status}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setNextStatus(status)}
              >
                {ATHLETE_STATUS[status].label}
              </button>
            ))
          : null}
      </section>

      {can('athletes.update') ? (
        <section className="card stack" aria-labelledby="dados">
          <h2 id="dados">Dados cadastrais</h2>
          <AthleteForm
            key={a.updatedAt}
            mode="edit"
            source={a}
            submitLabel="Salvar alterações"
            onSubmit={async (payload) => {
              athlete.setData(
                await api<AthleteDetail>(`/athletes/${id}`, { method: 'PATCH', body: payload })
              );
              setNotice('Dados atualizados e registrados no histórico.');
            }}
          />
        </section>
      ) : null}

      <section className="card stack" aria-labelledby="conta">
        <h2 id="conta">Conta de acesso</h2>
        {a.user ? (
          <>
            <div className="row">
              <Avatar src={a.user.avatarUrl} name={a.user.name} size={56} authenticated />
              <span style={{ flex: '1 1 14rem' }}>
                Vinculado a <strong>{a.user.name}</strong> ({a.user.email})
              </span>
              {can('athletes.update') ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setUnlinking(true)}
                >
                  Desvincular
                </button>
              ) : null}
            </div>
            <div className="stack" style={{ gap: '0.4rem' }}>
              <span>
                <Icon name={a.publicProfile.visibleOnSite ? 'eye' : 'eye-slash'} />{' '}
                {a.publicProfile.visibleOnSite
                  ? 'Aparece no elenco do site (foto, nome e posição).'
                  : !a.user.profilePublic
                    ? 'Perfil privado: não aparece no site. Só a própria pessoa pode torná-lo público.'
                    : a.publicProfile.needsGuardianConsent && !a.publicProfile.guardianConsentAt
                      ? 'Escolheu perfil público, mas é menor de 18 (ou sem data de nascimento): falta a autorização do responsável.'
                      : 'Perfil público; aparece no elenco quando estiver Ativo em uma equipe ativa.'}
              </span>
              {a.publicProfile.needsGuardianConsent && can('athletes.update') ? (
                <div className="row">
                  <span className="muted">
                    {a.publicProfile.guardianConsentAt
                      ? `Responsável autorizou em ${formatDateTime(a.publicProfile.guardianConsentAt)}.`
                      : 'Sem autorização do responsável registrada.'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setConsenting(!a.publicProfile.guardianConsentAt)}
                  >
                    {a.publicProfile.guardianConsentAt
                      ? 'Retirar autorização'
                      : 'Registrar autorização do responsável'}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : can('athletes.update') ? (
          <form className="row" onSubmit={(event) => void link.submit(event)}>
            <TextField
              label="E-mail da conta do atleta"
              maxLength={180}
              type="email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              hint="A pessoa precisa ter criado a conta no site."
            />
            <button type="submit" className="btn btn-primary" disabled={link.pending || !linkEmail}>
              Vincular conta
            </button>
            <ErrorSummary error={link.error} />
          </form>
        ) : (
          <p className="muted">Sem conta vinculada.</p>
        )}
      </section>

      <section className="card stack" aria-labelledby="equipes">
        <h2 id="equipes">Equipes</h2>
        {a.memberships.length === 0 ? <p className="muted">Nenhum vínculo.</p> : null}
        {a.memberships.length > 0 ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Equipe</th>
                  <th scope="col">Início</th>
                  <th scope="col">Término</th>
                  <th scope="col">Posição</th>
                  <th scope="col">Ação</th>
                </tr>
              </thead>
              <tbody>
                {a.memberships.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Equipe">{m.team.name}</td>
                    <td data-label="Início">{formatDate(m.startsOn)}</td>
                    <td data-label="Término">
                      {m.endsOn ? (
                        formatDate(m.endsOn)
                      ) : (
                        <span className="badge badge-success">Atual</span>
                      )}
                    </td>
                    <td data-label="Posição">{m.position ?? '—'}</td>
                    <td data-label="Ação">
                      {!m.endsOn && can('teams.assign') ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEnding(m)}
                        >
                          Encerrar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {can('teams.assign') ? (
          <form className="form" onSubmit={(event) => void addMembership.submit(event)}>
            <ErrorSummary error={addMembership.error} />
            <div className="form-grid">
              <SelectField
                label="Equipe"
                required
                value={membership.teamId}
                onChange={(e) => setMembership({ ...membership, teamId: e.target.value })}
                options={[
                  { value: '', label: 'Selecione' },
                  ...teamOptions(teams.data ?? [], 'pick')
                ]}
              />
              <TextField
                label="Início"
                type="date"
                required
                value={membership.startsOn}
                onChange={(e) => setMembership({ ...membership, startsOn: e.target.value })}
              />
              <TextField
                label="Posição na equipe"
                maxLength={80}
                value={membership.position}
                onChange={(e) => setMembership({ ...membership, position: e.target.value })}
              />
            </div>
            {ageWarning ? (
              <div className="alert alert-warning stack" style={{ gap: '0.5rem' }}>
                <span>
                  <Icon name="exclamation-triangle" /> {ageWarning}
                </span>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={outOfRangeOk}
                    onChange={(e) => setOutOfRangeOk(e.target.checked)}
                  />
                  <span>Vincular mesmo assim</span>
                </label>
              </div>
            ) : null}
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={
                  !membership.teamId ||
                  addMembership.pending ||
                  (ageWarning !== null && !outOfRangeOk)
                }
              >
                <Icon name="people" /> Adicionar vínculo
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {can('fees.read') ? <AthleteFeePlans key={feesKey} athleteId={id} /> : null}

      {history.data ? (
        <section className="card stack" aria-labelledby="historico">
          <h2 id="historico">Histórico de alterações</h2>
          <ul>
            {history.data.data.map((log) => (
              <li key={log.id}>
                {formatDateTime(log.occurredAt)} — <code>{log.action}</code> por{' '}
                {log.actor?.name ?? 'sistema'}
                {log.reason ? ` · motivo: ${log.reason}` : ''}
                {log.after ? <small className="muted"> {JSON.stringify(log.after)}</small> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={nextStatus !== null}
        title={`Mudar status para "${nextStatus ? ATHLETE_STATUS[nextStatus].label : ''}"`}
        description={
          leaving
            ? 'Novas mensalidades deixam de ser geradas. Escolha abaixo o que fazer com o que já existe.'
            : undefined
        }
        confirmLabel="Confirmar"
        requireReason
        onClose={() => {
          setNextStatus(null);
          setEffects({ cancelFutureFees: false, endPlan: false, endMemberships: false });
        }}
        onConfirm={async (reason) => {
          athlete.setData(
            await api<AthleteDetail>(`/athletes/${id}/status`, {
              method: 'PUT',
              body: {
                status: nextStatus,
                reason,
                ...(leaving
                  ? {
                      cancelFutureFees: effects.cancelFutureFees,
                      endPlan: effects.endPlan,
                      ...(nextStatus === 'INACTIVE'
                        ? { endMemberships: effects.endMemberships }
                        : {})
                    }
                  : {})
              }
            })
          );
          setNotice('Status atualizado.');
          setFeesKey((value) => value + 1);
          await history.reload();
        }}
      >
        {leaving && impact.data ? (
          <fieldset className="form-section">
            <legend>Pendências</legend>
            <label className="checkbox">
              <input
                type="checkbox"
                disabled={impact.data.cancellableFees === 0}
                checked={effects.cancelFutureFees}
                onChange={(e) => setEffects({ ...effects, cancelFutureFees: e.target.checked })}
              />
              <span>
                Cancelar {impact.data.cancellableFees} mensalidade(s) deste mês em diante sem
                pagamento
              </span>
            </label>
            {impact.data.keptOpenFees > 0 ? (
              <small className="muted">
                {impact.data.keptOpenFees} mensalidade(s) de meses passados ou com pagamento
                continuam em aberto.
              </small>
            ) : null}
            <label className="checkbox">
              <input
                type="checkbox"
                disabled={impact.data.activePlan === null}
                checked={effects.endPlan}
                onChange={(e) => setEffects({ ...effects, endPlan: e.target.checked })}
              />
              <span>
                {impact.data.activePlan
                  ? `Encerrar o plano ${impact.data.activePlan.name}`
                  : 'Sem plano vigente'}
              </span>
            </label>
            {nextStatus === 'INACTIVE' ? (
              <label className="checkbox">
                <input
                  type="checkbox"
                  disabled={impact.data.openMemberships.length === 0}
                  checked={effects.endMemberships}
                  onChange={(e) => setEffects({ ...effects, endMemberships: e.target.checked })}
                />
                <span>
                  {impact.data.openMemberships.length > 0
                    ? `Encerrar vínculo com ${impact.data.openMemberships.map((m) => m.team).join(', ')}`
                    : 'Sem vínculo com equipe'}
                </span>
              </label>
            ) : (
              <small className="muted">Na suspensão o atleta continua nas equipes.</small>
            )}
          </fieldset>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={ending !== null}
        title={`Encerrar vínculo com ${ending?.team.name ?? ''}`}
        description="O vínculo continua no histórico."
        confirmLabel="Encerrar vínculo"
        requireReason
        onClose={() => setEnding(null)}
        onConfirm={async (reason) => {
          athlete.setData(
            await api<AthleteDetail>(`/athletes/${id}/memberships/${ending?.id ?? ''}/end`, {
              method: 'POST',
              body: { endsOn, reason }
            })
          );
          setNotice('Vínculo encerrado.');
        }}
      >
        <TextField
          label="Data de término"
          type="date"
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={consenting !== null}
        title={
          consenting ? 'Registrar autorização do responsável' : 'Retirar autorização do responsável'
        }
        description={
          consenting
            ? 'Confirme que o responsável legal autorizou mostrar foto, nome abreviado e posição no site (LGPD, art. 14). Guarde o documento da autorização.'
            : 'O atleta sai do elenco público no próximo carregamento do site.'
        }
        confirmLabel={consenting ? 'Registrar' : 'Retirar'}
        requireReason
        onClose={() => setConsenting(null)}
        onConfirm={async (reason) => {
          athlete.setData(
            await api<AthleteDetail>(`/athletes/${id}/public-profile-consent`, {
              method: 'PUT',
              body: { granted: consenting === true, reason }
            })
          );
          setNotice(consenting ? 'Autorização registrada.' : 'Autorização retirada.');
          await history.reload();
        }}
      />
      <ConfirmDialog
        open={unlinking}
        title="Desvincular conta"
        description="A pessoa perde o acesso à área do atleta, mas a conta continua existindo."
        confirmLabel="Desvincular"
        danger
        requireReason
        onClose={() => setUnlinking(false)}
        onConfirm={async (reason) => {
          athlete.setData(
            await api<AthleteDetail>(`/athletes/${id}/user/unlink`, {
              method: 'POST',
              body: { reason }
            })
          );
          setNotice('Conta desvinculada.');
        }}
      />
    </>
  );
}
