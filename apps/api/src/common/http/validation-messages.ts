/**
 * Mensagens de validação em pt-BR (padrão do sistema). O class-validator gera textos em
 * inglês quando o DTO não define `message`; aqui eles viram frases em português, com os
 * números da regra preservados. Mensagens próprias (já em português) passam sem mudança.
 */
const DEFAULT_MESSAGE =
  /^(property \S+ should not exist|each value in |[\w.[\]]+ (must|should|has) )/;

type Translator = (english: string) => string;

const n = (english: string, pattern: RegExp): string => english.match(pattern)?.[1] ?? '';

const TRANSLATIONS: Record<string, Translator> = {
  minLength: (e) => `Use pelo menos ${n(e, /equal to (\d+)/)} caracteres.`,
  maxLength: (e) => `Use no máximo ${n(e, /equal to (\d+)/)} caracteres.`,
  min: (e) => `O valor mínimo é ${n(e, /less than (-?[\d.]+)/)}.`,
  max: (e) => `O valor máximo é ${n(e, /greater than (-?[\d.]+)/)}.`,
  arrayMinSize: (e) => `Informe pelo menos ${n(e, /at least (\d+)/)} item(ns).`,
  arrayMaxSize: (e) => `Informe no máximo ${n(e, /more than (\d+)/)} item(ns).`,
  whitelistValidation: (e) => `Campo não permitido: ${n(e, /property (\S+)/)}.`,
  isEmail: () => 'E-mail inválido.',
  isString: () => 'Informe um texto.',
  isBoolean: () => 'Valor inválido: use verdadeiro ou falso.',
  isInt: () => 'Informe um número inteiro.',
  isNumber: () => 'Informe um número.',
  isEnum: () => 'Opção inválida.',
  isIn: () => 'Opção inválida.',
  isUuid: () => 'Identificador inválido.',
  isISO8601: () => 'Data inválida.',
  isDateString: () => 'Data inválida.',
  isUrl: () => 'Endereço (URL) inválido.',
  isArray: () => 'Informe uma lista.',
  isNotEmpty: () => 'Campo obrigatório.',
  isDefined: () => 'Campo obrigatório.',
  matches: () => 'Formato inválido.',
  equals: () => 'Valor inválido.',
  isObject: () => 'Dados inválidos.'
};

export function translateValidationMessage(code: string, message: string): string {
  if (!DEFAULT_MESSAGE.test(message)) {
    return message;
  }

  return (TRANSLATIONS[code] ?? (() => 'Valor inválido.'))(message);
}
