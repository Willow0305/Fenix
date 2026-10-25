import { teamOptions } from './team-options';

const TEAMS = [
  { id: 'a', name: 'Feminino', isActive: true },
  { id: 'b', name: 'Antigo', isActive: false },
  { id: 'c', name: 'Masculino', isActive: true }
];

describe('teamOptions', () => {
  it('para escolher, mostra só ativas', () => {
    expect(teamOptions(TEAMS, 'pick').map((o) => o.value)).toEqual(['a', 'c']);
  });

  it('mantém a equipe inativa que o registro já usa, marcada', () => {
    expect(teamOptions(TEAMS, 'pick', 'b')).toContainEqual({
      value: 'b',
      label: 'Antigo (inativa)'
    });
  });

  it('para filtrar, mostra ativas primeiro e inativas marcadas', () => {
    expect(teamOptions(TEAMS, 'filter').map((o) => o.label)).toEqual([
      'Feminino',
      'Masculino',
      'Antigo (inativa)'
    ]);
  });
});
