'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useAdminSession } from '../../admin-shell';
import styles from '../../esportivo/esportivo.module.scss';
import { createFinanceRecord, getFinanceError, listFinanceRecords } from '../_lib/finance-api';
import { CollectionState, Feedback, FinancePageHeader, StatusBadge } from './finance-ui';

type CatalogKind = 'accounts' | 'categories' | 'cost-centers';

interface CatalogRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type?: string;
  readonly currency?: string;
  readonly isActive: boolean;
}

const CONFIG: Readonly<
  Record<
    CatalogKind,
    {
      readonly title: string;
      readonly description: string;
      readonly singular: string;
      readonly types?: readonly { readonly value: string; readonly label: string }[];
    }
  >
> = {
  accounts: {
    title: 'Contas financeiras',
    description: 'Fontes e destinos do razão; o saldo é sempre derivado das movimentações.',
    singular: 'conta',
    types: [
      { value: 'CASH', label: 'Caixa físico' },
      { value: 'BANK', label: 'Conta bancária' },
      { value: 'DIGITAL_WALLET', label: 'Carteira digital' },
      { value: 'OTHER', label: 'Outra' }
    ]
  },
  categories: {
    title: 'Categorias financeiras',
    description: 'Classifique entradas e saídas sem misturar transferências internas.',
    singular: 'categoria',
    types: [
      { value: 'INCOME', label: 'Entrada' },
      { value: 'EXPENSE', label: 'Saída' }
    ]
  },
  'cost-centers': {
    title: 'Centros de custo',
    description: 'Organize a finalidade dos lançamentos e obrigações do clube.',
    singular: 'centro de custo'
  }
};

export function CatalogManager({ kind }: { readonly kind: CatalogKind }) {
  const session = useAdminSession();
  const config = CONFIG[kind];
  const canManage = session.permissions.includes('finance.catalogs.manage');
  const [records, setRecords] = useState<readonly CatalogRecord[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState(config.types?.[0]?.value ?? '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setRecords((await listFinanceRecords<CatalogRecord>(`/${kind}`)).data);
    } catch (requestError) {
      setError(getFinanceError(requestError, `Não foi possível carregar ${config.title}.`));
    } finally {
      setLoading(false);
    }
  }, [config.title, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      await createFinanceRecord<CatalogRecord>(`/${kind}`, {
        code: code.trim().toLocaleUpperCase('pt-BR'),
        name: name.trim(),
        ...(config.types ? { type } : {})
      });
      setCode('');
      setName('');
      setNotice(`${config.singular} criado com auditoria no servidor.`);
      await load();
    } catch (requestError) {
      setError(getFinanceError(requestError, `Não foi possível criar ${config.singular}.`));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <FinancePageHeader description={config.description} title={config.title} />

      {canManage ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Novo {config.singular}</h2>
          </div>
          <form className={styles.formGrid} onSubmit={submit}>
            <label className={styles.field}>
              Código
              <input
                maxLength={50}
                onChange={(event) => setCode(event.target.value)}
                pattern="[A-Za-z0-9_]+"
                required
                value={code}
              />
            </label>
            <label className={styles.field}>
              Nome
              <input
                maxLength={140}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            {config.types ? (
              <label className={styles.field}>
                Tipo
                <select onChange={(event) => setType(event.target.value)} value={type}>
                  {config.types.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button className={styles.button} disabled={submitting} type="submit">
              {submitting ? 'Salvando…' : 'Criar'}
            </button>
          </form>
        </section>
      ) : null}

      <Feedback error={error} notice={notice} />
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Registros ativos</h2>
          <button className={styles.secondaryButton} onClick={() => void load()} type="button">
            Atualizar
          </button>
        </div>
        <CollectionState isEmpty={records.length === 0} loading={loading}>
          <div className={styles.recordGrid}>
            {records.map((record) => (
              <article className={styles.recordCard} key={record.id}>
                <div className={styles.cardHeader}>
                  <h3>{record.name}</h3>
                  <StatusBadge>{record.isActive ? 'Ativo' : 'Inativo'}</StatusBadge>
                </div>
                <dl className={styles.metaList}>
                  <dt>Código</dt>
                  <dd>{record.code}</dd>
                  {record.type ? (
                    <>
                      <dt>Tipo</dt>
                      <dd>{record.type}</dd>
                    </>
                  ) : null}
                  {record.currency ? (
                    <>
                      <dt>Moeda</dt>
                      <dd>{record.currency}</dd>
                    </>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        </CollectionState>
      </section>
    </>
  );
}
