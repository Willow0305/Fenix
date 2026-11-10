'use client';

import { useEffect, useState } from 'react';

import { api } from '../lib/api-client';
import type { ForumRules } from '../lib/content-types';
import { useResource } from '../lib/use-resource';
import { ConfirmDialog, SelectField, TextArea, TextField } from './ui';

export interface SanctionTarget {
  readonly userId: string;
  readonly name: string;
  readonly topicId?: string | null;
  readonly postId?: string | null;
}

type Duration = '7' | '30' | 'open';

const DURATIONS: readonly { value: Duration; label: string }[] = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: 'open', label: 'Até a diretoria liberar' }
];

/**
 * Advertir ou suspender quem quebrou uma regra do fórum (DT-108). A pessoa recebe o aviso
 * no site e por e-mail, com a regra e o motivo escritos aqui.
 */
export function ForumSanctionDialog({
  target,
  onClose,
  onDone
}: {
  readonly target: SanctionTarget | null;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const rules = useResource<ForumRules>(target ? '/forum/rules' : null);
  const [kind, setKind] = useState<'WARNING' | 'SUSPENSION'>('WARNING');
  const [duration, setDuration] = useState<Duration>('7');
  const [rule, setRule] = useState('');
  const [reason, setReason] = useState('');

  // Cada pessoa começa do zero: advertência, sem regra nem motivo.
  useEffect(() => {
    if (target) {
      setKind('WARNING');
      setDuration('7');
      setRule('');
      setReason('');
    }
  }, [target]);

  const suspension = kind === 'SUSPENSION';

  return (
    <ConfirmDialog
      open={target !== null}
      title={`Advertir ou suspender ${target?.name ?? ''}`}
      description="A pessoa recebe o aviso no site e por e-mail, com a regra e o motivo. Tudo fica registrado."
      confirmLabel={suspension ? 'Suspender do fórum' : 'Enviar advertência'}
      danger={suspension}
      onClose={onClose}
      onConfirm={async () => {
        if (!target) {
          return;
        }

        await api('/forum/admin/sanctions', {
          method: 'POST',
          body: {
            userId: target.userId,
            kind,
            rule: rule.trim(),
            reason: reason.trim(),
            ...(suspension ? { days: duration === 'open' ? null : Number(duration) } : {}),
            ...(target.topicId ? { topicId: target.topicId } : {}),
            ...(target.postId ? { postId: target.postId } : {})
          }
        });
        onDone(
          suspension
            ? `${target.name} foi suspenso do fórum e recebeu o aviso.`
            : `${target.name} recebeu a advertência.`
        );
      }}
    >
      <fieldset className="form-section stack gap-sm">
        <legend>O que fazer</legend>
        <label className="checkbox">
          <input
            type="radio"
            name="sancao"
            checked={!suspension}
            onChange={() => setKind('WARNING')}
          />
          <span>
            <strong>Advertir.</strong> Avisa que quebrou uma regra; continua participando.
          </span>
        </label>
        <label className="checkbox">
          <input
            type="radio"
            name="sancao"
            checked={suspension}
            onChange={() => setKind('SUSPENSION')}
          />
          <span>
            <strong>Suspender.</strong> Continua lendo, mas não publica, responde, edita nem reage.
          </span>
        </label>
      </fieldset>
      {suspension ? (
        <SelectField
          label="Por quanto tempo"
          value={duration}
          onChange={(event) => setDuration(event.target.value as Duration)}
          options={DURATIONS}
        />
      ) : null}
      <TextField
        label="Regra quebrada"
        hint="Escolha uma das regras do fórum ou escreva outra."
        required
        minLength={2}
        maxLength={160}
        list="regras-forum"
        value={rule}
        onChange={(event) => setRule(event.target.value)}
      />
      <datalist id="regras-forum">
        {(rules.data?.titles ?? []).map((title) => (
          <option key={title} value={title} />
        ))}
      </datalist>
      <TextArea
        label="Motivo"
        hint="Aparece para a pessoa. Diga o que aconteceu, com 10 a 1.000 caracteres."
        required
        minLength={10}
        maxLength={1000}
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </ConfirmDialog>
  );
}
