import { Prisma } from '../generated/prisma/client';
import { createPrismaClient } from '../common/prisma/prisma.service';

/**
 * Dados FICTÍCIOS para demonstração local (`npm run db:demo`). Idempotente por slug/código.
 * Nunca execute em produção: o script recusa NODE_ENV=production.
 */
const D = (value: string) => new Prisma.Decimal(value);

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Dados de demonstração não podem ser criados em produção.');
  }

  const prisma = createPrismaClient();

  try {
    const now = new Date();
    const day = 86_400_000;

    // Só preenche campos vazios: o que a diretoria gravou em Configurações nunca é sobrescrito.
    const settings = await prisma.teamSettings.findFirst();
    const demoSettings: Prisma.TeamSettingsUpdateInput = {
      ...(settings?.description
        ? {}
        : {
            description:
              'Time de vôlei amador de Rio Branco que renasce a cada jogo. (dados de demonstração)'
          }),
      ...(settings?.history
        ? {}
        : {
            history:
              'O Fênix nasceu da vontade de um grupo de amigos de manter o vôlei vivo na cidade.\n\nHoje reúne equipes masculina e feminina, treinos semanais e participação em campeonatos regionais.\n\n(Texto fictício de demonstração.)'
          }),
      ...(settings?.addressCity ? {} : { addressCity: 'Rio Branco', addressState: 'AC' }),
      ...(settings?.pickupInstructions
        ? {}
        : { pickupInstructions: 'Retirada no ginásio, às terças e quintas, das 18h às 20h.' })
    };

    if (settings && Object.keys(demoSettings).length > 0) {
      await prisma.teamSettings.update({ where: { id: settings.id }, data: demoSettings });
    }

    const teams = [
      {
        slug: 'fenix-masculino',
        name: 'Fênix Masculino',
        type: 'MALE' as const,
        description: 'Equipe adulta masculina.'
      },
      {
        slug: 'fenix-feminino',
        name: 'Fênix Feminino',
        type: 'FEMALE' as const,
        description: 'Equipe adulta feminina.'
      }
    ];

    for (const team of teams) {
      await prisma.team.upsert({ where: { slug: team.slug }, create: team, update: {} });
    }

    const feminino = await prisma.team.findUniqueOrThrow({ where: { slug: 'fenix-feminino' } });
    const masculino = await prisma.team.findUniqueOrThrow({ where: { slug: 'fenix-masculino' } });
    const plan =
      (await prisma.monthlyFeePlan.findFirst({ where: { name: 'Mensalidade padrão (demo)' } })) ??
      (await prisma.monthlyFeePlan.create({
        data: { name: 'Mensalidade padrão (demo)', amount: D('80'), currency: 'BRL', dueDay: 10 }
      }));
    const athletes = [
      {
        fullName: 'Ana Exemplo Silva',
        position: 'Levantador(a)',
        team: feminino.id,
        birth: '1998-03-12'
      },
      {
        fullName: 'Bruna Exemplo Costa',
        position: 'Ponteiro(a)',
        team: feminino.id,
        birth: '2000-07-21'
      },
      {
        fullName: 'Carlos Exemplo Souza',
        position: 'Central',
        team: masculino.id,
        birth: '1995-11-02'
      },
      {
        fullName: 'Diego Exemplo Lima',
        position: 'Líbero',
        team: masculino.id,
        birth: '1999-01-30'
      }
    ];

    for (const a of athletes) {
      const existing = await prisma.athlete.findFirst({ where: { fullName: a.fullName } });

      if (existing) {
        continue;
      }

      const athlete = await prisma.athlete.create({
        data: {
          fullName: a.fullName,
          position: a.position,
          birthDate: new Date(`${a.birth}T00:00:00Z`),
          status: 'ACTIVE',
          notes: 'Cadastro fictício de demonstração.'
        }
      });

      await prisma.teamAthlete.create({
        data: { athleteId: athlete.id, teamId: a.team, startsOn: new Date('2026-01-01T00:00:00Z') }
      });
      await prisma.athleteMonthlyFeePlan.create({
        data: {
          athleteId: athlete.id,
          monthlyFeePlanId: plan.id,
          startsOn: new Date('2026-01-01T00:00:00Z')
        }
      });
    }

    await prisma.tryout.upsert({
      where: { slug: 'seletiva-feminina-demo' },
      create: {
        slug: 'seletiva-feminina-demo',
        title: 'Seletiva feminina (demonstração)',
        description: 'Traga roupa de treino e garrafa de água. Avaliação de fundamentos e jogo.',
        location: 'Ginásio do bairro (fictício)',
        teamId: feminino.id,
        startsAt: new Date(now.getTime() + 14 * day),
        registrationEndsAt: new Date(now.getTime() + 10 * day),
        maxSlots: 30,
        status: 'OPEN'
      },
      update: {}
    });

    const category = await prisma.productCategory.upsert({
      where: { slug: 'uniformes-demo' },
      create: { slug: 'uniformes-demo', name: 'Uniformes' },
      update: {}
    });
    const accessories = await prisma.productCategory.upsert({
      where: { slug: 'acessorios-demo' },
      create: { slug: 'acessorios-demo', name: 'Acessórios' },
      update: {}
    });
    const products = [
      {
        slug: 'camisa-torcedor-demo',
        name: 'Camisa Torcedor Fênix',
        price: '89.90',
        promo: '79.90',
        cat: category.id,
        featured: true,
        sizes: ['P', 'M', 'G', 'GG'],
        stock: 8
      },
      {
        slug: 'garrafa-fenix-demo',
        name: 'Garrafa Fênix 750 ml',
        price: '35.00',
        promo: null,
        cat: accessories.id,
        featured: true,
        sizes: ['Único'],
        stock: 20
      },
      {
        slug: 'joelheira-demo',
        name: 'Joelheira de vôlei',
        price: '59.90',
        promo: null,
        cat: accessories.id,
        featured: false,
        sizes: ['P', 'M', 'G'],
        stock: 5
      }
    ];

    for (const p of products) {
      if (await prisma.product.findUnique({ where: { slug: p.slug } })) {
        continue;
      }

      const product = await prisma.product.create({
        data: {
          slug: p.slug,
          name: p.name,
          productCategoryId: p.cat,
          fulfillmentType: 'STOCK',
          basePrice: D(p.price),
          promotionalPrice: p.promo ? D(p.promo) : null,
          currency: 'BRL',
          status: 'ACTIVE',
          isFeatured: p.featured,
          description: 'Produto fictício de demonstração.'
        }
      });

      for (const size of p.sizes) {
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: `${p.slug}-${size}`.toUpperCase(),
            name: size,
            size: size === 'Único' ? null : size,
            minimumStock: 2
          }
        });

        await prisma.inventoryMovement.create({
          data: {
            productVariantId: variant.id,
            type: 'STOCK_IN',
            quantityDelta: p.stock,
            reason: 'Estoque inicial (demonstração)'
          }
        });
      }
    }

    if (!(await prisma.product.findUnique({ where: { slug: 'camisa-jogo-2027-demo' } }))) {
      const jersey = await prisma.product.create({
        data: {
          slug: 'camisa-jogo-2027-demo',
          name: 'Camisa de jogo 2027 (pré-venda)',
          productCategoryId: category.id,
          fulfillmentType: 'CAMPAIGN',
          basePrice: D('120'),
          currency: 'BRL',
          status: 'ACTIVE',
          isFeatured: true,
          description: 'Uniforme oficial produzido sob encomenda. Produto fictício de demonstração.'
        }
      });

      for (const size of ['P', 'M', 'G', 'GG']) {
        await prisma.productVariant.create({
          data: { productId: jersey.id, sku: `JOGO2027-${size}`, name: size, size }
        });
      }

      const campaign = await prisma.salesCampaign.create({
        data: {
          slug: 'uniformes-2027-demo',
          name: 'Uniformes temporada 2027',
          description: 'Garanta sua camisa oficial. Produção após o encerramento das vendas.',
          salesStartAt: new Date(now.getTime() - day),
          salesEndAt: new Date(now.getTime() + 20 * day),
          currency: 'BRL',
          minimumQuantity: 20,
          refundPolicy:
            'Se o mínimo não for atingido, os valores pagos são devolvidos integralmente por PIX em até 7 dias.',
          status: 'OPEN'
        }
      });

      await prisma.salesCampaignProduct.create({
        data: { salesCampaignId: campaign.id, productId: jersey.id, campaignPrice: D('109.90') }
      });
    }

    console.log(
      'Dados de demonstração criados (equipes, atletas, plano, seletiva, produtos e remessa).'
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha ao criar dados de demonstração.');
  process.exitCode = 1;
});
