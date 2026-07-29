'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useAdminSession } from '../../admin-shell';
import { Feedback, CollectionState, SportsPageHeader, StatusBadge } from '../_components/sports-ui';
import {
  type CategoryRecord,
  createSportsRecord,
  getRequestErrorMessage,
  listSportsRecords
} from '../_lib/sports-api';
import styles from '../esportivo.module.scss';

type CategoryKind = CategoryRecord['kind'];

const CATEGORY_KIND_LABELS: Readonly<Record<CategoryKind, string>> = {
  AGE_GROUP: 'Faixa etária',
  DIVISION: 'Divisão',
  GENDER: 'Gênero esportivo',
  LEVEL: 'Nível',
  OTHER: 'Outra'
};

export default function CategoriesPage() {
  const session = useAdminSession();
  const canManage = session.permissions.includes('categories.manage');
  const [categories, setCategories] = useState<readonly CategoryRecord[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('AGE_GROUP');
  const [minimumAge, setMinimumAge] = useState('');
  const [maximumAge, setMaximumAge] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await listSportsRecords<CategoryRecord>('/categories');
      setCategories(response.data);
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Não foi possível carregar as categorias.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      await createSportsRecord<CategoryRecord>('/categories', {
        name: name.trim(),
        kind,
        minimumAge: kind === 'AGE_GROUP' && minimumAge ? Number(minimumAge) : null,
        maximumAge: kind === 'AGE_GROUP' && maximumAge ? Number(maximumAge) : null
      });
      setName('');
      setMinimumAge('');
      setMaximumAge('');
      setNotice('Categoria criada. A operação foi enviada para auditoria no servidor.');
      await load();
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Não foi possível criar a categoria.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SportsPageHeader
        description="Classificações reutilizáveis para organizar equipes e preservar seus vínculos ao longo do tempo."
        eyebrow="Estrutura esportiva"
        title="Categorias"
      />

      {canManage ? (
        <section className={styles.panel} aria-labelledby="create-category-title">
          <div className={styles.panelHeader}>
            <h2 id="create-category-title">Nova categoria</h2>
          </div>
          <form className={styles.formGrid} onSubmit={createCategory}>
            <label className={styles.field}>
              Nome
              <input
                maxLength={120}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label className={styles.field}>
              Tipo
              <select
                onChange={(event) => setKind(event.target.value as CategoryKind)}
                value={kind}
              >
                {Object.entries(CATEGORY_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                Idade mínima
                <input
                  disabled={kind !== 'AGE_GROUP'}
                  max={120}
                  min={0}
                  onChange={(event) => setMinimumAge(event.target.value)}
                  type="number"
                  value={minimumAge}
                />
              </label>
              <label className={styles.field}>
                Idade máxima
                <input
                  disabled={kind !== 'AGE_GROUP'}
                  max={120}
                  min={0}
                  onChange={(event) => setMaximumAge(event.target.value)}
                  type="number"
                  value={maximumAge}
                />
              </label>
            </div>
            <button className={styles.button} disabled={submitting} type="submit">
              {submitting ? 'Criando…' : 'Criar categoria'}
            </button>
          </form>
        </section>
      ) : null}

      <Feedback error={error} notice={notice} />

      <section className={styles.panel} aria-labelledby="category-list-title">
        <div className={styles.panelHeader}>
          <h2 id="category-list-title">Categorias cadastradas</h2>
          <button className={styles.secondaryButton} onClick={() => void load()} type="button">
            Atualizar
          </button>
        </div>
        <CollectionState
          emptyMessage="Nenhuma categoria fictícia foi cadastrada neste ambiente."
          isEmpty={categories.length === 0}
          loading={loading}
        >
          <div className={styles.recordGrid}>
            {categories.map((category) => (
              <article className={styles.recordCard} key={category.id}>
                <div className={styles.cardHeader}>
                  <h3>{category.name}</h3>
                  <StatusBadge value={category.isActive ? 'Ativa' : 'Inativa'} />
                </div>
                <dl className={styles.metaList}>
                  <dt>Tipo</dt>
                  <dd>{CATEGORY_KIND_LABELS[category.kind]}</dd>
                  <dt>Faixa etária</dt>
                  <dd>
                    {category.minimumAge === null && category.maximumAge === null
                      ? 'Não aplicável'
                      : `${category.minimumAge ?? '—'} a ${category.maximumAge ?? '—'} anos`}
                  </dd>
                  <dt>Equipes</dt>
                  <dd>{category.teamsCount ?? 'Não informado'}</dd>
                </dl>
              </article>
            ))}
          </div>
        </CollectionState>
      </section>
    </>
  );
}
