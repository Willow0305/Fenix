import { createTestContext, type TestContext } from './helpers';

/** DT-073: permissões novas do catálogo chegam ao banco quando a API sobe. */
describe('Sincronização de permissões ao iniciar a API', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  async function grantedTo(role: string, code: string): Promise<boolean> {
    const count = await ctx.prisma.rolePermission.count({
      where: { role: { code: role }, permission: { code } }
    });

    return count > 0;
  }

  async function reboot(): Promise<void> {
    const other = await createTestContext();

    await other.app.close();
    await other.prisma.$disconnect();
  }

  it('permissão que o banco não conhecia é criada e dada a administrador e diretoria', async () => {
    const permission = await ctx.prisma.permission.findUniqueOrThrow({
      where: { code: 'benefits.manage' }
    });

    await ctx.prisma.rolePermission.deleteMany({ where: { permissionId: permission.id } });
    await ctx.prisma.permission.delete({ where: { id: permission.id } });
    await reboot();

    await expect(grantedTo('admin', 'benefits.manage')).resolves.toBe(true);
    await expect(grantedTo('board', 'benefits.manage')).resolves.toBe(true);
    await expect(grantedTo('user', 'benefits.manage')).resolves.toBe(false);
  });

  it('permissão retirada à mão da diretoria continua retirada', async () => {
    const permission = await ctx.prisma.permission.findUniqueOrThrow({
      where: { code: 'cards.manage' }
    });
    const board = await ctx.prisma.role.findUniqueOrThrow({ where: { code: 'board' } });

    await ctx.prisma.rolePermission.deleteMany({
      where: { roleId: board.id, permissionId: permission.id }
    });

    try {
      await reboot();
      await expect(grantedTo('board', 'cards.manage')).resolves.toBe(false);
      await expect(grantedTo('admin', 'cards.manage')).resolves.toBe(true);
    } finally {
      await ctx.prisma.rolePermission.create({
        data: { roleId: board.id, permissionId: permission.id }
      });
    }
  });
});
