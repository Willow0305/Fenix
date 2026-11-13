'use client';

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface EditableCopy<F> {
  readonly form: F | null;
  readonly setForm: Dispatch<SetStateAction<F | null>>;
  /** Os dados mudaram (outra pessoa, outra aba) enquanto havia edição não salva. */
  readonly stale: boolean;
  /** Troca o que está no formulário pela versão atual dos dados. */
  readonly discard: () => void;
  /** Logo depois de descartar: dá para trazer de volta o que tinha sido digitado. */
  readonly canUndo: boolean;
  /** Devolve ao formulário o que foi descartado (e volta a avisar da versão nova). */
  readonly undo: () => void;
}

/**
 * Formulário de edição preenchido com dados que se atualizam sozinhos (DT-116). Sem edição
 * pendente, acompanha a versão mais nova. Com edição pendente, nunca apaga o que a pessoa
 * digitou: guarda a versão nova e marca `stale`, para a tela avisar e oferecer a troca. A
 * troca pode ser desfeita até a pessoa voltar a editar.
 */
export function useEditableCopy<T, F>(data: T | null, toForm: (data: T) => F): EditableCopy<F> {
  const [form, setForm] = useState<F | null>(null);
  const [stale, setStale] = useState(false);
  // O que estava digitado antes de descartar, para o "Desfazer".
  const [discarded, setDiscarded] = useState<F | null>(null);
  // Formulário atual, última versão vinda dos dados e versão nova guardada durante a edição.
  const current = useRef<F | null>(null);
  const seed = useRef<F | null>(null);
  const pending = useRef<F | null>(null);
  const convert = useRef(toForm);

  useEffect(() => {
    current.current = form;
    convert.current = toForm;
  });

  useEffect(() => {
    if (data === null) {
      return;
    }

    const next = convert.current(data);
    const editing = current.current;

    if (editing === null || same(editing, seed.current) || same(editing, next)) {
      seed.current = next;
      pending.current = null;
      current.current = next;
      setStale(false);
      setForm(next);
    } else if (!same(next, seed.current)) {
      pending.current = next;
      setStale(true);
    }
  }, [data]);

  const discard = useCallback(() => {
    const next = pending.current ?? seed.current;

    setDiscarded(current.current);
    seed.current = next;
    pending.current = null;
    current.current = next;
    setStale(false);
    setForm(next);
  }, []);

  const undo = useCallback(() => {
    if (discarded === null) {
      return;
    }

    // As edições voltam; a versão atual continua guardada, e o aviso também volta.
    pending.current = seed.current;
    current.current = discarded;
    setDiscarded(null);
    setStale(true);
    setForm(discarded);
  }, [discarded]);

  // Voltar a editar encerra o "Desfazer".
  const edit = useCallback<Dispatch<SetStateAction<F | null>>>((value) => {
    setDiscarded(null);
    setForm(value);
  }, []);

  return { form, setForm: edit, stale, discard, canUndo: discarded !== null, undo };
}
