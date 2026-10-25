'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Alert, ErrorSummary, TextField, useSubmit } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';
import { safeInternalPath } from '../../../lib/safe-redirect';

function LoginForm() {
  const { login, verifyMfa } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const goNext = () => router.push(safeInternalPath(params.get('next')));
  const action = useSubmit(async () => {
    const result = await login(email, password);

    if (result === null) {
      goNext();
    } else {
      setPassword('');
      setChallenge(result.challengeToken);
    }
  });
  const second = useSubmit(async () => {
    try {
      await verifyMfa(challenge ?? '', code);
      goNext();
    } catch (error) {
      setCode('');

      if (error instanceof ApiError && error.problem.code !== 'INVALID_MFA_CODE') {
        setChallenge(null);
      }

      throw error;
    }
  });

  if (challenge !== null) {
    return (
      <form className="form card" onSubmit={(event) => void second.submit(event)} noValidate>
        <h2>Verificação em duas etapas</h2>
        <p>Digite o código de 6 dígitos do aplicativo autenticador.</p>
        <ErrorSummary error={second.error} />
        <TextField
          label="Código"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          hint="Sem o celular? Use um dos códigos de recuperação (formato XXXX-XXXX-XXXX)."
        />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={second.pending}>
            {second.pending ? 'Verificando…' : 'Verificar'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setChallenge(null);
              setCode('');
            }}
          >
            Voltar
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="form card" onSubmit={(event) => void action.submit(event)} noValidate>
      {params.get('motivo') === 'expirada' ? (
        <Alert kind="info">
          Sua sessão foi encerrada por inatividade ou tempo limite. Entre novamente.
        </Alert>
      ) : null}
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
