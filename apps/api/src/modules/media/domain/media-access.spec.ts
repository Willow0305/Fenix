import { PERMISSIONS } from '../../access/domain/permission-catalog';
import {
  canReadRestrictedThroughGenericRoute,
  domainPermissionsFor,
  NO_MEDIA_USAGE
} from './media-access';

describe('leitura de arquivo restrito pela rota genérica (PEN-054)', () => {
  it('sem ligação de domínio, basta files.read.restricted', () => {
    expect(domainPermissionsFor(NO_MEDIA_USAGE)).toEqual([]);
    expect(
      canReadRestrictedThroughGenericRoute(
        new Set([PERMISSIONS.filesReadRestricted]),
        NO_MEDIA_USAGE
      )
    ).toBe(true);
  });

  it('nunca libera sem files.read.restricted', () => {
    expect(
      canReadRestrictedThroughGenericRoute(
        new Set([PERMISSIONS.partnerDocumentsRead]),
        NO_MEDIA_USAGE
      )
    ).toBe(false);
  });

  it.each([
    ['partnerDocument', PERMISSIONS.partnerDocumentsRead],
    ['athleteDocument', PERMISSIONS.athletesRead],
    ['transactionAttachment', PERMISSIONS.financeRead],
    ['orderPaymentAttachment', PERMISSIONS.ordersRead],
    ['deliveryProof', PERMISSIONS.ordersRead],
    ['feePaymentAttachment', PERMISSIONS.feesRead]
  ] as const)('%s exige também %s', (key, permission) => {
    const usage = { ...NO_MEDIA_USAGE, [key]: true };

    expect(domainPermissionsFor(usage)).toEqual([permission]);
    expect(
      canReadRestrictedThroughGenericRoute(new Set([PERMISSIONS.filesReadRestricted]), usage)
    ).toBe(false);
    expect(
      canReadRestrictedThroughGenericRoute(
        new Set([PERMISSIONS.filesReadRestricted, permission]),
        usage
      )
    ).toBe(true);
  });

  it('arquivo usado em mais de um domínio exige todas as permissões', () => {
    const usage = { ...NO_MEDIA_USAGE, orderPaymentAttachment: true, deliveryProof: true };

    expect(domainPermissionsFor(usage)).toEqual([PERMISSIONS.ordersRead]);

    const both = { ...NO_MEDIA_USAGE, partnerDocument: true, transactionAttachment: true };
    const partial = new Set([PERMISSIONS.filesReadRestricted, PERMISSIONS.partnerDocumentsRead]);

    expect(canReadRestrictedThroughGenericRoute(partial, both)).toBe(false);
    expect(
      canReadRestrictedThroughGenericRoute(new Set([...partial, PERMISSIONS.financeRead]), both)
    ).toBe(true);
  });
});
