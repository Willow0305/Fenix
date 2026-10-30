import type { Benefit } from '../../../lib/card-types';

/** Resumo dos benefícios que valem para afiliados: parceiros distintos e maior desconto. */
export function affiliateOffer(benefits: readonly Benefit[]) {
  const forAffiliates = benefits.filter((benefit) => benefit.forAffiliates);
  const partners = new Set(forAffiliates.map((benefit) => benefit.partner.name));
  const maxDiscount = forAffiliates.reduce(
    (max, benefit) => Math.max(max, Number(benefit.discountPercent)),
    0
  );

  return { benefits: forAffiliates, partnerCount: partners.size, maxDiscount };
}
