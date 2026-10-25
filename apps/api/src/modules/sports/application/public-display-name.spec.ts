import { publicDisplayName } from './teams.service';

describe('publicDisplayName (DT-044)', () => {
  it('usa o apelido quando existe', () => {
    expect(publicDisplayName('Maria Clara Souza', 'Mari', false)).toBe('Mari');
  });

  it('adulto: primeiro nome e último sobrenome', () => {
    expect(publicDisplayName('Maria Clara Souza', null, true)).toBe('Maria Souza');
  });

  it('menor: sobrenome só com a inicial', () => {
    expect(publicDisplayName('Maria Clara Souza', null, false)).toBe('Maria S.');
  });

  it('nome único fica como está', () => {
    expect(publicDisplayName('Maria', null, false)).toBe('Maria');
  });
});
