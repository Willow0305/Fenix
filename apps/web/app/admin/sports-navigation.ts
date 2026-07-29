export interface AdministrativeNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly visible: boolean;
}

export function createSportsNavigation(
  permissions: readonly string[]
): readonly AdministrativeNavigationItem[] {
  return [
    {
      href: '/admin/esportivo',
      label: 'Esportivo',
      visible: permissions.includes('sports.read')
    }
  ];
}
