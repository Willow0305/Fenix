/**
 * Pedidos de quem compra sem conta (DT-096): link fixo e pedidos lembrados neste aparelho.
 * Número e código vão depois do `#` do link, que o navegador não envia ao servidor.
 */
export interface GuestOrderRef {
  readonly orderNumber: string;
  readonly code: string;
}

interface Remembered extends GuestOrderRef {
  readonly savedAt: number;
}

const STORAGE_KEY = 'fenix:pedidos-sem-conta';
/** Esquecido sozinho 90 dias depois da última consulta neste aparelho. */
export const REMEMBER_DAYS = 90;
const MAX_REMEMBERED = 10;

export function guestOrderLink(orderNumber: string, code: string): string {
  return `/loja/pedido#pedido=${encodeURIComponent(orderNumber)}&codigo=${encodeURIComponent(code)}`;
}

/** Lê `#pedido=...&codigo=...` do link fixo. */
export function parseGuestOrderHash(hash: string): GuestOrderRef | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const orderNumber = params.get('pedido')?.trim();
  const code = params.get('codigo')?.trim();

  return orderNumber && code ? { orderNumber, code } : null;
}

function read(now: number): Remembered[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as Remembered[]) : [];

    return Array.isArray(list)
      ? list.filter(
          (item) =>
            typeof item?.orderNumber === 'string' &&
            typeof item.code === 'string' &&
            typeof item.savedAt === 'number' &&
            now - item.savedAt < REMEMBER_DAYS * 86_400_000
        )
      : [];
  } catch {
    return [];
  }
}

function write(list: Remembered[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Sem armazenamento (janela anônima, bloqueado): a consulta continua funcionando.
  }
}

export function rememberedGuestOrders(now = Date.now()): GuestOrderRef[] {
  return read(now)
    .sort((a, b) => b.savedAt - a.savedAt)
    .map(({ orderNumber, code }) => ({ orderNumber, code }));
}

export function rememberGuestOrder(ref: GuestOrderRef, now = Date.now()): void {
  const others = read(now).filter((item) => item.orderNumber !== ref.orderNumber);

  write([{ ...ref, savedAt: now }, ...others].slice(0, MAX_REMEMBERED));
}

export function forgetGuestOrder(orderNumber: string, now = Date.now()): void {
  write(read(now).filter((item) => item.orderNumber !== orderNumber));
}
