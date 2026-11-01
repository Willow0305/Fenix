'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ErrorSummary, PhoneField, TextField, useSubmit } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import type { PublicTeam } from '../../../lib/api-types';
import { useAuth } from '../../../lib/auth-context';
import { useResource } from '../../../lib/use-resource';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  // Versões em vigor: o aceite fica registrado com o texto exato que a pessoa leu (DT-089).
  const team = useResource<PublicTeam>('/public/team');
  const versions = team.data?.legalVersions;
  const action = useSubmit(async () => {
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        acceptTerms,
        minimumAgeConfirmed: ageOk,
        ...(versions?.termsOfUse ? { termsVersionId: versions.termsOfUse.id } : {}),
        ...(versions?.privacyPolicy ? { privacyVersionId: versions.privacyPolicy.id } : {})
      });
    } catch (error) {
      // Texto atualizado enquanto a pessoa preenchia: busca a versão nova e pede o aceite de novo.
      if (error instanceof ApiError && error.problem.code === 'LEGAL_VERSION_CHANGED') {
        setAcceptTerms(false);
        await team.reload();
      }

      throw error;
    }
    router.push('/minha-conta');
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="container" style={{ maxWidth: 560, paddingTop: '2.5rem' }}>
      <h1>Criar conta</h1>
      <p className="muted">
        A conta permite comprar na loja, salvar favoritos e acompanhar pedidos. Atletas recebem
        acesso à área do atleta após vínculo feito pela diretoria.
      </p>
      <form
        className="form card"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const different = form.password !== form.confirm;

          setMismatch(different);

          if (!different) {
            void action.submit();
          }
        }}
      >
        <ErrorSummary error={action.error} />
        <TextField
          label="Nome completo"
          maxLength={160}
          autoComplete="name"
          required
          value={form.name}
          onChange={set('name')}
          error={action.fieldError('name')}
        />
        <TextField
          label="E-mail"
          maxLength={180}
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={set('email')}
          error={action.fieldError('email')}
        />
        <PhoneField
          label="Celular (opcional)"
          value={form.phone}
          onValueChange={(value) => set('phone')({ target: { value } })}
          error={action.fieldError('phone')}
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set('password')}
          hint="Mínimo de 10 caracteres, com letras e números."
          error={action.fieldError('password')}
        />
        <TextField
          label="Confirme a senha"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={set('confirm')}
          error={mismatch ? 'As senhas não conferem.' : undefined}
        />
        <label className="checkbox">
          <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
          <span>
            Declaro ter 18 anos ou mais. Menores de idade participam pelo responsável, junto à
            diretoria do time.
          </span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
          />
          <span>
            Li e aceito os <Link href="/termos">termos de uso</Link> e a{' '}
            <Link href="/privacidade">política de privacidade</Link>.
          </span>
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={action.pending}>
            {action.pending ? 'Criando conta…' : 'Criar conta'}
          </button>
          <Link href="/entrar">Já tenho conta</Link>
        </div>
      </form>
    </div>
  );
}
