export type TechnicalHealthStatus = 'ok';

export interface TechnicalHealthResponse {
  readonly service: string;
  readonly status: TechnicalHealthStatus;
  readonly timestamp: string;
}
