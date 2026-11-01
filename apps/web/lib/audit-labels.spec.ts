import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  AUDIT_ACTION_LABELS,
  auditActionLabel,
  auditActionOptions,
  auditEntityLabel
} from './audit-labels';

/** Arquivos `.ts` do código da API (sem testes nem cliente gerado). */
function apiSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) {
      return name === 'generated' ? [] : apiSources(path);
    }

    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('auditoria em português (DT-097)', () => {
  it('traduz ações e entidades conhecidas', () => {
    expect(auditActionLabel('order.created')).toBe('Pedido criado');
    expect(auditActionLabel('auth.login.failed')).toBe('Tentativa de entrada recusada');
    expect(auditEntityLabel('Order')).toBe('Pedido');
    expect(auditEntityLabel('User')).toBe('Conta');
  });

  it('ação nova sem tradução ganha um texto montado; desconhecida mostra o código', () => {
    expect(auditActionLabel('order.algo.created')).toBe('Pedido: criado');
    expect(auditActionLabel('coisa.estranha')).toBe('coisa.estranha');
    expect(auditEntityLabel('Desconhecida')).toBe('Desconhecida');
  });

  it('o filtro lista as ações em ordem alfabética do texto', () => {
    const labels = auditActionOptions().map((option) => option.label);

    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });

  it('toda ação gravada pela API tem tradução', () => {
    const sources = apiSources(join(__dirname, '..', '..', 'api', 'src'));
    const actions = new Set<string>();

    for (const file of sources) {
      const text = readFileSync(file, 'utf8');

      // `action: 'x.y'` e os dois lados de `action: cond ? 'x.y' : 'x.z'`.
      for (const match of text.matchAll(
        /action:\s*(?:[^'`\n,]*\?\s*)?'([a-z_]+\.[a-z_.]+)'(?:\s*:\s*'([a-z_]+\.[a-z_.]+)')?/g
      )) {
        actions.add(match[1] as string);

        if (match[2]) {
          actions.add(match[2]);
        }
      }
    }

    expect(actions.size).toBeGreaterThan(150);
    expect([...actions].filter((action) => !AUDIT_ACTION_LABELS[action])).toEqual([]);
  });
});
