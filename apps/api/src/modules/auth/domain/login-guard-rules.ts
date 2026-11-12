/**
 * Freio de tentativas de login por conta (PEN-053, DT-109). O limite por IP (10/min) não
 * segura um ataque que troca de endereço a cada tentativa; este conta as falhas seguidas
 * de um mesmo e-mail, exista ou não a conta, para a resposta não revelar quem tem cadastro.
 *
 * - até a 4ª falha seguida, nada muda;
 * - a partir da 5ª, novas tentativas ficam bloqueadas por 1 minuto, e o tempo dobra a cada
 *   nova falha depois do bloqueio (2, 4, 8 minutos…), até 15 minutos;
 * - a contagem recomeça depois de 24 horas sem falha, no login certo e na redefinição
 *   de senha.
 *
 * Os bloqueios são curtos de propósito: quem ataca não consegue deixar a pessoa sem
 * acesso por muito tempo, e a redefinição de senha continua disponível.
 */
export const LOGIN_FAILURE_THRESHOLD = 5;
export const LOGIN_LOCK_BASE_SECONDS = 60;
export const LOGIN_LOCK_MAX_SECONDS = 15 * 60;
export const LOGIN_FAILURE_WINDOW_SECONDS = 24 * 60 * 60;

/** Bloqueio, em segundos, depois da `failures`-ésima falha seguida (0 = sem bloqueio). */
export function lockSecondsAfter(failures: number): number {
  if (!Number.isInteger(failures) || failures < LOGIN_FAILURE_THRESHOLD) {
    return 0;
  }

  const doublings = Math.min(failures - LOGIN_FAILURE_THRESHOLD, 10);

  return Math.min(LOGIN_LOCK_BASE_SECONDS * 2 ** doublings, LOGIN_LOCK_MAX_SECONDS);
}

/** A falha anterior ainda conta para a sequência? */
export function failureStillCounts(lastFailureAt: Date, now: Date): boolean {
  return now.getTime() - lastFailureAt.getTime() < LOGIN_FAILURE_WINDOW_SECONDS * 1000;
}

/** Segundos que faltam para o bloqueio acabar (0 = livre). */
export function remainingLockSeconds(lockedUntil: Date | null, now: Date): number {
  if (lockedUntil === null) {
    return 0;
  }

  return Math.max(0, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
}

/** Mensagem exibida no bloqueio: a mesma para conta existente ou não. */
export function lockMessage(remainingSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(remainingSeconds / 60));
  const wait = minutes === 1 ? '1 minuto' : `${minutes} minutos`;

  return `Muitas tentativas seguidas com senha errada. Por segurança, tente de novo em ${wait} ou redefina a senha.`;
}
