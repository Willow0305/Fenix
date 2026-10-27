'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

import { api, errorMessage } from '../lib/api-client';
import { Icon } from './icon';

interface SearchHit {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly link: string;
}

interface SearchGroup {
  readonly key: string;
  readonly label: string;
  readonly hits: readonly SearchHit[];
}

const DEBOUNCE_MS = 250;

/**
 * Busca global do painel (DT-057): atletas, pedidos, produtos, parceiros, usuários,
 * interessados, seletivas e notícias de uma vez. Abre com Ctrl+K (⌘K no Mac); setas
 * escolhem, Enter abre. Cada grupo só aparece para quem tem a permissão do módulo.
 */
export function GlobalSearch() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<readonly SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const flat = groups.flatMap((group) => group.hits);

  function open() {
    dialog.current?.showModal();
    input.current?.select();
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const term = query.trim();

    if (term.length < 2) {
      setGroups([]);
      setError(null);

      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api<SearchGroup[]>('/search', { query: { q: term }, signal: controller.signal })
        .then((result) => {
          setGroups(result);
          setActive(0);
          setError(null);
        })
        .catch((caught: unknown) => {
          if (!controller.signal.aborted) {
            setError(errorMessage(caught));
          }
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function go(hit: SearchHit | undefined) {
    if (!hit) {
      return;
    }

    dialog.current?.close();
    setQuery('');
    router.push(hit.link);
  }

  let position = -1;

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={open}
        aria-keyshortcuts="Control+K"
      >
        <Icon name="search" /> <span className="label-sm-hidden">Buscar</span>{' '}
        <kbd className="kbd label-sm-hidden">Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="search-dialog"
        aria-label="Busca no painel"
        onClick={(event) => {
          // Clique fora da caixa fecha.
          if (event.target === dialog.current) {
            dialog.current.close();
          }
        }}
      >
        <div className="search-box">
          <Icon name="search" />
          <input
            ref={input}
            type="search"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
            aria-label="Buscar atleta, pedido, produto, parceiro…"
            placeholder="Buscar atleta, pedido, produto, parceiro…"
            maxLength={80}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => Math.min(value + 1, flat.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => Math.max(value - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                go(flat[active]);
              }
            }}
          />
          <button
            type="button"
            className="btn btn-link"
            onClick={() => dialog.current?.close()}
            aria-label="Fechar busca"
          >
            <Icon name="x-lg" />
          </button>
        </div>
        <div id={listId} role="listbox" aria-label="Resultados" className="search-results">
          {query.trim().length < 2 ? (
            <p className="muted m-0">Digite ao menos 2 letras. Acentos não importam.</p>
          ) : loading && groups.length === 0 ? (
            <p className="muted m-0">Buscando…</p>
          ) : error ? (
            <p className="field-error m-0">{error}</p>
          ) : groups.length === 0 ? (
            <p className="muted m-0">Nada encontrado.</p>
          ) : (
            groups.map((group) => (
              <div key={group.key} role="group" aria-label={group.label}>
                <p className="search-group-label">{group.label}</p>
                {group.hits.map((hit) => {
                  position += 1;
                  const index = position;

                  return (
                    <div
                      key={`${group.key}-${hit.id}`}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      className={`search-hit${index === active ? ' is-active' : ''}`}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(hit)}
                    >
                      <span className="text-break">{hit.title}</span>
                      {hit.subtitle ? <small className="muted">{hit.subtitle}</small> : null}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </dialog>
    </>
  );
}
