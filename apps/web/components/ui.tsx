'use client';

import {
  type FormEvent,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState
} from 'react';

import {
  BR_MESSAGES,
  COUNTER_THRESHOLD,
  formatCpf,
  formatCpfOrCnpj,
  formatPhone,
  isValidCpf,
  isValidCpfOrCnpj,
  isValidMobilePhone,
  isValidPhone,
  onlyDigits
} from '@fenix/validation';

import { ApiError, errorMessage } from '../lib/api-client';
import { decimalDisplay, type NumericMode, sanitizeNumeric } from '../lib/numeric-input';

/** Componentes de formulário acessíveis: rótulo visível, ajuda e erro associados. */
interface FieldShellProps {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly required?: boolean | undefined;
  /** Contador "n/limite" (docs/29 §3.1); só aparece a partir de COUNTER_THRESHOLD. */
  readonly counter?: { readonly length: number; readonly max: number } | undefined;
  readonly children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}

function FieldShell({ label, hint, error, required, counter, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const counterId = counter ? `${id}-counter` : undefined;
  const describedBy = [hintId, errorId, counterId].filter(Boolean).join(' ') || undefined;

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
      {counter ? (
        <span
          id={counterId}
          className={`field-counter${counter.length >= counter.max * 0.9 ? ' is-near' : ''}`}
          aria-live={counter.length >= counter.max * 0.9 ? 'polite' : 'off'}
        >
          {counter.length}/{counter.max}
        </span>
      ) : null}
    </div>
  );
}

function counterFor(
  value: unknown,
  maxLength: number | undefined
): { length: number; max: number } | undefined {
  return maxLength !== undefined && maxLength >= COUNTER_THRESHOLD
    ? { length: typeof value === 'string' ? value.length : 0, max: maxLength }
    : undefined;
}

type Common = {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
};

/**
 * Campo de texto. `numeric` (ou `type="number"`) só aceita número: `integer` só dígitos;
 * `decimal` mostra vírgula e entrega ponto ao formulário (DT-051).
 */
export function TextField({
  label,
  hint,
  error,
  required,
  numeric,
  ...props
}: Common &
  InputHTMLAttributes<HTMLInputElement> & { readonly numeric?: NumericMode | undefined }) {
  const mode: NumericMode | undefined =
    numeric ?? (props.type === 'number' ? 'integer' : undefined);
  const numericProps = mode
    ? {
        type: 'text',
        // O teclado numérico do celular não tem "-": o modo com sinal usa o teclado comum.
        inputMode:
          mode === 'decimal'
            ? ('decimal' as const)
            : mode === 'signed'
              ? ('text' as const)
              : ('numeric' as const),
        autoComplete: props.autoComplete ?? 'off',
        ...(mode === 'decimal' && typeof props.value === 'string'
          ? { value: decimalDisplay(props.value) }
          : {}),
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          event.target.value = sanitizeNumeric(mode, event.target.value);
          props.onChange?.(event);
        }
      }
    : {};

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      counter={counterFor(props.value, props.maxLength)}
    >
      {({ id, describedBy }) => (
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
          {...numericProps}
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
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      counter={counterFor(props.value, props.maxLength)}
    >
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

type MaskedProps = Common &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    readonly value: string;
    /** Recebe só os dígitos (formato gravado pela API); a máscara é só de exibição. */
    readonly onValueChange: (value: string) => void;
  };

/**
 * Campo com máscara e validação ao sair do campo (docs/29 §3.2–3.3). A mensagem local
 * some ao digitar; o erro devolvido pela API (`error`) sempre tem prioridade.
 */
function MaskedField({
  format,
  isValid,
  invalidMessage,
  value,
  onValueChange,
  error,
  ...props
}: MaskedProps & {
  readonly format: (value: string) => string;
  readonly isValid: (value: string) => boolean;
  readonly invalidMessage: string;
}) {
  const [touched, setTouched] = useState(false);
  const localError = touched && value !== '' && !isValid(value) ? invalidMessage : undefined;

  return (
    <TextField
      {...props}
      value={format(value)}
      error={error ?? localError}
      onChange={(event) => {
        setTouched(false);
        onValueChange(onlyDigits(format(event.target.value)));
      }}
      onBlur={(event) => {
        setTouched(true);
        props.onBlur?.(event);
      }}
    />
  );
}

/** CPF `000.000.000-00`. RG não é aceito (PEN-056). */
export function CpfField(props: MaskedProps) {
  return (
    <MaskedField
      inputMode="numeric"
      autoComplete="off"
      placeholder="000.000.000-00"
      maxLength={14}
      {...props}
      format={formatCpf}
      isValid={isValidCpf}
      invalidMessage={BR_MESSAGES.cpf}
    />
  );
}

/** CPF ou CNPJ conforme a quantidade de dígitos (parceiros). */
export function CpfCnpjField(props: MaskedProps) {
  return (
    <MaskedField
      inputMode="numeric"
      autoComplete="off"
      placeholder="00.000.000/0000-00"
      maxLength={18}
      {...props}
      format={formatCpfOrCnpj}
      isValid={isValidCpfOrCnpj}
      invalidMessage={BR_MESSAGES.document}
    />
  );
}

/** CEP `00000-000` (entrega em casa, DT-075). */
export function PostalCodeField(props: MaskedProps) {
  return (
    <MaskedField
      inputMode="numeric"
      autoComplete="postal-code"
      placeholder="00000-000"
      maxLength={9}
      {...props}
      format={(value) => {
        const digits = onlyDigits(value).slice(0, 8);

        return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
      }}
      isValid={(value) => onlyDigits(value).length === 8}
      invalidMessage="CEP deve ter 8 números."
    />
  );
}

/** Telefone `(00) 00000-0000`; `allowLandline` aceita também fixo (PEN-057). */
export function PhoneField({
  allowLandline = false,
  ...props
}: MaskedProps & { readonly allowLandline?: boolean }) {
  return (
    <MaskedField
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder="(00) 00000-0000"
      maxLength={15}
      {...props}
      format={formatPhone}
      isValid={allowLandline ? isValidPhone : isValidMobilePhone}
      invalidMessage={allowLandline ? BR_MESSAGES.phone : BR_MESSAGES.mobile}
    />
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

/** "Limpar filtros (n)": aparece só com algum filtro ativo (docs/29 §3.8). */
export function ClearFilters({
  active,
  onClear
}: {
  readonly active: number;
  readonly onClear: () => void;
}) {
  if (active === 0) {
    return null;
  }

  return (
    <button type="button" className="btn btn-secondary" onClick={onClear}>
      Limpar filtros ({active})
    </button>
  );
}

/** Esqueleto de carregamento com o formato do conteúdo que vai aparecer. */
export function Skeleton({ lines = 3 }: { readonly lines?: number }) {
  return (
    <div className="skeleton" aria-busy="true" role="status" aria-label="Carregando">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="skeleton-line" />
      ))}
    </div>
  );
}
