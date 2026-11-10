import type { AccountabilityContent, Signatory } from './accountability';

/**
 * O que fica congelado na prestação de contas emitida (DT-103). O hash é calculado sobre
 * este objeto em JSON canônico; mudar qualquer campo muda o código de conferência.
 */
export interface AccountabilitySnapshot {
  readonly format: 1;
  readonly number: string;
  readonly revision: number;
  readonly team: { readonly name: string; readonly officialName: string };
  readonly issuedAt: string;
  readonly issuedBy: Signatory;
  readonly replaces: { readonly revision: number; readonly reason: string } | null;
  readonly content: AccountabilityContent;
  readonly notes: string | null;
  readonly signatories: readonly Signatory[];
}
