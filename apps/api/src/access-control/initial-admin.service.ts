import { ConflictException, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { AUDIT_ACTIONS } from '../audit/audit-actions';
import { AuditService } from '../audit/audit.service';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { normalizeEmail } from '../common/security/security';
import { PrismaService } from '../database/prisma.service';
import { ROLE_CODES } from './access.constants';
import { AccessControlService } from './access-control.service';

interface InitialAdminInput {
  readonly email: string;
  readonly name: string;
  readonly password: string;
}

@Injectable()
export class InitialAdminService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly audit: AuditService
  ) {}

  public async create(input: InitialAdminInput): Promise<string> {
    if (process.env['NODE_ENV'] === 'production') {
      throw new ConflictException({
        code: 'PRODUCTION_BOOTSTRAP_BLOCKED',
        message:
          'O bootstrap inicial está bloqueado em produção até os gates formais serem aprovados.'
      });
    }

    const name = input.name.trim();
    const email = normalizeEmail(input.email);

    if (name.length < 2 || name.length > 160) {
      throw new Error('BOOTSTRAP_ADMIN_NAME deve possuir entre 2 e 160 caracteres.');
    }

    if (!email.includes('@') || email.length > 180) {
      throw new Error('BOOTSTRAP_ADMIN_EMAIL deve ser um e-mail válido.');
    }

    if (input.password.length < 12 || input.password.length > 128) {
      throw new Error('BOOTSTRAP_ADMIN_PASSWORD deve possuir entre 12 e 128 caracteres.');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    return this.prisma.$transaction(
      async (database) => {
        const [lock] = await database.$queryRaw<readonly { readonly locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(728194625) AS "locked"
        `;

        if (!lock?.locked) {
          throw new ConflictException({
            code: 'INITIAL_ADMIN_BOOTSTRAP_BUSY',
            message: 'Outro bootstrap administrativo está em andamento.'
          });
        }
        await this.accessControl.ensurePhaseOneCatalog(database);
        const administratorRole = await database.role.findUniqueOrThrow({
          where: { code: ROLE_CODES.administrator }
        });
        const administratorExists = await database.user.count({
          where: {
            deletedAt: null,
            userRoles: {
              some: {
                roleId: administratorRole.id
              }
            }
          }
        });

        if (administratorExists > 0) {
          throw new ConflictException({
            code: 'INITIAL_ADMIN_ALREADY_EXISTS',
            message: 'O administrador inicial já foi criado.'
          });
        }

        const existingUser = await database.user.findUnique({
          where: { email }
        });

        if (existingUser) {
          throw new ConflictException({
            code: 'BOOTSTRAP_EMAIL_ALREADY_EXISTS',
            message: 'O e-mail informado já pertence a outra conta.'
          });
        }

        const user = await database.user.create({
          data: {
            name,
            email,
            passwordHash,
            status: UserStatus.ACTIVE,
            emailVerifiedAt: new Date()
          }
        });
        await database.userRole.create({
          data: {
            userId: user.id,
            roleId: administratorRole.id,
            grantedById: user.id
          }
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.adminBootstrapped,
            actorUserId: user.id,
            entityType: 'User',
            entityId: user.id,
            afterData: {
              status: UserStatus.ACTIVE,
              roles: [ROLE_CODES.administrator]
            },
            metadata: {
              emailVerificationBasis: 'TRUSTED_LOCAL_BOOTSTRAP',
              source: 'LOCAL_ADMIN_COMMAND'
            }
          },
          database
        );

        return user.id;
      },
      {
        isolationLevel: 'Serializable'
      }
    );
  }
}
