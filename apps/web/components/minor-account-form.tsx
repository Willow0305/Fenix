'use client';

import Link from 'next/link';
import { useState } from 'react';

import { api } from '../lib/api-client';
import type { AthleteDetail } from '../lib/sports-types';
import { Icon } from './icon';
import { ErrorSummary, PhoneField, TextField, useSubmit } from './ui';

/**
 * Conta do atleta menor (DT-092): só a diretoria cria, para atleta do time, com a declaração
 * assinada pelo responsável. A pessoa recebe no e-mail o link para definir a senha.
 */
export function MinorAccountForm({
  athlete,
  onCreated
}: {
  readonly athlete: AthleteDetail;
  readonly onCreated: (updated: AthleteDetail) => void;
}) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const inTeam =
    athlete.status === 'ACTIVE' &&
    athlete.memberships.some((membership) => membership.status === 'ACTIVE' && !membership.endsOn);
  const action = useSubmit(async () => {
    const body = new FormData();

    body.set('email', email);

    if (phone.trim()) {
      body.set('phone', phone.trim());
    }

    if (file) {
      body.set('file', file);
    }

    onCreated(
      await api<AthleteDetail>(`/athletes/${athlete.id}/minor-account`, { method: 'POST', body })
    );
  });

  if (!inTeam) {
    return (
      <p className="muted m-0">
        Atleta menor de idade só tem conta própria se estiver Ativo e fizer parte de uma equipe do
        time. Depois do vínculo com a equipe, crie a conta aqui com a declaração do responsável.
      </p>
    );
  }

  return (
    <form className="stack" onSubmit={(event) => void action.submit(event)}>
      <p className="m-0">
        Menor de 18 anos não cria conta pelo site. A diretoria cria, com a declaração assinada por
        um dos responsáveis. A conta não participa do fórum e o perfil fica privado até os 18 anos.
      </p>
      <p className="m-0">
        <Link href={`/imprimir/declaracao-responsavel/${athlete.id}`} target="_blank">
          <Icon name="printer" /> Imprimir a declaração para o responsável assinar
        </Link>
      </p>
      <ErrorSummary error={action.error} />
      <div className="form-grid">
        <TextField
          label="E-mail da conta"
          type="email"
          maxLength={180}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          hint="O link para definir a senha vai para este e-mail."
          error={action.fieldError('email')}
        />
        <PhoneField
          label="Celular (opcional)"
          value={phone}
          onValueChange={setPhone}
          error={action.fieldError('phone')}
        />
        <div className="field">
          <label htmlFor="declaracao-responsavel">
            Declaração assinada pelo responsável (imagem ou PDF, até 10 MB)
          </label>
          <input
            id="declaracao-responsavel"
            type="file"
            required
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div className="form-actions">
        {/* Sem `disabled` por campo vazio: o navegador aponta o que falta ao enviar. */}
        <button type="submit" className="btn btn-primary" disabled={action.pending}>
          {action.pending ? 'Criando conta…' : 'Criar conta do atleta'}
        </button>
      </div>
    </form>
  );
}
