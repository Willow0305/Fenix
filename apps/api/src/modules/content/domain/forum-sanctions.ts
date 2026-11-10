/**
 * Advertências e suspensões do fórum (DT-108). Regras puras: prazo, se ainda vale e o texto
 * inicial das regras, que a diretoria edita no painel.
 */

/** Prazos que a diretoria escolhe; `null` = até a diretoria liberar. */
export const SUSPENSION_DAYS = [7, 30] as const;
export type SuspensionDays = (typeof SUSPENSION_DAYS)[number];

export const RULE_MAX = 160;
export const REASON_MIN = 10;
export const REASON_MAX = 1000;
export const RULES_MAX = 20_000;

export interface SanctionState {
  readonly kind: 'WARNING' | 'SUSPENSION';
  readonly endsAt: Date | null;
  readonly liftedAt: Date | null;
}

/** Fim da suspensão: agora + dias, ou `null` quando vale até a diretoria liberar. */
export function suspensionEnd(now: Date, days: SuspensionDays | null): Date | null {
  return days === null ? null : new Date(now.getTime() + days * 86_400_000);
}

/** Suspensão em vigor: não liberada e sem prazo, ou com o prazo ainda por vir. */
export function isActiveSuspension(row: SanctionState, now: Date): boolean {
  return (
    row.kind === 'SUSPENSION' &&
    row.liftedAt === null &&
    (row.endsAt === null || row.endsAt.getTime() > now.getTime())
  );
}

/**
 * De várias suspensões em vigor, a que dura mais: sem prazo vence qualquer prazo; entre
 * prazos, o mais distante.
 */
export function longestSuspension<T extends SanctionState>(
  rows: readonly T[],
  now: Date
): T | null {
  const active = rows.filter((row) => isActiveSuspension(row, now));

  if (active.length === 0) {
    return null;
  }

  return active.reduce((best, row) => {
    if (best.endsAt === null) {
      return best;
    }

    if (row.endsAt === null) {
      return row;
    }

    return row.endsAt.getTime() > best.endsAt.getTime() ? row : best;
  });
}

/** Linhas numeradas das regras ("1. …"), sugeridas como "regra quebrada" na advertência. */
export function ruleTitles(rules: string): string[] {
  return rules
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]\s+\S/.test(line))
    .map(
      (line) =>
        line
          .replace(/^\d+[.)]\s+/, '')
          .split(/[:.]/)[0]
          ?.trim() ?? ''
    )
    .filter((title) => title.length > 0)
    .map((title) => title.slice(0, RULE_MAX));
}

/**
 * Texto inicial das regras, até a diretoria escrever o seu (DT-108). Pede revisão da
 * diretoria antes do uso real (PENDENCIAS).
 */
export const DEFAULT_FORUM_RULES = `O fórum do Fênix Vôlei é um espaço para atletas, famílias e torcida conversarem sobre o time e o vôlei. Para continuar assim, valem estas regras:

1. Respeito: sem ofensas, xingamentos, ameaças ou provocações contra qualquer pessoa.
2. Sem discriminação: nenhuma mensagem contra raça, cor, gênero, orientação sexual, religião, origem, idade ou deficiência.
3. Privacidade: não publique dados pessoais de outras pessoas (telefone, endereço, documentos, fotos sem autorização).
4. Menores de idade: nenhuma mensagem que exponha ou constranja crianças e adolescentes.
5. Assunto: fale sobre o time, o vôlei e a comunidade; sem propaganda, correntes ou golpes.
6. Verdade: não espalhe boatos nem informações falsas sobre o time, atletas ou a diretoria.

Quem quebra uma regra recebe uma advertência. Se continuar, pode ficar suspenso do fórum por 7 dias, 30 dias ou até a diretoria liberar. Durante a suspensão, a pessoa lê o fórum, mas não publica, responde, edita nem reage. Mensagens que quebram as regras podem ser ocultadas ou removidas.

Viu algo errado? Use "Denunciar" na mensagem: a diretoria analisa.`;
