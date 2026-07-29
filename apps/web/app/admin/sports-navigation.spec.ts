import { createSportsNavigation } from './sports-navigation';

describe('sports administration navigation', () => {
  it('shows the sports section only when sports.read is effective', () => {
    expect(createSportsNavigation(['sports.read'])).toEqual([
      {
        href: '/admin/esportivo',
        label: 'Esportivo',
        visible: true
      }
    ]);
    expect(createSportsNavigation(['users.read'])[0]?.visible).toBe(false);
  });
});
