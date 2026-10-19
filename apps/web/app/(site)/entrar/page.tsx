'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { ErrorSummary, TextField, useSubmit } from '../../../components/ui';
import { useAuth } from '../../../lib/auth-context';

function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/minha-conta';
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const action = useSubmit(async () => {
    await login(email, password);
    router.push(safeNext(params.get('next')));
  });

  return (
    <form className="form card" onSubmit={(event) => void action.submit(event)} noValidate>
      <ErrorSummary error={action.error} />
      <TextField
        label="E-mail"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label="Senha"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={action.pending}>
          {action.pending ? 'Entrando…' : 'Entrar'}
        </button>
        <Link href="/recuperar-senha">Esqueci minha senha</Link>
      </div>
      <p>
        Ainda não tem conta? <Link href="/cadastro">Cadastre-se</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: '2.5rem' }}>
      <h1>Entrar</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
