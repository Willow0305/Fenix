import { translateValidationMessage as t } from './validation-messages';

describe('mensagens de validação em pt-BR', () => {
  it.each([
    [
      'minLength',
      'fullName must be longer than or equal to 3 characters',
      'Use pelo menos 3 caracteres.'
    ],
    [
      'maxLength',
      'notes must be shorter than or equal to 2000 characters',
      'Use no máximo 2000 caracteres.'
    ],
    ['min', 'quantity must not be less than 1', 'O valor mínimo é 1.'],
    ['max', 'dueDay must not be greater than 31', 'O valor máximo é 31.'],
    ['isEmail', 'email must be an email', 'E-mail inválido.'],
    [
      'isBoolean',
      'privacyConsent must be a boolean value',
      'Valor inválido: use verdadeiro ou falso.'
    ],
    ['whitelistValidation', 'property hacker should not exist', 'Campo não permitido: hacker.'],
    ['isUuid', 'each value in athleteIds must be a UUID', 'Identificador inválido.'],
    [
      'arrayMaxSize',
      'athleteIds must contain no more than 100 elements',
      'Informe no máximo 100 item(ns).'
    ],
    ['algoNovo', 'campo must be something new', 'Valor inválido.']
  ])('%s', (code, english, expected) => {
    expect(t(code, english)).toBe(expected);
  });

  it('mantém mensagens próprias já em português', () => {
    expect(t('matches', 'Data inválida (AAAA-MM-DD).')).toBe('Data inválida (AAAA-MM-DD).');
  });
});
