/**
 * Remove chaves com valor `undefined` (necessário com `exactOptionalPropertyTypes`),
 * preservando `null` e demais valores explícitos vindos dos DTOs.
 */
export function defined<T extends object>(value: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}
