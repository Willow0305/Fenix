import { siteRevalidateUrls } from './app-config';

describe('endereços do descarte de cache do site (DT-116)', () => {
  it('sem lista, usa o endereço interno do site', () => {
    expect(siteRevalidateUrls({ WEB_INTERNAL_URL: 'http://web:3000' })).toEqual([
      'http://web:3000/api/site-revalidate'
    ]);
    expect(siteRevalidateUrls({})).toEqual(['http://127.0.0.1:3000/api/site-revalidate']);
  });

  it('com várias instâncias, avisa cada uma uma vez só', () => {
    expect(
      siteRevalidateUrls({
        SITE_REVALIDATE_URLS: 'http://web-1:3000/, http://web-2:3000,,http://web-1:3000',
        WEB_INTERNAL_URL: 'http://web:3000'
      })
    ).toEqual(['http://web-1:3000/api/site-revalidate', 'http://web-2:3000/api/site-revalidate']);
  });

  it('recusa endereço malformado', () => {
    expect(() => siteRevalidateUrls({ SITE_REVALIDATE_URLS: 'web-1:3000' })).toThrow(
      /SITE_REVALIDATE_URLS/
    );
  });
});
