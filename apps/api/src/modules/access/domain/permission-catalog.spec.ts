import { ALL_PERMISSIONS, permissionArea, SYSTEM_ROLE_DEFINITIONS } from './permission-catalog';

describe('catálogo de permissões', () => {
  it('toda permissão tem uma área na tela de papéis (DT-078)', () => {
    expect(ALL_PERMISSIONS.filter((code) => permissionArea(code) === 'Outras')).toEqual([]);
    expect(permissionArea('orders.read')).toBe('Loja e entregas');
    expect(permissionArea('cards.manage')).toBe('Parceiros e carteirinhas');
  });

  it('diretoria não recebe governança; administrador recebe tudo', () => {
    const board = SYSTEM_ROLE_DEFINITIONS.find((role) => role.code === 'board');
    const admin = SYSTEM_ROLE_DEFINITIONS.find((role) => role.code === 'admin');

    expect(board?.permissions).not.toContain('permissions.manage');
    expect(admin?.permissions).toHaveLength(ALL_PERMISSIONS.length);
  });
});
