'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from '../../../../components/icon';
import {
  Alert,
  ConfirmDialog,
  Empty,
  ErrorSummary,
  PageHeader,
  Pagination,
  Skeleton,
  TextArea,
  TextField,
  useSubmit
} from '../../../../components/ui';
import {
  type AccountabilityDetail,
  type AccountabilityPreview,
  type AccountabilityRow,
  PERIOD_SHORTCUTS,
  periodFor
} from '../../../../lib/accountability-types';
import { api, apiBlob } from '../../../../lib/api-client';
import type { Page } from '../../../../lib/api-types';
import { useAuth } from '../../../../lib/auth-context';
import { formatDate, formatDateTime, formatMoney, todayCivil } from '../../../../lib/format';
import { useIdempotencyKey } from '../../../../lib/idempotency';
import { useResource } from '../../../../lib/use-resource';

function fileName(row: Pick<AccountabilityRow, 'number' | 'revision'>): string {
  return `prestacao-de-contas-${row.number}${row.revision > 1 ? `-v${row.revision}` : ''}.pdf`;
}

function label(row: Pick<AccountabilityRow, 'number' | 'revision'>): string {
  return `${row.number}${row.revision > 1 ? ` (versão ${row.revision})` : ''}`;
}

async function pdfFile(row: AccountabilityRow): Promise<File> {
  const blob = await apiBlob(`/accountability-reports/${row.id}/pdf`);

  return new File([blob], fileName(row), { type: 'application/pdf' });
}

/** Compartilhar o arquivo (WhatsApp e outros) só onde o navegador sabe mandar arquivos. */
function canShareFiles(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({
        files: [new File([''], 'teste.pdf', { type: 'application/pdf' })]
      })
    );
  } catch {
    return false;
  }
}

function DocumentActions({
  row,
  onCorrect
}: {
  readonly row: AccountabilityRow;
  readonly onCorrect: ((row: AccountabilityRow) => void) | null;
}) {
  const [shareable, setShareable] = useState(false);
  const download = useSubmit(async () => {
    const file = await pdfFile(row);
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');

    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
  const share = useSubmit(async () => {
    const file = await pdfFile(row);

    try {
      await navigator.share({
        files: [file],
        title: `Prestação de contas ${label(row)}`,
        text: `Prestação de contas ${label(row)}, período de ${formatDate(row.periodStart)} a ${formatDate(row.periodEnd)}. Código de conferência ${row.verificationCode}.`
      });
    } catch (error) {
      // Fechar a janela de compartilhar não é erro.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        throw error;
      }
    }
  });

  useEffect(() => setShareable(canShareFiles()), []);

  return (
    <div className="stack gap-xs">
      <div className="row">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={download.pending}
          onClick={() => void download.submit()}
        >
          <Icon name="file-earmark-pdf" /> {download.pending ? 'Gerando…' : 'Baixar PDF'}
        </button>
        {shareable ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={share.pending}
            onClick={() => void share.submit()}
          >
            <Icon name="share" /> Compartilhar
          </button>
        ) : null}
        {onCorrect && row.status === 'ISSUED' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCorrect(row)}>
            <Icon name="pencil" /> Corrigir
          </button>
        ) : null}
      </div>
      <ErrorSummary error={download.error ?? share.error} />
    </div>
  );
}

function Money({ value }: { readonly value: { amount: string; currency: string } }) {
  return <>{formatMoney(value.amount, value.currency)}</>;
}

/** Prévia, escolhas da diretoria e emissão (ou correção de uma versão emitida). */
function IssueForm({
  correcting,
  onCancelCorrection,
  onIssued
}: {
  readonly correcting: AccountabilityRow | null;
  readonly onCancelCorrection: () => void;
  readonly onIssued: (issued: AccountabilityDetail) => void;
}) {
  const idem = useIdempotencyKey();
  const lastMonth = periodFor('last-month', todayCivil());
  const [period, setPeriod] = useState(lastMonth);
  const [preview, setPreview] = useState<AccountabilityPreview | null>(null);
  const [details, setDetails] = useState<Set<string>>(new Set());
  const [signatories, setSignatories] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const load = useSubmit(async () => {
    const result = await api<AccountabilityPreview>('/accountability-reports/preview', {
      method: 'POST',
      body: { from: period.from, to: period.to }
    });

    setPreview(result);
    setDetails(new Set());
    setSignatories(new Set(result.boardMembers.map((member) => member.userId)));
  });

  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (correcting) {
      setPeriod({ from: correcting.periodStart, to: correcting.periodEnd });
      setPreview(null);
      // O foco vai para o título "Corrigir…": a página chega até ele sem animação e o leitor
      // de tela anuncia a troca do formulário.
      heading.current?.focus();
    }
  }, [correcting]);

  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);

    if (on) {
      next.add(id);
    } else {
      next.delete(id);
    }

    return next;
  };
  const content = preview?.content;
  const candidates = new Map(
    (preview?.expenseCandidates ?? []).map((item) => [item.transactionId, item])
  );

  return (
    <section className="card stack" aria-labelledby="nova-prestacao">
      <h2 id="nova-prestacao" ref={heading} tabIndex={-1}>
        {correcting ? `Corrigir ${label(correcting)}` : 'Nova prestação de contas'}
      </h2>
      {correcting ? (
        <Alert kind="info">
          A versão corrigida mantém o número {correcting.number} e substitui a anterior, que
          continua guardada como "Substituída".{' '}
          <button type="button" className="btn btn-link" onClick={onCancelCorrection}>
            Cancelar correção
          </button>
        </Alert>
      ) : null}
      <form className="form stack" onSubmit={(event) => void load.submit(event)}>
        <div className="row" role="group" aria-label="Atalhos de período">
          {PERIOD_SHORTCUTS.map((shortcut) => (
            <button
              key={shortcut.value}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setPeriod(periodFor(shortcut.value, todayCivil()));
                setPreview(null);
              }}
            >
              {shortcut.label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <TextField
            label="De"
            type="date"
            required
            value={period.from}
            onChange={(event) => {
              setPeriod({ ...period, from: event.target.value });
              setPreview(null);
            }}
            error={load.fieldError('from')}
          />
          <TextField
            label="Até"
            type="date"
            required
            value={period.to}
            onChange={(event) => {
              setPeriod({ ...period, to: event.target.value });
              setPreview(null);
            }}
            error={load.fieldError('to')}
          />
        </div>
        <ErrorSummary error={load.error} />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={load.pending}>
            {load.pending ? 'Calculando…' : 'Ver prévia'}
          </button>
        </div>
      </form>

      {preview && content ? (
        // Formulário próprio: o navegador confere o motivo da correção ao clicar em Emitir.
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            setConfirming(true);
          }}
        >
          {preview.problems.length > 0 ? (
            <Alert kind="error">
              Os números não fecham: {preview.problems.join(' ')} Fale com o administrador antes de
              emitir.
            </Alert>
          ) : null}
          {preview.unclosedAccounts > 0 ? (
            <Alert kind="info">
              {preview.unclosedAccounts === 1
                ? 'Uma conta ainda não tem fechamento de caixa até o fim do período'
                : `${preview.unclosedAccounts} contas ainda não têm fechamento de caixa até o fim do período`}
              : lançamentos podem mudar depois. O documento emitido fica congelado como está agora.
            </Alert>
          ) : null}

          <h3 className="m-0">Resumo</h3>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr>
                  <th scope="row">Saldo no início</th>
                  <td className="num">
                    <Money value={content.openingBalance} />
                  </td>
                </tr>
                {content.openingEntries.amount !== '0.00' ? (
                  <tr>
                    <th scope="row">Saldo inicial de conta nova</th>
                    <td className="num">
                      <Money value={content.openingEntries} />
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <th scope="row">(+) Entradas</th>
                  <td className="num">
                    <Money value={content.income.total} />
                  </td>
                </tr>
                <tr>
                  <th scope="row">(–) Saídas</th>
                  <td className="num">
                    <Money value={content.expense.total} />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Saldo no fim</th>
                  <td className="num">
                    <strong>
                      <Money value={content.closingBalance} />
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="m-0">Entradas por categoria</h3>
          <p className="muted m-0">Somadas, sem nome de quem pagou.</p>
          {content.income.byCategory.length === 0 ? (
            <p className="muted m-0">Nenhuma entrada no período.</p>
          ) : (
            <ul className="stack gap-xs">
              {content.income.byCategory.map((item) => (
                <li key={item.category} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{item.category}</span>
                  <span className="tabular-nums">
                    <Money value={item.total} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <fieldset className="form-section stack gap-sm">
            <legend>Saídas</legend>
            <p className="muted m-0">
              Cada saída aparece com data, categoria e valor. Marque as que podem mostrar a
              descrição do Caixa, que pode ter o nome de quem recebeu (treinador, ajudante).
            </p>
            {content.expense.lines.length === 0 ? (
              <p className="muted m-0">Nenhuma saída lançada pela diretoria no período.</p>
            ) : (
              content.expense.lines.map((line) => {
                const candidate = candidates.get(line.transactionId);

                return (
                  <label key={line.transactionId} className="checkbox">
                    <input
                      type="checkbox"
                      checked={details.has(line.transactionId)}
                      onChange={(event) =>
                        setDetails(toggle(details, line.transactionId, event.target.checked))
                      }
                    />
                    <span>
                      <strong>
                        {formatDate(line.date)} · {line.category} · <Money value={line.amount} />
                      </strong>
                      <br />
                      <span className="muted">
                        Mostrar no documento: {candidate?.description || 'sem descrição'}
                        {candidate?.counterpartyName
                          ? ` · Recebido por ${candidate.counterpartyName}`
                          : ''}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
            {content.expense.refunds.length > 0 ? (
              <p className="muted m-0">
                Estornos e devoluções a compradores e atletas entram somados, sem nomes:{' '}
                {content.expense.refunds
                  .map((item) => `${item.category} ${formatMoney(item.total.amount)}`)
                  .join('; ')}
                .
              </p>
            ) : null}
          </fieldset>

          <fieldset className="form-section stack gap-sm">
            <legend>Assinaturas</legend>
            {preview.boardMembers.length === 0 ? (
              <p className="muted m-0">Ninguém tem o papel Diretoria agora.</p>
            ) : (
              preview.boardMembers.map((member) => (
                <label key={member.userId} className="checkbox">
                  <input
                    type="checkbox"
                    checked={signatories.has(member.userId)}
                    onChange={(event) =>
                      setSignatories(toggle(signatories, member.userId, event.target.checked))
                    }
                  />
                  <span>
                    {member.name}
                    {member.position ? ` · ${member.position}` : ' · sem cargo definido'}
                  </span>
                </label>
              ))
            )}
          </fieldset>

          <TextArea
            label="Observações da diretoria (opcional)"
            maxLength={4000}
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          {correcting ? (
            <TextArea
              label="O que foi corrigido"
              hint="Aparece no documento novo. Pelo menos 10 caracteres."
              required
              minLength={10}
              maxLength={1000}
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          ) : null}
          <div className="form-actions">
            {/* Números que não fecham bloqueiam a emissão; o motivo está no aviso acima. */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={preview.problems.length > 0}
            >
              {correcting ? 'Emitir versão corrigida' : 'Emitir prestação de contas'}
            </button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={
          correcting ? `Emitir correção de ${correcting.number}?` : 'Emitir a prestação de contas?'
        }
        description={`Período de ${formatDate(period.from)} a ${formatDate(period.to)}. Depois de emitida, ela não muda: uma correção vira nova versão, e a anterior continua guardada.`}
        confirmLabel="Emitir"
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          const issued = await api<AccountabilityDetail>('/accountability-reports', {
            method: 'POST',
            headers: idem.headers(),
            body: {
              from: period.from,
              to: period.to,
              showDetailFor: [...details],
              signatoryUserIds: [...signatories],
              ...(notes.trim() ? { notes: notes.trim() } : {}),
              ...(correcting ? { replacesId: correcting.id, replacementReason: reason.trim() } : {})
            }
          });

          idem.rotate();
          setPreview(null);
          setNotes('');
          setReason('');
          onIssued(issued);
        }}
      />
    </section>
  );
}

/** Confere um código impresso no PDF (rodapé). */
function VerifyCode() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ found: AccountabilityRow | null } | null>(null);
  const check = useSubmit(async () => {
    setResult(
      await api<{ found: AccountabilityRow | null }>(
        `/accountability-reports/verify/${encodeURIComponent(code.trim())}`
      )
    );
  });

  return (
    <form className="card stack gap-sm" onSubmit={(event) => void check.submit(event)}>
      <h2 className="list-title">Conferir um documento</h2>
      <p className="muted m-0">
        Recebeu um PDF e quer saber se é o original? Digite o código de conferência do rodapé.
      </p>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <TextField
          label="Código de conferência"
          placeholder="1A2B-3C4D-5E6F"
          maxLength={20}
          required
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setResult(null);
          }}
        />
        <button type="submit" className="btn btn-secondary btn-sm" disabled={check.pending}>
          Conferir
        </button>
      </div>
      <ErrorSummary error={check.error} />
      {result ? (
        result.found ? (
          <Alert kind={result.found.status === 'ISSUED' ? 'success' : 'warning'}>
            Documento {label(result.found)}, período de {formatDate(result.found.periodStart)} a{' '}
            {formatDate(result.found.periodEnd)}, emitido em {formatDateTime(result.found.issuedAt)}
            .{' '}
            {result.found.status === 'ISSUED'
              ? 'É a versão em vigor.'
              : 'Esta versão foi substituída por uma correção: peça a versão nova.'}
          </Alert>
        ) : (
          <Alert kind="error">
            Nenhum documento com esse código. O PDF pode ter sido alterado ou o código foi digitado
            errado.
          </Alert>
        )
      ) : null}
    </form>
  );
}

/**
 * Prestação de contas (DT-103): documento da diretoria para a diretoria e os atletas, fora do
 * site. Emitido, fica congelado com código de conferência; baixa em PDF para imprimir e
 * mandar nos grupos de WhatsApp.
 */
export default function AccountabilityPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const list = useResource<Page<AccountabilityRow>>('/accountability-reports', {
    page,
    pageSize: 20
  });
  const [correcting, setCorrecting] = useState<AccountabilityRow | null>(null);
  const [issued, setIssued] = useState<AccountabilityDetail | null>(null);
  const canIssue = can('accountability.issue');
  const issuedNotice = useRef<HTMLDivElement>(null);

  // Emitida: o botão que abriu a confirmação some, então o foco vai para o aviso, no topo.
  useEffect(() => {
    if (issued) {
      const frame = window.requestAnimationFrame(() => issuedNotice.current?.focus());

      return () => window.cancelAnimationFrame(frame);
    }

    return undefined;
  }, [issued]);

  return (
    <>
      <PageHeader
        title="Prestação de contas"
        description="Documento com o que entrou e saiu do Caixa num período, para a diretoria e os atletas. Não aparece no site."
      />
      {issued ? (
        <div ref={issuedNotice} tabIndex={-1}>
          <Alert kind="success">
            Prestação de contas {label(issued)} emitida. Código de conferência{' '}
            <strong>{issued.verificationCode}</strong>.
            <div style={{ marginTop: '0.5rem' }}>
              <DocumentActions row={issued} onCorrect={null} />
            </div>
          </Alert>
        </div>
      ) : null}

      {canIssue ? (
        <IssueForm
          correcting={correcting}
          onCancelCorrection={() => setCorrecting(null)}
          onIssued={(created) => {
            setIssued(created);
            setCorrecting(null);
            void list.reload();
          }}
        />
      ) : null}

      <section className="stack" aria-labelledby="emitidas">
        <h2 id="emitidas" className="list-title">
          Emitidas
        </h2>
        {list.error ? <Alert kind="error">{list.error}</Alert> : null}
        {!list.data && !list.error ? <Skeleton lines={3} /> : null}
        {list.data && list.data.data.length === 0 ? (
          <Empty>
            Nenhuma prestação de contas emitida ainda.
            {canIssue ? ' Escolha o período acima e veja a prévia.' : ''}
          </Empty>
        ) : null}
        {list.data && list.data.data.length > 0 ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th scope="col">Documento</th>
                  <th scope="col">Período</th>
                  <th scope="col">Saldo no fim</th>
                  <th scope="col">Emitida</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Documento">
                      <strong>{label(row)}</strong>{' '}
                      <span className={`badge ${row.status === 'ISSUED' ? 'badge-success' : ''}`}>
                        {row.status === 'ISSUED' ? 'Em vigor' : 'Substituída'}
                      </span>
                      <br />
                      <span className="muted">
                        Código <span style={{ whiteSpace: 'nowrap' }}>{row.verificationCode}</span>
                      </span>
                    </td>
                    <td data-label="Período">
                      {formatDate(row.periodStart)} a {formatDate(row.periodEnd)}
                    </td>
                    <td data-label="Saldo no fim" className="num">
                      {formatMoney(row.closingBalance)}
                    </td>
                    <td data-label="Emitida">
                      {formatDateTime(row.issuedAt)}
                      {row.issuedBy ? (
                        <>
                          <br />
                          <span className="muted">por {row.issuedBy}</span>
                        </>
                      ) : null}
                    </td>
                    <td data-label="Ações">
                      <DocumentActions
                        row={row}
                        onCorrect={
                          canIssue
                            ? (selected) => {
                                setIssued(null);
                                setCorrecting(selected);
                              }
                            : null
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {list.data ? (
          <Pagination {...list.data.meta} onChange={setPage} noun={['documento', 'documentos']} />
        ) : null}
      </section>

      <VerifyCode />
    </>
  );
}
