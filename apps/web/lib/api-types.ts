/** Contratos consumidos pela interface. Espelham as respostas da API (10-API.md). */

export interface FieldProblem {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface Problem {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly requestId?: string;
  readonly errors?: readonly FieldProblem[];
}

export interface Page<T> {
  readonly data: T[];
  readonly meta: { readonly page: number; readonly pageSize: number; readonly total: number };
}

export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly roles: string[];
  readonly permissions: string[];
  readonly athleteId: string | null;
  readonly createdAt: string;
}

export type BrandContext = 'OFFICIAL' | 'MALE' | 'FEMALE' | 'BOARD' | 'FAVICON' | 'COVER' | 'OTHER';

export interface PublicTeam {
  readonly teamName: string;
  readonly officialName: string;
  readonly description: string | null;
  readonly history: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly socialLinks: { label: string; url: string }[];
  readonly address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
  readonly currency: string;
  readonly timeZone: string;
  readonly termsOfUse: string | null;
  readonly privacyPolicy: string | null;
  readonly monthlyFeeRules: string | null;
  readonly storeRules: string | null;
  readonly pickupInstructions: string | null;
  readonly brandAssets: Partial<Record<BrandContext, { url: string; altText: string | null }>>;
}

export interface AdminTeam extends PublicTeam {
  readonly updatedAt: string;
  readonly updatedBy: string | null;
  readonly financial: { pixKey: string | null; bankingDetails: string | null } | null;
}

export interface AdminUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  readonly roles: string[];
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export interface Role {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly permissions: string[];
  readonly userCount: number;
}

export interface AuditLog {
  readonly id: string;
  readonly occurredAt: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly reason: string | null;
  readonly actor: { id: string; name: string } | null;
  readonly before: unknown;
  readonly after: unknown;
  readonly metadata: unknown;
  readonly requestId: string | null;
}

export interface SessionInfo {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly current: boolean;
}
