import {
  normalizePersonalization,
  type PersonalizationField,
  personalizationKey,
  personalizationSnapshot,
  personalizationValuesOf
} from './personalization';

const name: PersonalizationField = {
  id: 'nome',
  label: 'Nome na camisa',
  kind: 'TEXT',
  required: true,
  maxLength: 12,
  minValue: null,
  maxValue: null,
  uppercase: true,
  extraPrice: '15.00'
};
const number: PersonalizationField = {
  id: 'numero',
  label: 'Número',
  kind: 'NUMBER',
  required: false,
  maxLength: null,
  minValue: 0,
  maxValue: 99,
  uppercase: false,
  extraPrice: '0'
};

describe('personalização (DT-069)', () => {
  it('normaliza: maiúsculas, espaços e número sem zero à esquerda', () => {
    expect(
      normalizePersonalization([name, number], { nome: '  joão   d’a ', numero: '07' })
    ).toEqual({
      values: { nome: 'JOÃO D’A', numero: '7' },
      problems: []
    });
    expect(normalizePersonalization([name, number], { nome: 'joão', numero: '07' })).toEqual({
      values: { nome: 'JOÃO', numero: '7' },
      problems: []
    });
  });

  it('exige o obrigatório e respeita limites', () => {
    expect(normalizePersonalization([name, number], {}).problems).toEqual([
      'Preencha "Nome na camisa".'
    ]);
    expect(
      normalizePersonalization([name, number], { nome: 'Maximiliano Silva', numero: '100' })
        .problems
    ).toEqual([
      '"Nome na camisa" pode ter no máximo 12 caracteres.',
      '"Número" deve ser um número de 0 a 99.'
    ]);
    expect(normalizePersonalization([name], { nome: '<script>' }).problems).toHaveLength(1);
  });

  it('chave estável por valores; vazio não tem chave', () => {
    expect(personalizationKey({})).toBe('');
    expect(personalizationKey({ a: '1', b: '2' })).toBe(personalizationKey({ b: '2', a: '1' }));
    expect(personalizationKey({ a: '1' })).not.toBe(personalizationKey({ a: '2' }));
  });

  it('cópia legível para o pedido e leitura segura', () => {
    expect(personalizationSnapshot([name, number], { nome: 'ANA' })).toEqual([
      { fieldId: 'nome', label: 'Nome na camisa', value: 'ANA', extraPrice: '15.00' }
    ]);
    expect(personalizationValuesOf({ personalization: { nome: 'ANA', x: 3 } })).toEqual({
      nome: 'ANA'
    });
    expect(personalizationValuesOf(null)).toEqual({});
  });
});
