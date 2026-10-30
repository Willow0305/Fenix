import type { Benefit } from '../../../lib/card-types';
import { affiliateOffer } from './affiliate-offer';

const benefit = (over: Partial<Benefit>): Benefit => ({
  id: 'b',
  partner: { id: 'p', name: 'Loja A', logoUrl: null, details: null },
  title: 'Desconto',
  discountPercent: '10',
  conditions: null,
  forBoard: false,
  forAthletes: false,
  forAffiliates: true,
  ...over
});

describe('oferta da afiliação', () => {
  it('conta só benefícios de afiliados, parceiros distintos e o maior desconto', () => {
    const offer = affiliateOffer([
      benefit({ id: '1', discountPercent: '15' }),
      benefit({ id: '2', discountPercent: '8' }),
      benefit({
        id: '3',
        partner: { id: 'q', name: 'Clínica B', logoUrl: null, details: null },
        discountPercent: '20'
      }),
      benefit({ id: '4', discountPercent: '50', forAffiliates: false, forAthletes: true })
    ]);

    expect(offer.benefits).toHaveLength(3);
    expect(offer.partnerCount).toBe(2);
    expect(offer.maxDiscount).toBe(20);
  });

  it('sem benefícios, não promete desconto', () => {
    expect(affiliateOffer([])).toEqual({ benefits: [], partnerCount: 0, maxDiscount: 0 });
  });
});
