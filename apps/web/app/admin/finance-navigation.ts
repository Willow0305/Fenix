import type { AdministrativeNavigationItem } from './sports-navigation';

export function createFinanceNavigation(
  permissions: readonly string[]
): readonly AdministrativeNavigationItem[] {
  return [
    {
      href: '/admin/financeiro',
      label: 'Caixa Fênix',
      visible: permissions.includes('finance.read')
    }
  ];
}
