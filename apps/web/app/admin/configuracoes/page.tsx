'use client';

import { useEffect, useState } from 'react';

import {
  Alert,
  ErrorSummary,
  Loading,
  PageHeader,
  TextArea,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import type { AdminTeam, BrandContext } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { formatDateTime } from '../../../lib/format';
import { useResource } from '../../../lib/use-resource';

const BRAND_CONTEXTS: { context: BrandContext; label: string }[] = [
  { context: 'OFFICIAL', label: 'Brasão oficial' },
  { context: 'MALE', label: 'Logo time masculino' },
  { context: 'FEMALE', label: 'Logo time feminino' },
  { context: 'BOARD', label: 'Logo da diretoria' },
  { context: 'COVER', label: 'Imagem de capa' }
];

type PublicForm = {
  teamName: string;
  officialName: string;
  description: string;
  history: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  socialLinks: string;
  termsOfUse: string;
  privacyPolicy: string;
  monthlyFeeRules: string;
  storeRules: string;
  pickupInstructions: string;
};

function toForm(team: AdminTeam): PublicForm {
  return {
    teamName: team.teamName,
    officialName: team.officialName,
    description: team.description ?? '',
    history: team.history ?? '',
    email: team.email ?? '',
    phone: team.phone ?? '',
    addressLine1: team.address.line1 ?? '',
    addressCity: team.address.city ?? '',
    addressState: team.address.state ?? '',
    addressPostalCode: team.address.postalCode ?? '',
    socialLinks: team.socialLinks.map((link) => `${link.label} | ${link.url}`).join('\n'),
    termsOfUse: team.termsOfUse ?? '',
    privacyPolicy: team.privacyPolicy ?? '',
    monthlyFeeRules: team.monthlyFeeRules ?? '',
    storeRules: team.storeRules ?? '',
    pickupInstructions: team.pickupInstructions ?? ''
  };
}

function BrandUpload({
  context,
  label,
  current,
  onDone
}: {
  context: BrandContext;
  label: string;
  current?: string | undefined;
  onDone: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const upload = useSubmit(async () => {
    if (!file) {
      return;
    }

    const form = new FormData();

    form.set('file', file);
    form.set('altText', alt);
    await api(`/team-settings/brand-assets/${context}`, { method: 'PUT', body: form });
    setFile(null);
    await onDone();
  });

  return (
    <form className="card stack" onSubmit={(event) => void upload.submit(event)}>
      <strong>{label}</strong>
      {current ? (
        <img src={current} alt={label} style={{ maxHeight: 120, objectFit: 'contain' }} />
      ) : (
        <span className="muted">Nenhuma imagem enviada.</span>
      )}
      <ErrorSummary error={upload.error} />
      <div className="field">
        <label htmlFor={`file-${context}`}>Arquivo (PNG, JPG ou WebP, até 5 MB)</label>
        <input
          id={`file-${context}`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <TextField label="Texto alternativo" value={alt} onChange={(e) => setAlt(e.target.value)} />
      <button type="submit" className="btn btn-secondary btn-sm" disabled={!file || upload.pending}>
        {upload.pending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  );
}

export default function SettingsPage() {
  const { can } = useAuth();
  const settings = useResource<AdminTeam>('/team-settings');
  const [form, setForm] = useState<PublicForm | null>(null);
  const [pix, setPix] = useState('');
  const [banking, setBanking] = useState('');

  useEffect(() => {
    if (settings.data) {
      setForm(toForm(settings.data));
      setPix(settings.data.financial?.pixKey ?? '');
      setBanking(settings.data.financial?.bankingDetails ?? '');
    }
  }, [settings.data]);

  const savePublic = useSubmit(async () => {
    if (!form) {
      return;
    }

    const { socialLinks, ...rest } = form;
    const links = socialLinks
      .split('\n')
      .map((line) => line.split('|').map((part) => part.trim()))
      .filter((parts) => parts.length === 2 && parts[0] && parts[1])
      .map(([label, url]) => ({ label, url }));
    const updated = await api<AdminTeam>('/team-settings', {
      method: 'PATCH',
      body: { ...rest, socialLinks: links }
    });

    settings.setData(updated);
    savePublic.setMessage('Configurações públicas salvas. O site já reflete as alterações.');
  });
  const saveFinancial = useSubmit(async () => {
    const updated = await api<AdminTeam>('/team-settings/financial', {
      method: 'PUT',
      body: { pixKey: pix, bankingDetails: banking }
    });

    settings.setData(updated);
    saveFinancial.setMessage('Dados financeiros salvos (armazenados cifrados).');
  });

  if (!settings.data || !form) {
    return settings.error ? <Alert kind="error">{settings.error}</Alert> : <Loading />;
  }

  const editable = can('settings.public.manage');
  const set = (key: keyof PublicForm) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });

  return (
    <>
      <PageHeader
        title="Configurações do time"
        description={`Última alteração em ${formatDateTime(settings.data.updatedAt)}${settings.data.updatedBy ? ` por ${settings.data.updatedBy}` : ''}`}
      />

      <form className="form card" onSubmit={(event) => void savePublic.submit(event)}>
        <h2>Dados públicos</h2>
        {savePublic.message ? <Alert kind="success">{savePublic.message}</Alert> : null}
        <ErrorSummary error={savePublic.error} />
        <fieldset
          disabled={!editable}
          className="stack"
          style={{ border: 0, padding: 0, margin: 0 }}
        >
          <div className="form-grid">
            <TextField
              label="Nome curto"
              required
              value={form.teamName}
              onChange={set('teamName')}
            />
            <TextField
              label="Nome oficial"
              required
              value={form.officialName}
              onChange={set('officialName')}
            />
            <TextField
              label="E-mail público"
              type="email"
              value={form.email}
              onChange={set('email')}
            />
            <TextField label="Telefone/WhatsApp" value={form.phone} onChange={set('phone')} />
            <TextField label="Endereço" value={form.addressLine1} onChange={set('addressLine1')} />
            <TextField label="Cidade" value={form.addressCity} onChange={set('addressCity')} />
            <TextField label="UF" value={form.addressState} onChange={set('addressState')} />
            <TextField
              label="CEP"
              value={form.addressPostalCode}
              onChange={set('addressPostalCode')}
            />
          </div>
          <TextArea
            label="Descrição curta"
            value={form.description}
            onChange={set('description')}
          />
          <TextArea label="História" value={form.history} onChange={set('history')} />
          <TextArea
            label="Redes sociais"
            hint="Uma por linha no formato: Nome | https://endereco"
            value={form.socialLinks}
            onChange={set('socialLinks')}
          />
          <TextArea label="Termos de uso" value={form.termsOfUse} onChange={set('termsOfUse')} />
          <TextArea
            label="Política de privacidade"
            value={form.privacyPolicy}
            onChange={set('privacyPolicy')}
          />
          <TextArea
            label="Regras de mensalidade"
            value={form.monthlyFeeRules}
            onChange={set('monthlyFeeRules')}
          />
          <TextArea label="Regras da loja" value={form.storeRules} onChange={set('storeRules')} />
          <TextArea
            label="Instruções de retirada"
            value={form.pickupInstructions}
            onChange={set('pickupInstructions')}
          />
        </fieldset>
        {editable ? (
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={savePublic.pending}>
              Salvar dados públicos
            </button>
          </div>
        ) : (
          <Alert kind="info">Somente administradores podem alterar os dados públicos.</Alert>
        )}
      </form>

      {settings.data.financial ? (
        <form className="form card" onSubmit={(event) => void saveFinancial.submit(event)}>
          <h2>Dados de pagamento</h2>
          <p className="muted">
            Visíveis apenas para usuários autenticados no momento do pagamento. Armazenados
            cifrados.
          </p>
          {saveFinancial.message ? <Alert kind="success">{saveFinancial.message}</Alert> : null}
          <ErrorSummary error={saveFinancial.error} />
          <TextField label="Chave PIX" value={pix} onChange={(e) => setPix(e.target.value)} />
          <TextArea
            label="Dados bancários"
            value={banking}
            onChange={(e) => setBanking(e.target.value)}
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saveFinancial.pending}>
              Salvar dados de pagamento
            </button>
          </div>
        </form>
      ) : null}

      {can('logos.manage') ? (
        <section className="stack" aria-labelledby="marca">
          <h2 id="marca">Marca e logos</h2>
          <div className="form-grid">
            {BRAND_CONTEXTS.map((item) => (
              <BrandUpload
                key={item.context}
                context={item.context}
                label={item.label}
                {...(settings.data?.brandAssets[item.context]?.url
                  ? { current: settings.data.brandAssets[item.context]?.url }
                  : {})}
                onDone={settings.reload}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
