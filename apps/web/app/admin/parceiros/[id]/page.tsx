'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  Alert,
  ConfirmDialog,
  ErrorSummary,
  Loading,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
  useSubmit
} from '../../../../components/ui';
import { api, errorMessage } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import { openProtectedFile } from '../../../../lib/download';
import { formatDate } from '../../../../lib/format';
import { normalizeAmount } from '../../../../lib/idempotency';
import {
  COMMISSION_TYPE,
  type CommissionType,
  type Partner,
  PARTNER_NEXT,
  PARTNER_STATUS,
  PARTNER_TYPE,
  type PartnerStatus
} from '../../../../lib/partner-types';
import { useResource } from '../../../../lib/use-resource';

type Form = Record<string, string>;

function toForm(p: Partner): Form {
  return {
    legalName: p.legalName,
    displayName: p.displayName,
    type: p.type,
    documentNumber: '',
    contactName: p.contactName ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    description: p.description ?? '',
    websiteUrl: p.websiteUrl ?? '',
    contractStartsOn: p.contractStartsOn ?? '',
    contractEndsOn: p.contractEndsOn ?? '',
    commissionType: p.commissionType,
    commissionPercentage: p.commissionPercentage ?? '',
    commissionFixedAmount: p.commissionFixedAmount?.amount ?? '',
    contractNotes: p.contractNotes ?? ''
  };
}

function DocumentsPanel({
  partner,
  onChanged
}: {
  readonly partner: Partner;
  readonly onChanged: (p: Partner) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ documentType: 'Contrato', issuedOn: '', expiresOn: '' });
  const [removing, setRemoving] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const upload = useSubmit(async () => {
    const body = new FormData();

    if (file) {
      body.append('file', file);
    }

    body.append('documentType', meta.documentType);

    if (meta.issuedOn) {
      body.append('issuedOn', meta.issuedOn);
    }

    if (meta.expiresOn) {
      body.append('expiresOn', meta.expiresOn);
    }

    onChanged(await api<Partner>(`/partners/${partner.id}/documents`, { method: 'POST', body }));
    setFile(null);
  });

  return (
    <section className="card stack" aria-labelledby="documentos">
      <h2 id="documentos">Documentos e contrato</h2>
      <p className="muted">
        Arquivos confidenciais: só quem tem a permissão de documentos de parceiros pode abrir, e
        cada leitura fica registrada na auditoria.
      </p>
      {fileError ? <Alert kind="error">{fileError}</Alert> : null}
      {partner.documents && partner.documents.length > 0 ? (
        <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
          {partner.documents.map((doc) => (
            <li key={doc.id} className="row">
              <strong>{doc.documentType}</strong>
              <span className="muted">{doc.fileName}</span>
              {doc.expiresOn ? (
                <span className="muted">validade {formatDate(doc.expiresOn)}</span>
              ) : null}
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-link"
                onClick={() =>
                  void openProtectedFile(`/partners/${partner.id}/documents/${doc.id}/file`).catch(
                    (caught: unknown) => setFileError(errorMessage(caught))
                  )
                }
              >
                Abrir
              </button>
              <button type="button" className="btn btn-link" onClick={() => setRemoving(doc.id)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nenhum documento enviado.</p>
      )}
      <form className="form" onSubmit={(event) => void upload.submit(event)}>
        <ErrorSummary error={upload.error} />
        <div className="form-grid">
          <TextField
            label="Tipo de documento"
            required
            value={meta.documentType}
            onChange={(e) => setMeta({ ...meta, documentType: e.target.value })}
          />
          <TextField
            label="Emissão"
            type="date"
            value={meta.issuedOn}
            onChange={(e) => setMeta({ ...meta, issuedOn: e.target.value })}
          />
          <TextField
            label="Validade"
            type="date"
            value={meta.expiresOn}
            onChange={(e) => setMeta({ ...meta, expiresOn: e.target.value })}
          />
          <TextField
            label="Arquivo (PDF ou imagem, até 10 MB)"
            type="file"
            required
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-secondary" disabled={upload.pending}>
            Enviar documento
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={removing !== null}
        title="Remover documento"
        description="O arquivo deixa de aparecer, mas o registro permanece no histórico."
        confirmLabel="Remover"
        danger
        requireReason
        onClose={() => setRemoving(null)}
        onConfirm={async (reason) => {
          onChanged(
            await api<Partner>(`/partners/${partner.id}/documents/${removing ?? ''}`, {
              method: 'DELETE',
              body: { reason }
            })
          );
        }}
      />
    </section>
  );
}

export default function PartnerAdminPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const partner = useResource<Partner>(`/partners/${id}`);
  const [form, setForm] = useState<Form>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [next, setNext] = useState<PartnerStatus | null>(null);
  const [logo, setLogo] = useState<File | null>(null);

  useEffect(() => {
    if (partner.data) {
      setForm(toForm(partner.data));
    }
  }, [partner.data]);

  const set = (key: string) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });

  const save = useSubmit(async () => {
    const type = form['commissionType'] as CommissionType;

    partner.setData(
      await api<Partner>(`/partners/${id}`, {
        method: 'PATCH',
        body: {
          legalName: form['legalName'],
          displayName: form['displayName'],
          type: form['type'],
          ...(form['documentNumber'] ? { documentNumber: form['documentNumber'] } : {}),
          contactName: form['contactName'] ?? '',
          email: form['email'] ?? '',
          phone: form['phone'] ?? '',
          description: form['description'] ?? '',
          websiteUrl: form['websiteUrl'] ?? '',
          contractStartsOn: form['contractStartsOn'] ?? '',
          contractEndsOn: form['contractEndsOn'] ?? '',
          contractNotes: form['contractNotes'] ?? '',
          commissionType: type,
          ...(type === 'PERCENTAGE'
            ? { commissionPercentage: normalizeAmount(form['commissionPercentage'] ?? '') }
            : {}),
          ...(type === 'FIXED'
            ? { commissionFixedAmount: normalizeAmount(form['commissionFixedAmount'] ?? '') }
            : {})
        }
      })
    );
    setNotice('Parceiro salvo. Mudanças de comissão valem para novas vendas.');
  });
  const uploadLogo = useSubmit(async () => {
    const body = new FormData();

    if (logo) {
      body.append('file', logo);
    }

    partner.setData(await api<Partner>(`/partners/${id}/logo`, { method: 'POST', body }));
    setLogo(null);
  });

  if (partner.loading && !partner.data) {
    return <Loading />;
  }

  if (partner.error || !partner.data) {
    return <Alert kind="error">{partner.error ?? 'Parceiro não encontrado.'}</Alert>;
  }

  const p = partner.data;
  const ended = p.status === 'ENDED';

  return (
    <>
      <PageHeader
        title={p.displayName}
        description={`${PARTNER_TYPE[p.type]} · cadastrado como ${p.legalName}`}
        actions={
          <>
            {can('services.manage') ? (
              <Link href={`/admin/servicos?parceiro=${p.id}`} className="btn btn-secondary">
                Profissionais e serviços ({p.counts.professionals}/{p.counts.services})
              </Link>
            ) : null}
            {can('settlements.manage') ? (
              <Link href={`/admin/repasses?parceiro=${p.id}`} className="btn btn-secondary">
                Repasses
              </Link>
            ) : null}
          </>
        }
      />
      {notice ? <Alert kind="success">{notice}</Alert> : null}
      <section className="card row" aria-label="Situação">
        <span className={`badge ${PARTNER_STATUS[p.status].badge}`}>
          {PARTNER_STATUS[p.status].label}
        </span>
        {p.status === 'ACTIVE' && !p.operational ? (
          <span className="badge badge-warning">fora da vigência do contrato</span>
        ) : null}
        {p.operational ? <span className="muted">Publicado no site e vendendo.</span> : null}
        <span className="spacer" />
        {PARTNER_NEXT[p.status].map((status) => (
          <button
            key={status}
            type="button"
            className={`btn btn-sm ${status === 'ENDED' ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setNext(status)}
          >
            {status === 'ACTIVE'
              ? p.status === 'PENDING'
                ? 'Aprovar'
                : 'Reativar'
              : status === 'INACTIVE'
                ? 'Inativar'
                : 'Encerrar'}
          </button>
        ))}
      </section>

      <form className="form card" onSubmit={(event) => void save.submit(event)}>
        <h2>Cadastro</h2>
        <ErrorSummary error={save.error} />
        <fieldset disabled={ended} className="stack">
          <div className="form-grid">
            <TextField
              label="Razão social / nome completo"
              required
              value={form['legalName'] ?? ''}
              onChange={set('legalName')}
            />
            <TextField
              label="Nome de exibição"
              required
              value={form['displayName'] ?? ''}
              onChange={set('displayName')}
            />
            <SelectField
              label="Tipo"
              value={form['type'] ?? 'STORE'}
              onChange={set('type')}
              options={Object.entries(PARTNER_TYPE).map(([value, label]) => ({ value, label }))}
            />
            <TextField
              label="CNPJ / CPF"
              value={form['documentNumber'] ?? ''}
              onChange={set('documentNumber')}
              hint={
                p.documentNumberMasked
                  ? `Atual: ${p.documentNumberMasked}. Preencha só para trocar.`
                  : 'Armazenado cifrado.'
              }
            />
            <TextField
              label="Contato"
              value={form['contactName'] ?? ''}
              onChange={set('contactName')}
            />
            <TextField
              label="E-mail"
              type="email"
              value={form['email'] ?? ''}
              onChange={set('email')}
            />
            <TextField label="Telefone" value={form['phone'] ?? ''} onChange={set('phone')} />
            <TextField
              label="Site"
              type="url"
              value={form['websiteUrl'] ?? ''}
              onChange={set('websiteUrl')}
              hint="Exibido na página pública."
            />
          </div>
          <TextArea
            label="Descrição pública"
            value={form['description'] ?? ''}
            onChange={set('description')}
          />
          <h3>Contrato e comissão</h3>
          <div className="form-grid">
            <TextField
              label="Início da vigência"
              type="date"
              value={form['contractStartsOn'] ?? ''}
              onChange={set('contractStartsOn')}
              hint="Obrigatório para aprovar."
            />
            <TextField
              label="Fim da vigência"
              type="date"
              value={form['contractEndsOn'] ?? ''}
              onChange={set('contractEndsOn')}
              hint="Vazio = sem prazo."
            />
            <SelectField
              label="Comissão do time"
              value={form['commissionType'] ?? 'NONE'}
              onChange={set('commissionType')}
              options={Object.entries(COMMISSION_TYPE).map(([value, label]) => ({
                value,
                label
              }))}
            />
            {form['commissionType'] === 'PERCENTAGE' ? (
              <TextField
                label="Percentual (%)"
                inputMode="decimal"
                required
                value={form['commissionPercentage'] ?? ''}
                onChange={set('commissionPercentage')}
              />
            ) : null}
            {form['commissionType'] === 'FIXED' ? (
              <TextField
                label="Valor por unidade (R$)"
                inputMode="decimal"
                required
                value={form['commissionFixedAmount'] ?? ''}
                onChange={set('commissionFixedAmount')}
              />
            ) : null}
          </div>
          <TextArea
            label="Observações comerciais (internas)"
            value={form['contractNotes'] ?? ''}
            onChange={set('contractNotes')}
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={save.pending}>
              Salvar
            </button>
          </div>
        </fieldset>
      </form>

      <form className="form card" onSubmit={(event) => void uploadLogo.submit(event)}>
        <h2>Logo</h2>
        <ErrorSummary error={uploadLogo.error} />
        <div className="row">
          {p.logoUrl ? (
            <img src={p.logoUrl} alt={`Logo de ${p.displayName}`} width={96} height={96} />
          ) : (
            <span className="muted">Sem logo.</span>
          )}
          <TextField
            label="Imagem (PNG, JPG ou WebP, até 5 MB)"
            type="file"
            required
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
          />
          <button type="submit" className="btn btn-secondary" disabled={uploadLogo.pending}>
            Enviar logo
          </button>
        </div>
      </form>

      {p.documents ? <DocumentsPanel partner={p} onChanged={partner.setData} /> : null}

      <ConfirmDialog
        open={next !== null}
        title={next ? `Parceiro: ${PARTNER_STATUS[next].label}` : ''}
        description={
          next === 'ACTIVE'
            ? 'O parceiro passa a aparecer no site e a vender dentro da vigência do contrato.'
            : next === 'ENDED'
              ? 'Encerramento é definitivo. Serviços são desativados; histórico de vendas e repasses permanece.'
              : next === 'INACTIVE'
                ? 'O parceiro sai do site e da loja, e os serviços são desativados.'
                : undefined
        }
        confirmLabel="Confirmar"
        danger={next === 'ENDED'}
        requireReason={next === 'INACTIVE' || next === 'ENDED'}
        onClose={() => setNext(null)}
        onConfirm={async (reason) => {
          partner.setData(
            await api<Partner>(`/partners/${id}/status`, {
              method: 'PUT',
              body: { status: next, ...(reason ? { reason } : {}) }
            })
          );
        }}
      />
    </>
  );
}
