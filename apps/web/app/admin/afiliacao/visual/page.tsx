'use client';

import { useEffect, useState } from 'react';

import { AffiliationNav } from '../../../../components/affiliation-nav';
import { MemberCardFront } from '../../../../components/member-card';
import { PageHeader, Skeleton, useSubmit } from '../../../../components/ui';
import { api } from '../../../../lib/api-client';
import { useAuth } from '../../../../lib/auth-context';
import {
  CARD_TEMPLATES,
  type CardDesign,
  type CardTemplate,
  type MemberCard
} from '../../../../lib/card-types';
import { useResource } from '../../../../lib/use-resource';

const PREVIEW: MemberCard = {
  id: 'previa',
  code: 'FNX-EXEMPLO',
  type: 'AFFILIATE',
  state: 'VALID',
  stateLabel: 'Válida',
  holderName: 'Nome do Titular',
  startsOn: null,
  endsOn: '2027-12-31',
  photo: null,
  team: null,
  purchasedForOther: false,
  benefits: []
};

/** Modelo, logo e imagem de fundo, iguais para todas as carteirinhas (DT-068 F). */
function DesignSettings() {
  const { can } = useAuth();
  const design = useResource<CardDesign>('/cards/design');
  const [form, setForm] = useState<{ template: CardTemplate; useTeamLogo: boolean } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const save = useSubmit(async () => {
    if (form) {
      await api('/cards/design', { method: 'PUT', body: form });
    }

    if (file) {
      const body = new FormData();

      body.set('file', file);
      body.set('altText', 'Fundo da carteirinha');
      await api('/team-settings/brand-assets/CARD_BACKGROUND', { method: 'PUT', body });
      setFile(null);
    }

    await design.reload();
    save.setMessage('Visual salvo.');
  });

  useEffect(() => {
    if (design.data && form === null) {
      setForm({ template: design.data.template, useTeamLogo: design.data.useTeamLogo });
    }
  }, [design.data, form]);

  if (!design.data || !form) {
    return <Skeleton lines={3} />;
  }

  const manage = can('cards.manage');

  return (
    <form className="stack" onSubmit={(event) => void save.submit(event)}>
      <div className="row" style={{ alignItems: 'flex-start', gap: '1.5rem' }}>
        <MemberCardFront card={PREVIEW} design={{ ...design.data, ...form }} />
        <fieldset className="form-section" disabled={!manage}>
          <legend>Modelo</legend>
          {CARD_TEMPLATES.map((t) => (
            <label key={t.value} className="checkbox">
              <input
                type="radio"
                name="modelo"
                checked={form.template === t.value}
                onChange={() => setForm({ ...form, template: t.value })}
              />
              <span>{t.label}</span>
            </label>
          ))}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.useTeamLogo}
              onChange={(e) => setForm({ ...form, useTeamLogo: e.target.checked })}
            />
            <span>Na carteirinha de atleta, usar a logo da equipe (senão, o brasão oficial)</span>
          </label>
          {can('logos.manage') ? (
            <div className="field">
              <label htmlFor="fundo-carteirinha">Imagem de fundo (opcional, PNG/JPG/WebP)</label>
              <input
                id="fundo-carteirinha"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : null}
          {save.message ? <p className="muted">{save.message}</p> : null}
          {manage ? (
            <div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={save.pending}>
                Salvar visual
              </button>
            </div>
          ) : null}
        </fieldset>
      </div>
    </form>
  );
}

export default function CardVisualPage() {
  return (
    <>
      <PageHeader
        title="Visual da carteirinha"
        description="Modelo, logo e imagem de fundo, iguais para todas as carteirinhas (atleta e afiliado)."
      />
      <AffiliationNav />
      <section className="card">
        <DesignSettings />
      </section>
    </>
  );
}
