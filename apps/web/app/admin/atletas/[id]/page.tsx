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
import { api } from '../../../../lib/api-client';
import type { AuditLog, Page } from '../../../../lib/api-types';
import { useAuth } from '../../../../lib/auth-context';
import { formatDate, formatDateTime, todayCivil } from '../../../../lib/format';
import {
  ATHLETE_NEXT,
  ATHLETE_STATUS,
  type AthleteDetail,
  type AthleteStatus,
  type Membership,
  type Team
} from '../../../../lib/sports-types';
import { useResource } from '../../../../lib/use-resource';

export default function AthleteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const athlete = useResource<AthleteDetail>(`/athletes/${id}`);
  const teams = useResource<Team[]>('/teams', { includeInactive: false });
  const history = useResource<Page<AuditLog>>(can('audit.read') ? '/audit-logs' : null, {
    entityType: 'Athlete',
    entityId: id,
    pageSize: 50
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<AthleteStatus | null>(null);
  const [ending, setEnding] = useState<Membership | null>(null);
  const [endsOn, setEndsOn] = useState(todayCivil());
  const [unlinking, setUnlinking] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [membership, setMembership] = useState({
    teamId: '',
    startsOn: todayCivil(),
    position: ''
  });

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
        actions={<Link href="/admin/atletas">Voltar</Link>}
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
          <div className="row">
            <span>
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
            <table className="table">
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
                    <td>{m.team.name}</td>
                    <td>{formatDate(m.startsOn)}</td>
                    <td>
                      {m.endsOn ? (
                        formatDate(m.endsOn)
                      ) : (
                        <span className="badge badge-success">Atual</span>
                      )}
                    </td>
                    <td>{m.position ?? '—'}</td>
                    <td>
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
                  ...(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))
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
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={!membership.teamId || addMembership.pending}
              >
                Adicionar vínculo
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {can('fees.read') ? <AthleteFeePlans athleteId={id} /> : null}

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
        confirmLabel="Confirmar"
        requireReason
        onClose={() => setNextStatus(null)}
        onConfirm={async (reason) => {
          athlete.setData(
            await api<AthleteDetail>(`/athletes/${id}/status`, {
              method: 'PUT',
              body: { status: nextStatus, reason }
            })
          );
          setNotice('Status atualizado.');
          await history.reload();
        }}
      />
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
