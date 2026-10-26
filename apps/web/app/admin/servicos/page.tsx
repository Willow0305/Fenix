'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  Empty,
  ErrorSummary,
  Loading,
  PageHeader,
  PhoneField,
  SelectField,
  TextArea,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api-client';
import type { Page } from '../../../lib/api-types';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { normalizeAmount } from '../../../lib/idempotency';
import {
  type Availability,
  type Partner,
  type PartnerService,
  type Professional,
  SERVICE_STATUS
} from '../../../lib/partner-types';
import { useResource } from '../../../lib/use-resource';

const SLOT_STATUS: Record<Availability['status'], string> = {
  AVAILABLE: 'Livre',
  RESERVED: 'Reservado',
  BLOCKED: 'Bloqueado'
};

function AvailabilityPanel({ professional }: { readonly professional: Professional }) {
  const slots = useResource<Availability[]>(`/professionals/${professional.id}/availability`, {
    from: new Date(Date.now() - 86_400_000).toISOString()
  });
  const [form, setForm] = useState({ date: '', start: '08:00', end: '09:00', notes: '' });
  const [blocking, setBlocking] = useState<string | null>(null);
  const add = useSubmit(async () => {
    // Horário digitado no fuso do navegador; a API recebe instantes UTC (DT-008).
    await api<Availability>(`/professionals/${professional.id}/availability`, {
      method: 'POST',
      body: {
        startsAt: new Date(`${form.date}T${form.start}`).toISOString(),
        endsAt: new Date(`${form.date}T${form.end}`).toISOString(),
        ...(form.notes ? { notes: form.notes } : {})
      }
    });
    await slots.reload();
  });

  return (
    <div className="stack">
      <form className="form" onSubmit={(event) => void add.submit(event)}>
        <ErrorSummary error={add.error} />
        <div className="form-grid">
          <TextField
            label="Data"
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <TextField
            label="Início"
            type="time"
            required
            value={form.start}
            onChange={(e) => setForm({ ...form, start: e.target.value })}
          />
          <TextField
            label="Fim"
            type="time"
            required
            value={form.end}
            onChange={(e) => setForm({ ...form, end: e.target.value })}
          />
          <TextField
            label="Observação interna"
            maxLength={500}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-secondary btn-sm" disabled={add.pending}>
            Adicionar horário
          </button>
        </div>
      </form>
      {slots.error ? <Alert kind="error">{slots.error}</Alert> : null}
      {slots.data?.length === 0 ? <p className="muted">Nenhum horário cadastrado.</p> : null}
      {slots.data && slots.data.length > 0 ? (
        <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
          {slots.data.map((slot) => (
            <li key={slot.id} className="row">
              <span>
                {formatDateTime(slot.startsAt)} – {formatDateTime(slot.endsAt).slice(-5)}
              </span>
              <span className={`badge ${slot.status === 'AVAILABLE' ? 'badge-success' : ''}`}>
                {SLOT_STATUS[slot.status]}
              </span>
              {slot.notes ? <span className="muted">{slot.notes}</span> : null}
              <span className="spacer" />
              {slot.status === 'AVAILABLE' ? (
                <button type="button" className="btn btn-link" onClick={() => setBlocking(slot.id)}>
                  Bloquear
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog
        open={blocking !== null}
        title="Bloquear horário"
        description="O horário deixa de ser oferecido; o histórico da agenda permanece."
        confirmLabel="Bloquear"
        requireReason
        onClose={() => setBlocking(null)}
        onConfirm={async (reason) => {
          await api(`/availability/${blocking ?? ''}/block`, {
            method: 'POST',
            body: { reason }
          });
          await slots.reload();
        }}
      />
    </div>
  );
}

function ServicesAdmin() {
  const params = useSearchParams();
  const [partnerId, setPartnerId] = useState(params.get('parceiro') ?? '');
  const partners = useResource<Page<Partner>>('/partners', { status: 'ACTIVE', pageSize: 100 });
  const professionals = useResource<Professional[]>('/professionals', { partnerId });
  const services = useResource<PartnerService[]>('/partner-services', { partnerId });
  const [agenda, setAgenda] = useState<string | null>(null);
  const [pro, setPro] = useState({
    fullName: '',
    profession: '',
    licenseNumber: '',
    email: '',
    phone: '',
    publicBio: '',
    publicContact: 'false'
  });
  const [svc, setSvc] = useState({
    name: '',
    description: '',
    durationMinutes: '60',
    price: '',
    professionalId: ''
  });

  const createPro = useSubmit(async () => {
    await api<Professional>(`/partners/${partnerId}/professionals`, {
      method: 'POST',
      body: {
        fullName: pro.fullName,
        profession: pro.profession,
        publicContact: pro.publicContact === 'true',
        ...(pro.licenseNumber ? { licenseNumber: pro.licenseNumber } : {}),
        ...(pro.email ? { email: pro.email } : {}),
        ...(pro.phone ? { phone: pro.phone } : {}),
        ...(pro.publicBio ? { publicBio: pro.publicBio } : {})
      }
    });
    setPro({ ...pro, fullName: '', licenseNumber: '', email: '', phone: '', publicBio: '' });
    await professionals.reload();
  });
  const createSvc = useSubmit(async () => {
    await api<PartnerService>(`/partners/${partnerId}/services`, {
      method: 'POST',
      body: {
        name: svc.name,
        durationMinutes: Number(svc.durationMinutes),
        ...(svc.description ? { description: svc.description } : {}),
        ...(svc.price ? { price: normalizeAmount(svc.price) } : {}),
        ...(svc.professionalId ? { professionalId: svc.professionalId } : {})
      }
    });
    setSvc({ ...svc, name: '', description: '', price: '' });
    await services.reload();
  });
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, reload: () => Promise<void>) {
    setActionError(null);

    try {
      await action();
      await reload();
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  }

  const setServiceStatus = (service: PartnerService, status: 'ACTIVE' | 'INACTIVE') =>
    run(
      () => api(`/partner-services/${service.id}/status`, { method: 'PUT', body: { status } }),
      services.reload
    );
  const toggleProfessional = (p: Professional) =>
    run(
      () =>
        api(`/professionals/${p.id}`, {
          method: 'PATCH',
          body: { status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
        }),
      professionals.reload
    );

  return (
    <>
      <PageHeader
        title="Profissionais e serviços"
        description="Somente parceiros aprovados recebem profissionais e serviços. Não registre dados de saúde de atletas."
      />
      {actionError ? <Alert kind="error">{actionError}</Alert> : null}
      <div className="card">
        <SelectField
          label="Parceiro"
          value={partnerId}
          onChange={(e) => setPartnerId(e.target.value)}
          options={[
            { value: '', label: 'Todos os parceiros ativos' },
            ...(partners.data?.data ?? []).map((p) => ({ value: p.id, label: p.displayName }))
          ]}
        />
      </div>

      <section className="card stack" aria-labelledby="profissionais">
        <h2 id="profissionais">Profissionais</h2>
        {professionals.error ? <Alert kind="error">{professionals.error}</Alert> : null}
        {professionals.loading && !professionals.data ? <Loading /> : null}
        {professionals.data?.length === 0 ? <Empty>Nenhum profissional.</Empty> : null}
        {professionals.data?.map((p) => (
          <div
            key={p.id}
            className="stack"
            style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.6rem' }}
          >
            <div className="row">
              <strong>{p.fullName}</strong>
              <span>{p.profession}</span>
              <span className="muted">{p.partner.name}</span>
              {p.hasLicense ? <span className="badge">registro informado</span> : null}
              {p.publicContact ? <span className="badge badge-info">contato público</span> : null}
              {p.status === 'INACTIVE' ? <span className="badge">inativo</span> : null}
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-link"
                onClick={() => setAgenda(agenda === p.id ? null : p.id)}
                aria-expanded={agenda === p.id}
              >
                Agenda
              </button>
              <button
                type="button"
                className="btn btn-link"
                onClick={() => void toggleProfessional(p)}
              >
                {p.status === 'ACTIVE' ? 'Inativar' : 'Reativar'}
              </button>
            </div>
            {agenda === p.id ? <AvailabilityPanel professional={p} /> : null}
          </div>
        ))}
        {partnerId ? (
          <form className="form" onSubmit={(event) => void createPro.submit(event)}>
            <h3>Novo profissional</h3>
            <ErrorSummary error={createPro.error} />
            <div className="form-grid">
              <TextField
                label="Nome completo"
                maxLength={160}
                required
                value={pro.fullName}
                onChange={(e) => setPro({ ...pro, fullName: e.target.value })}
              />
              <TextField
                label="Profissão"
                maxLength={120}
                required
                value={pro.profession}
                onChange={(e) => setPro({ ...pro, profession: e.target.value })}
              />
              <TextField
                label="Registro profissional"
                maxLength={40}
                value={pro.licenseNumber}
                onChange={(e) => setPro({ ...pro, licenseNumber: e.target.value })}
                hint="Armazenado cifrado."
              />
              <TextField
                label="E-mail"
                maxLength={180}
                type="email"
                value={pro.email}
                onChange={(e) => setPro({ ...pro, email: e.target.value })}
                hint="Recebe aviso de confirmação e cancelamento."
              />
              <PhoneField
                label="Telefone"
                allowLandline
                value={pro.phone}
                onValueChange={(value) => setPro({ ...pro, phone: value })}
              />
              <SelectField
                label="Exibir contato no site"
                value={pro.publicContact}
                onChange={(e) => setPro({ ...pro, publicContact: e.target.value })}
                options={[
                  { value: 'false', label: 'Não' },
                  { value: 'true', label: 'Sim, autorizado pelo profissional' }
                ]}
              />
            </div>
            <TextArea
              label="Apresentação pública"
              maxLength={2000}
              value={pro.publicBio}
              onChange={(e) => setPro({ ...pro, publicBio: e.target.value })}
            />
            <div className="form-actions">
              <button type="submit" className="btn btn-secondary" disabled={createPro.pending}>
                Cadastrar profissional
              </button>
            </div>
          </form>
        ) : (
          <p className="muted">Selecione um parceiro para cadastrar profissionais e serviços.</p>
        )}
      </section>

      <section className="card stack" aria-labelledby="servicos">
        <h2 id="servicos">Serviços</h2>
        {services.error ? <Alert kind="error">{services.error}</Alert> : null}
        {services.data?.length === 0 ? <Empty>Nenhum serviço.</Empty> : null}
        {services.data && services.data.length > 0 ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Serviço</th>
                  <th scope="col">Parceiro</th>
                  <th scope="col">Profissional</th>
                  <th scope="col" className="num">
                    Duração
                  </th>
                  <th scope="col" className="num">
                    Valor
                  </th>
                  <th scope="col">Situação</th>
                  <th scope="col">
                    <span className="visually-hidden">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {services.data.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Serviço">{s.name}</td>
                    <td data-label="Parceiro">{s.partner.name}</td>
                    <td data-label="Profissional">{s.professional?.fullName ?? 'Qualquer'}</td>
                    <td data-label="Duração" className="num">
                      {s.durationMinutes} min
                    </td>
                    <td data-label="Valor" className="num">
                      {s.price ? formatMoney(s.price.amount) : 'A combinar'}
                    </td>
                    <td data-label="Situação">
                      <span className={`badge ${SERVICE_STATUS[s.status].badge}`}>
                        {SERVICE_STATUS[s.status].label}
                      </span>
                    </td>
                    <td data-label="Ações">
                      <button
                        type="button"
                        className="btn btn-link"
                        onClick={() =>
                          void setServiceStatus(s, s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
                        }
                      >
                        {s.status === 'ACTIVE' ? 'Desativar' : 'Publicar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {partnerId ? (
          <form className="form" onSubmit={(event) => void createSvc.submit(event)}>
            <h3>Novo serviço</h3>
            <ErrorSummary error={createSvc.error} />
            <div className="form-grid">
              <TextField
                label="Nome"
                maxLength={160}
                required
                value={svc.name}
                onChange={(e) => setSvc({ ...svc, name: e.target.value })}
              />
              <TextField
                label="Duração (minutos)"
                type="number"
                min={5}
                max={480}
                required
                value={svc.durationMinutes}
                onChange={(e) => setSvc({ ...svc, durationMinutes: e.target.value })}
              />
              <TextField
                label="Valor (R$)"
                maxLength={16}
                numeric="decimal"
                value={svc.price}
                onChange={(e) => setSvc({ ...svc, price: e.target.value })}
                hint="Vazio = a combinar."
              />
              <SelectField
                label="Profissional"
                value={svc.professionalId}
                onChange={(e) => setSvc({ ...svc, professionalId: e.target.value })}
                options={[
                  { value: '', label: 'Qualquer profissional do parceiro' },
                  ...(professionals.data ?? [])
                    .filter((p) => p.status === 'ACTIVE')
                    .map((p) => ({ value: p.id, label: p.fullName }))
                ]}
              />
            </div>
            <TextArea
              label="Descrição pública"
              maxLength={4000}
              value={svc.description}
              onChange={(e) => setSvc({ ...svc, description: e.target.value })}
            />
            <div className="form-actions">
              <button type="submit" className="btn btn-secondary" disabled={createSvc.pending}>
                Cadastrar serviço (rascunho)
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </>
  );
}

export default function ServicesAdminPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ServicesAdmin />
    </Suspense>
  );
}
