/** "1 unidade", "3 unidades", "0 unidades": plural por extenso nas mensagens, sem "(s)". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? singular : pluralForm}`;
}
