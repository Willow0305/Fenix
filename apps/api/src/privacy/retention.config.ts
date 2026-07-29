import { Injectable } from '@nestjs/common';

function readDays(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} deve ser um inteiro entre ${minimum} e ${maximum}.`);
  }

  return value;
}

@Injectable()
export class RetentionConfig {
  public readonly policyVersion = '2026-07-27-v1';
  public readonly closedAccountDays = readDays('RETENTION_CLOSED_ACCOUNT_DAYS', 90, 30, 3650);
  public readonly nonConvertedTryoutDays = readDays(
    'RETENTION_NON_CONVERTED_TRYOUT_DAYS',
    180,
    30,
    3650
  );
  public readonly athleteAndGuardianDays = readDays(
    'RETENTION_ATHLETE_GUARDIAN_DAYS',
    1825,
    365,
    3650
  );
  public readonly financialDays = readDays('RETENTION_FINANCIAL_DAYS', 1825, 365, 3650);
  public readonly administrativeAuditDays = readDays('RETENTION_ADMIN_AUDIT_DAYS', 1825, 365, 3650);
  public readonly securityLogDays = readDays('RETENTION_SECURITY_LOG_DAYS', 365, 30, 730);
  public readonly revokedSessionDays = readDays('RETENTION_REVOKED_SESSION_DAYS', 30, 1, 30);
  public readonly backupDays = readDays('RETENTION_BACKUP_DAYS', 35, 1, 90);
}
