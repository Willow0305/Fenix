import {
  formatCnpj,
  formatCpf,
  formatPhone,
  isValidCnpj,
  isValidCpf,
  isValidCpfOrCnpj,
  isValidMobilePhone,
  isValidPhone,
  maskCpf,
  onlyDigits
} from './br-documents';

describe('CPF', () => {
  it.each(['529.982.247-25', '52998224725', '111.444.777-35'])('aceita %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });

  it.each([
    ['dígito verificador errado', '529.982.247-24'],
    ['sequência repetida', '111.111.111-11'],
    ['curto', '529.982.247'],
    ['RG', '12.345.678-9'],
    ['vazio', '']
  ])('recusa %s', (_case, cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });

  it('formata progressivamente', () => {
    expect(formatCpf('529')).toBe('529');
    expect(formatCpf('5299')).toBe('529.9');
    expect(formatCpf('5299822')).toBe('529.982.2');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('529982247259999')).toBe('529.982.247-25');
  });

  it('mascara para exibição sem expor o número inteiro', () => {
    expect(maskCpf('52998224725')).toBe('***.982.247-**');
  });
});

describe('CNPJ', () => {
  it('valida e formata', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('escolhe CPF ou CNPJ pela quantidade de dígitos', () => {
    expect(isValidCpfOrCnpj('529.982.247-25')).toBe(true);
    expect(isValidCpfOrCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCpfOrCnpj('1234')).toBe(false);
  });
});

describe('telefone', () => {
  it('aceita celular com DDD válido', () => {
    expect(isValidMobilePhone('(68) 99999-0000')).toBe(true);
    expect(isValidMobilePhone('68999990000')).toBe(true);
  });

  it.each([
    ['sem DDD', '99999-0000'],
    ['DDD com zero', '(10) 99999-0000'],
    ['DDD iniciando em zero', '(01) 99999-0000'],
    ['sem o 9 inicial', '(68) 89999-0000'],
    ['fixo', '(68) 3222-0000']
  ])('recusa celular %s', (_case, phone) => {
    expect(isValidMobilePhone(phone)).toBe(false);
  });

  it('aceita fixo apenas onde permitido', () => {
    expect(isValidPhone('(68) 3222-0000')).toBe(true);
    expect(isValidPhone('(68) 99999-0000')).toBe(true);
    expect(isValidPhone('(68) 9222-0000')).toBe(false);
  });

  it('formata progressivamente celular e fixo', () => {
    expect(formatPhone('6')).toBe('(6');
    expect(formatPhone('689')).toBe('(68) 9');
    expect(formatPhone('6832220000')).toBe('(68) 3222-0000');
    expect(formatPhone('68999990000')).toBe('(68) 99999-0000');
    expect(onlyDigits(formatPhone('68999990000'))).toBe('68999990000');
  });
});
