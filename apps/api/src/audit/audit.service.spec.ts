import type { PrismaService } from '../database/prisma.service';
import { AUDIT_ACTIONS } from './audit-actions';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('remove segredos recursivamente sem remover códigos de permissão', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      auditLog: {
        create
      }
    } as unknown as PrismaService;
    const service = new AuditService(prisma);

    await service.record({
      action: AUDIT_ACTIONS.userUpdated,
      entityType: 'User',
      metadata: {
        newPassword: 'segredo',
        csrfToken: 'segredo',
        recoveryCode: '123456',
        totp: '654321',
        qrCodeDataUrl: 'data:image/png;base64,segredo',
        permissionCodes: ['users.read'],
        nested: {
          authorization: 'Bearer segredo',
          safeValue: true
        }
      }
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: {
          permissionCodes: ['users.read'],
          nested: {
            safeValue: true
          }
        }
      })
    });
  });
});
