/**
 * Opções de equipe nas listas do painel (docs/29 §3.9, COR-008):
 * - `pick` (criar ou vincular): só equipes ativas, mais a que o registro já usa, marcada;
 * - `filter` (consultar): ativas primeiro, inativas depois com "(inativa)".
 */
export function teamOptions(
  teams: readonly { id: string; name: string; isActive?: boolean }[],
  mode: 'pick' | 'filter',
  keepId?: string | null
): { value: string; label: string }[] {
  const active = teams.filter((team) => team.isActive !== false);
  const inactive = teams.filter((team) => team.isActive === false);
  const label = (team: { name: string }) => `${team.name} (inativa)`;

  if (mode === 'filter') {
    return [
      ...active.map((team) => ({ value: team.id, label: team.name })),
      ...inactive.map((team) => ({ value: team.id, label: label(team) }))
    ];
  }

  const kept = inactive.find((team) => team.id === keepId);

  return [
    ...active.map((team) => ({ value: team.id, label: team.name })),
    ...(kept ? [{ value: kept.id, label: label(kept) }] : [])
  ];
}
