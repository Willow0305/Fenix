import { createFinanceNavigation } from './finance-navigation';

describe('finance navigation', () => {
  it('only exposes Caixa Fênix to users with server-side financial read permission', () => {
    expect(createFinanceNavigation(['finance.read'])[0]?.visible).toBe(true);
    expect(createFinanceNavigation(['users.read'])[0]?.visible).toBe(false);
  });
});
