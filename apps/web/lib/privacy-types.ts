export type PrivacyType = 'DATA_EXPORT' | 'ERASURE';
export type PrivacyStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface PrivacyRequest {
  id: string;
  type: PrivacyType;
  status: PrivacyStatus;
  details: string | null;
  resolution: string | null;
  user?: { id: string; name: string; email: string };
  handledBy: string | null;
  handledAt: string | null;
  createdAt: string;
}

export const PRIVACY_TYPE: Record<PrivacyType, string> = {
  DATA_EXPORT: 'Cópia dos dados',
  ERASURE: 'Eliminação da conta'
};

export const PRIVACY_STATUS: Record<PrivacyStatus, { label: string; badge: string }> = {
  OPEN: { label: 'Recebida', badge: 'badge-warning' },
  IN_PROGRESS: { label: 'Em atendimento', badge: 'badge-info' },
  COMPLETED: { label: 'Concluída', badge: 'badge-success' },
  REJECTED: { label: 'Recusada', badge: 'badge-danger' }
};
