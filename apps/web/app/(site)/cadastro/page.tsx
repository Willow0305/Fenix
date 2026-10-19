'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ErrorSummary, TextField, useSubmit } from '../../../components/ui';
import { useAuth } from '../../../lib/auth-context';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const action = useSubmit(async () => {
    await register({
      name: form.name,
      email: form.email,
      password: form.password,
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      acceptTerms,
      minimumAgeConfirmed: ageOk
    });
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
          autoComplete="name"
          required
          value={form.name}
          onChange={set('name')}
          error={action.fieldError('name')}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={set('email')}
          error={action.fieldError('email')}
        />
        <TextField
          label="Telefone (opcional)"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={set('phone')}
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
          <span>Declaro ter 12 anos ou mais. Menores de 18 devem ter ciência do responsável.</span>
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
