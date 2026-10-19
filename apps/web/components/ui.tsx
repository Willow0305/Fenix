'use client';

import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState
} from 'react';

import { ApiError, errorMessage } from '../lib/api-client';

/** Componentes de formulário acessíveis: rótulo visível, ajuda e erro associados. */
interface FieldShellProps {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly required?: boolean | undefined;
  readonly children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}

function FieldShell({ label, hint, error, required, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children({ id, describedBy })}
      {hint ? (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="field-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

type Common = {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
};

export function TextField({
  label,
  hint,
  error,
  required,
  ...props
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy }) => (
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  required,
  ...props
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  options,
  ...props
}: Common &
  SelectHTMLAttributes<HTMLSelectElement> & {
    readonly options: readonly { value: string; label: string }[];
  }) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy }) => (
        <select
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function Alert({
  kind,
  children
}: {
  readonly kind: 'error' | 'success' | 'info' | 'warning';
  readonly children: ReactNode;
}) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/** Estado padrão de submissão: evita envio duplicado e expõe erros de campo da API. */
export function useSubmit<T>(action: () => Promise<T>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event?: FormEvent): Promise<T | undefined> {
    event?.preventDefault();

    if (pending) {
      return undefined;
    }

    setPending(true);
    setError(null);
    setMessage(null);

    try {
      return await action();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError({
              status: 0,
              code: 'NETWORK',
              title: 'Erro',
              detail: errorMessage(caught)
            })
      );

      return undefined;
    } finally {
      setPending(false);
    }
  }

  return {
    pending,
    error,
    message,
    setMessage,
    submit,
    fieldError: (field: string) => error?.fieldError(field)
  };
}

export function ErrorSummary({ error }: { readonly error: ApiError | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) {
      ref.current?.focus();
    }
  }, [error]);

  if (!error) {
    return null;
  }

  return (
    <div ref={ref} tabIndex={-1} className="alert alert-error" role="alert">
      <strong>{error.problem.detail}</strong>
      {error.problem.errors && error.problem.errors.length > 0 ? (
        <ul>
          {error.problem.errors.map((item) => (
            <li key={`${item.field}-${item.code}`}>{item.message}</li>
          ))}
        </ul>
      ) : null}
      {error.problem.requestId && error.status >= 500 ? (
        <small> Código para suporte: {error.problem.requestId}</small>
      ) : null}
    </div>
  );
}

export function Loading({ label = 'Carregando…' }: { readonly label?: string }) {
  return (
    <div className="empty" aria-busy="true" role="status">
      {label}
    </div>
  );
}

export function Empty({ children }: { readonly children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions
}: {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange
}: {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (pages <= 1) {
    return <p className="muted">{total} registro(s)</p>;
  }

  return (
    <nav aria-label="Paginação" className="row">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Anterior
      </button>
      <span>
        Página {page} de {pages} · {total} registro(s)
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Próxima
      </button>
    </nav>
  );
}

/**
 * Diálogo de confirmação para ações sensíveis; exige motivo quando `requireReason`.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  requireReason = false,
  danger = false,
  children,
  onConfirm,
  onClose
}: {
  readonly open: boolean;
  readonly title: string;
  readonly description?: ReactNode;
  readonly confirmLabel: string;
  readonly requireReason?: boolean;
  readonly danger?: boolean;
  readonly children?: ReactNode;
  readonly onConfirm: (reason: string) => Promise<void>;
  readonly onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const action = useSubmit(async () => {
    await onConfirm(reason.trim());
    setReason('');
    onClose();
  });

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal?.();
    } else if (!open && dialog.open) {
      dialog.close?.();
    }
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="confirm-title">
      <form className="form" onSubmit={(event) => void action.submit(event)}>
        <h2 id="confirm-title">{title}</h2>
        {description ? <div>{description}</div> : null}
        {children}
        {requireReason ? (
          <TextArea
            label="Motivo"
            required
            minLength={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint="O motivo fica registrado na auditoria."
          />
        ) : null}
        <ErrorSummary error={action.error} />
        <div className="form-actions">
          <button
            type="submit"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            disabled={action.pending}
          >
            {action.pending ? 'Processando…' : confirmLabel}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
