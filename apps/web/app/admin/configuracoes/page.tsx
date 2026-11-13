'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

import {
  Alert,
  ErrorSummary,
  Loading,
  PageHeader,
  PhoneField,
  TextArea,
  TextField,
  useSubmit
} from '../../../components/ui';
import { api } from '../../../lib/api-client';
import { StaleNotice } from '../../../components/stale-notice';
import { ImageGalleryManager } from '../../../components/image-gallery-manager';
import type { AdminTeam, BrandContext, LegalVersion } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { formatDateTime } from '../../../lib/format';
import { useEditableCopy } from '../../../lib/use-editable-copy';
import { useResource } from '../../../lib/use-resource';

const BRAND_CONTEXTS: { context: BrandContext; label: string }[] = [
  { context: 'OFFICIAL', label: 'Brasão oficial' },
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

/** Cada alteração salva vira uma nova versão, aceita no cadastro e por quem já tem conta (DT-089, DT-094). */
function legalHint(version: LegalVersion | null | undefined): string {
  return version
    ? `Em vigor: versão ${version.version}. Ao salvar uma alteração, ela vira a versão ${version.version + 1}: os novos cadastros passam a aceitá-la, e quem já tem conta precisa aceitá-la para continuar.`
    : 'Ao salvar o texto, ele vira a versão 1: aceita em cada novo cadastro e por quem já tem conta, no próximo acesso.';
}

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
          required
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <TextField
        label="Texto alternativo"
        maxLength={180}
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
      />
      <button type="submit" className="btn btn-secondary btn-sm" disabled={upload.pending}>
        {upload.pending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  );
}

export default function SettingsPage() {
  const { can } = useAuth();
  const settings = useResource<AdminTeam>('/team-settings');
  const publicCopy = useEditableCopy(settings.data, toForm);
  const { form, setForm } = publicCopy;
  const financial = useEditableCopy(settings.data, (data: AdminTeam) => ({
    pix: data.financial?.pixKey ?? '',
    banking: data.financial?.bankingDetails ?? ''
  }));
  const pix = financial.form?.pix ?? '';
  const banking = financial.form?.banking ?? '';
  const setPix = (value: string) => financial.setForm({ pix: value, banking });
  const setBanking = (value: string) => financial.setForm({ pix, banking: value });

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
  // Convite "Quer jogar com a gente?" (DT-091): liga e desliga na hora, sem o botão Salvar.
  const inviteTarget = useRef(true);
  const toggleInvite = useSubmit(async () => {
    const enabled = inviteTarget.current;
    const updated = await api<AdminTeam>('/team-settings', {
      method: 'PATCH',
      body: { joinInviteEnabled: enabled }
    });

    settings.setData(updated);
    toggleInvite.setMessage(
      enabled
        ? 'Convite ligado: aparece na página Times.'
        : 'Convite desligado: só aparece quando houver seletiva aberta.'
    );
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
        <StaleNotice
          stale={publicCopy.stale}
          onDiscard={publicCopy.discard}
          canUndo={publicCopy.canUndo}
          onUndo={publicCopy.undo}
        />
        <fieldset
          disabled={!editable}
          className="stack"
          style={{ border: 0, padding: 0, margin: 0 }}
        >
          <div className="form-grid">
            <TextField
              label="Nome curto"
              maxLength={160}
              required
              value={form.teamName}
              onChange={set('teamName')}
            />
            <TextField
              label="Nome oficial"
              maxLength={200}
              required
              value={form.officialName}
              onChange={set('officialName')}
            />
            <TextField
              label="E-mail público"
              maxLength={180}
              type="email"
              value={form.email}
              onChange={set('email')}
            />
            <PhoneField
              label="Telefone/WhatsApp"
              allowLandline
              value={form.phone}
              onValueChange={(value) => set('phone')({ target: { value } })}
            />
            <TextField
              label="Endereço"
              maxLength={200}
              value={form.addressLine1}
              onChange={set('addressLine1')}
            />
            <TextField
              label="Cidade"
              maxLength={120}
              value={form.addressCity}
              onChange={set('addressCity')}
            />
            <TextField
              label="UF"
              maxLength={2}
              value={form.addressState}
              onChange={set('addressState')}
            />
            <TextField
              label="CEP"
              maxLength={9}
              value={form.addressPostalCode}
              onChange={set('addressPostalCode')}
            />
          </div>
          <TextArea
            label="Descrição curta"
            maxLength={2000}
            value={form.description}
            onChange={set('description')}
          />
          <TextArea
            label="História"
            maxLength={20000}
            value={form.history}
            onChange={set('history')}
          />
          <TextArea
            label="Redes sociais"
            maxLength={2000}
            hint="Uma por linha no formato: Nome | https://endereco"
            value={form.socialLinks}
            onChange={set('socialLinks')}
          />
          <TextArea
            label="Termos de uso"
            maxLength={50000}
            hint={legalHint(settings.data?.legalVersions?.termsOfUse)}
            value={form.termsOfUse}
            onChange={set('termsOfUse')}
          />
          <TextArea
            label="Política de privacidade"
            maxLength={50000}
            hint={legalHint(settings.data?.legalVersions?.privacyPolicy)}
            value={form.privacyPolicy}
            onChange={set('privacyPolicy')}
          />
          <TextArea
            label="Regras de mensalidade"
            maxLength={20000}
            value={form.monthlyFeeRules}
            onChange={set('monthlyFeeRules')}
          />
          <TextArea
            label="Regras da loja"
            maxLength={20000}
            value={form.storeRules}
            onChange={set('storeRules')}
          />
          <TextArea
            label="Instruções de retirada"
            maxLength={5000}
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

      <section className="card stack" aria-labelledby="convites-site">
        <h2 id="convites-site">Convite para jogar</h2>
        {toggleInvite.message ? <Alert kind="success">{toggleInvite.message}</Alert> : null}
        <ErrorSummary error={toggleInvite.error} />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.data.joinInviteEnabled !== false}
            disabled={!editable || toggleInvite.pending}
            onChange={(event) => {
              inviteTarget.current = event.target.checked;
              void toggleInvite.submit();
            }}
          />
          <span>Mostrar o convite "Quer jogar com a gente?" na página Times</span>
        </label>
        <p className="muted m-0">
          Desligado, o convite some enquanto não houver seletiva aberta. Com uma seletiva aberta,
          ele aparece mesmo desligado, para levar às inscrições.
        </p>
      </section>

      {settings.data.financial ? (
        <form className="form card" onSubmit={(event) => void saveFinancial.submit(event)}>
          <h2>Dados de pagamento</h2>
          <p className="muted">
            Visíveis apenas para usuários autenticados no momento do pagamento. Armazenados
            cifrados.
          </p>
          {saveFinancial.message ? <Alert kind="success">{saveFinancial.message}</Alert> : null}
          <ErrorSummary error={saveFinancial.error} />
          <StaleNotice
            stale={financial.stale}
            onDiscard={financial.discard}
            canUndo={financial.canUndo}
            onUndo={financial.undo}
          />
          <TextField
            label="Chave PIX"
            maxLength={140}
            value={pix}
            onChange={(e) => setPix(e.target.value)}
          />
          <TextArea
            label="Dados bancários"
            maxLength={1000}
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
          <p className="muted m-0">
            A logo de cada time (masculino, feminino, 4x4…) é enviada em{' '}
            <Link href="/admin/equipes">Equipes</Link>, na edição do próprio time.
          </p>
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
          {settings.data ? (
            <ImageGalleryManager<AdminTeam>
              imagesOf={(detail) => detail.photos ?? []}
              basePath="/team-settings/photos"
              images={settings.data.photos ?? []}
              onChange={settings.setData}
              max={20}
              title="Fotos do clube"
              noun="no clube"
              intro="Passam sozinhas, uma de cada vez, na página Sobre, na ordem daqui. Arraste ou use as setas para ordenar. A descrição vira a legenda e ajuda quem usa leitor de tela. Use só fotos com autorização de imagem."
              emptyText="Nenhuma foto ainda. Sem fotos, a página Sobre mostra a imagem de capa."
              placeholder="Ex.: elencos masculino e feminino reunidos"
              removeDescription="A foto sai da página Sobre."
            />
          ) : null}
        </section>
      ) : null}
    </>
  );
}
