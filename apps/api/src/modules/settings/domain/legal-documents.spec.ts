import { legalHash, nextLegalVersion, publishedText } from './legal-documents';

describe('versões dos termos e da política (DT-089)', () => {
  it('trata texto vazio ou só com espaços como não publicado', () => {
    expect(publishedText(null)).toBeNull();
    expect(publishedText(undefined)).toBeNull();
    expect(publishedText('  \n ')).toBeNull();
    expect(publishedText('Termos')).toBe('Termos');
  });

  it('cria a versão 1 no primeiro texto', () => {
    expect(nextLegalVersion('Termos v1', null)).toEqual({
      version: 1,
      contentHash: legalHash('Termos v1'),
      content: 'Termos v1'
    });
  });

  it('não cria versão quando o texto é idêntico à última', () => {
    expect(
      nextLegalVersion('Termos v1', { version: 1, contentHash: legalHash('Termos v1') })
    ).toBeNull();
  });

  it('cria a próxima versão quando qualquer caractere muda', () => {
    expect(
      nextLegalVersion('Termos v1.', { version: 3, contentHash: legalHash('Termos v1') })
    ).toMatchObject({ version: 4, content: 'Termos v1.' });
  });

  it('não cria versão ao apagar o texto', () => {
    expect(nextLegalVersion('', { version: 2, contentHash: legalHash('x') })).toBeNull();
  });

  it('usa SHA-256 em hexadecimal', () => {
    expect(legalHash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});
