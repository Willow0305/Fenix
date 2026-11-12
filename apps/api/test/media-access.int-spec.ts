import { randomUUID } from 'node:crypto';

import { PERMISSIONS } from '../src/modules/access/domain/permission-catalog';
import {
  createTestContext,
  createUser,
  login,
  PNG_1X1,
  type TestContext,
  tokenFor
} from './helpers';

/**
 * Rota genérica `/media/:id` (PEN-054, DT-110): `files.read.restricted` sozinha não abre
 * arquivo de um domínio com permissão própria, como documento de parceiro.
 */
describe('Arquivo restrito pela rota genérica exige a permissão do domínio', () => {
  let ctx: TestContext;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.app.close();
    await ctx.prisma.$disconnect();
  });

  /** Papel personalizado só com as permissões informadas, e uma sessão completa dele. */
  async function tokenWith(permissions: string[]): Promise<string> {
    const code = `teste-arquivos-${randomUUID().slice(0, 8)}`;
    const rows = await ctx.prisma.permission.findMany({ where: { code: { in: permissions } } });

    expect(rows).toHaveLength(permissions.length);
    await ctx.prisma.role.create({
      data: {
        code,
        name: `Teste ${code}`,
        rolePermissions: { create: rows.map((row) => ({ permissionId: row.id })) }
      }
    });

    const user = await createUser(ctx.prisma, [code]);

    // Permissão administrativa pede a segunda etapa: o primeiro login a ativa e o segundo
    // responde ao desafio, para a sessão ter todas as permissões do papel.
    await login(ctx, user.email);

    return login(ctx, user.email);
  }

  async function partnerDocumentMedia(boardToken: string): Promise<string> {
    const partner = await ctx
      .http()
      .post('/api/v1/partners')
      .set(auth(boardToken))
      .send({
        legalName: `Parceiro ${randomUUID().slice(0, 6)} LTDA`,
        displayName: `Parceiro ${randomUUID().slice(0, 6)}`,
        type: 'STORE',
        commissionType: 'PERCENTAGE',
        commissionPercentage: '10'
      })
      .expect(201);
    const withDoc = await ctx
      .http()
      .post(`/api/v1/partners/${partner.body.id as string}/documents`)
      .set(auth(boardToken))
      .field('documentType', 'Contrato')
      .attach('file', PNG_1X1, 'contrato.png')
      .expect(201);
    const documentId = withDoc.body.documents[0].id as string;

    return (await ctx.prisma.partnerDocument.findUniqueOrThrow({ where: { id: documentId } }))
      .mediaFileId;
  }

  it('documento de parceiro: só files.read.restricted não basta', async () => {
    const board = await tokenFor(ctx, ['board']);
    const mediaId = await partnerDocumentMedia(board.token);
    const filesOnly = await tokenWith([PERMISSIONS.filesReadRestricted]);
    const withDomain = await tokenWith([
      PERMISSIONS.filesReadRestricted,
      PERMISSIONS.partnerDocumentsRead
    ]);
    const domainOnly = await tokenWith([PERMISSIONS.partnerDocumentsRead]);

    // 404, e não 403, para não revelar que o arquivo existe.
    await ctx.http().get(`/api/v1/media/${mediaId}`).set(auth(filesOnly)).expect(404);
    await ctx.http().get(`/api/v1/media/${mediaId}`).set(auth(domainOnly)).expect(404);
    await ctx.http().get(`/api/v1/media/${mediaId}`).expect(404);

    const allowed = await ctx
      .http()
      .get(`/api/v1/media/${mediaId}`)
      .set(auth(withDomain))
      .expect(200);

    expect(allowed.headers['cache-control']).toBe('private, no-store');
    // A diretoria tem as duas permissões e continua lendo, como antes.
    await ctx.http().get(`/api/v1/media/${mediaId}`).set(auth(board.token)).expect(200);
  });

  it('documento apagado deixa de exigir a permissão do domínio', async () => {
    const board = await tokenFor(ctx, ['board']);
    const mediaId = await partnerDocumentMedia(board.token);
    const filesOnly = await tokenWith([PERMISSIONS.filesReadRestricted]);

    await ctx.http().get(`/api/v1/media/${mediaId}`).set(auth(filesOnly)).expect(404);
    await ctx.prisma.partnerDocument.updateMany({
      where: { mediaFileId: mediaId },
      data: { deletedAt: new Date() }
    });
    // Sem uso ativo, vale a regra geral de arquivo restrito.
    await ctx.http().get(`/api/v1/media/${mediaId}`).set(auth(filesOnly)).expect(200);
  });
});
