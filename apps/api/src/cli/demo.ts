import { Prisma } from '../generated/prisma/client';
import { createPrismaClient } from '../common/prisma/prisma.service';
import { normalizeNeighborhood } from '../modules/store/domain/delivery';

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

    // Conteúdo de exemplo com textos e palavras longas, para conferir quebras de linha e
    // cartões em telas pequenas (notícias, eventos e fórum).
    const author = await prisma.user.findFirst({
      where: { deletedAt: null, userRoles: { some: { role: { code: 'admin' } } } },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });
    const LONG_WORD = 'Pneumoultramicroscopicossilicovulcanoconiótico';
    const paragraph = (topic: string) =>
      `${topic} Este parágrafo existe para testar a leitura de textos longos no site, em celular e computador, com frases compridas, vírgulas, números como 25 x 23 e 3 sets a 1, e palavras enormes como ${LONG_WORD} ou inconstitucionalissimamente, que precisam quebrar sem estourar a largura da tela. (Texto fictício de demonstração.)`;
    const newsCategory = await prisma.newsCategory.upsert({
      where: { slug: 'campeonatos-demo' },
      create: { slug: 'campeonatos-demo', name: 'Campeonatos e competições regionais' },
      update: { deletedAt: null, isActive: true }
    });
    const news = [
      {
        slug: 'fenix-conquista-titulo-estadual-demo',
        title:
          'Fênix conquista o título estadual depois de uma virada histórica no tie-break contra as Águias do Norte',
        summary:
          'Em uma final de cinco sets, a equipe feminina virou o placar e levantou a taça diante de um ginásio lotado.',
        isFeatured: true
      },
      {
        slug: 'palavras-gigantes-teste-visual-demo',
        title: `Teste visual: ${LONG_WORD}${LONG_WORD}`,
        summary: `Resumo com uma palavra gigante sem espaços: ${LONG_WORD}${LONG_WORD}${LONG_WORD}.`,
        isFeatured: false
      }
    ];

    for (const [index, item] of news.entries()) {
      await prisma.news.upsert({
        where: { slug: item.slug },
        create: {
          ...item,
          categoryId: newsCategory.id,
          authorUserId: author?.id ?? null,
          content: [
            paragraph('A partida começou equilibrada e o primeiro set terminou em 25 x 23.'),
            paragraph('No segundo set, o saque flutuante mudou o ritmo do jogo.'),
            paragraph('A torcida acompanhou cada ponto até o último ataque pela saída de rede.'),
            `Linha sem espaços para testar quebra: ${'https://exemplo.test/'.repeat(6)}`
          ].join('\n\n'),
          status: 'PUBLISHED',
          showOnHome: true,
          publishedAt: new Date(now.getTime() - (index + 1) * day)
        },
        update: {}
      });
    }

    const events = [
      {
        slug: 'final-copa-acreana-demo',
        title:
          'Final da Copa Acreana de Voleibol Adulto Feminino e Masculino — rodada decisiva com transmissão ao vivo',
        type: 'MATCH' as const,
        status: 'SCHEDULED' as const,
        startsAt: new Date(now.getTime() + 10 * day),
        locationName: 'Ginásio Poliesportivo Governador Jorge Kalume (quadra principal)',
        address: `Avenida Ceará, 1234, bairro Jardim de Allah, Rio Branco — AC. Referência: ${LONG_WORD}.`,
        opponent: 'Associação Desportiva das Águias do Norte Amazônico'
      },
      {
        slug: 'amistoso-solidario-demo',
        title: `Amistoso solidário ${LONG_WORD}`,
        type: 'FRIENDLY' as const,
        status: 'COMPLETED' as const,
        startsAt: new Date(now.getTime() - 5 * day),
        locationName: 'Quadra coberta do bairro',
        address: 'Rua das Acácias, s/n, Rio Branco — AC.',
        opponent: 'Seleção dos Veteranos'
      }
    ];

    for (const item of events) {
      const { opponent, ...data } = item;
      const event = await prisma.event.upsert({
        where: { slug: item.slug },
        create: {
          ...data,
          description: [
            paragraph('Traga a família e chegue com 30 minutos de antecedência.'),
            paragraph('A entrada é gratuita, com arrecadação voluntária de alimentos.')
          ].join('\n\n'),
          endsAt: new Date(item.startsAt.getTime() + 3 * 3_600_000),
          isPublic: true,
          publishedAt: new Date(now.getTime() - 7 * day)
        },
        update: {}
      });

      await prisma.match.upsert({
        where: { eventId: event.id },
        create: {
          eventId: event.id,
          teamId: feminino.id,
          opponentName: opponent,
          competitionName: 'Copa Acreana de Voleibol — fase final',
          ...(item.status === 'COMPLETED' ? { teamScore: 3, opponentScore: 2 } : {})
        },
        update: {}
      });
    }

    const forumCategory = await prisma.forumCategory.upsert({
      where: { slug: 'conversa-geral-demo' },
      create: {
        slug: 'conversa-geral-demo',
        name: 'Conversa geral sobre treinos, jogos e a vida do clube',
        description: 'Espaço aberto para torcedores, atletas e famílias. (demonstração)',
        visibility: 'PUBLIC'
      },
      update: { deletedAt: null, isActive: true }
    });
    const topics = [
      {
        title:
          'Qual foi o ponto mais bonito da final? Vamos relembrar os melhores lances da temporada inteira',
        replies: [
          'O bloqueio triplo no 14 x 13 do tie-break, sem dúvida!',
          paragraph('Para mim foi a defesa de peixinho no segundo set.')
        ]
      },
      {
        title: `Tópico com palavra gigante: ${LONG_WORD}${LONG_WORD}`,
        replies: [`${LONG_WORD}${LONG_WORD}${LONG_WORD}`]
      }
    ];

    for (const item of topics) {
      const exists = await prisma.forumTopic.findFirst({
        where: { categoryId: forumCategory.id, title: item.title, deletedAt: null }
      });

      if (exists) {
        continue;
      }

      await prisma.forumTopic.create({
        data: {
          categoryId: forumCategory.id,
          authorUserId: author?.id ?? null,
          title: item.title,
          visibility: 'PUBLIC',
          status: 'PUBLISHED',
          posts: {
            create: [paragraph('Abro o tópico para a comunidade comentar.'), ...item.replies].map(
              (content) => ({ content, authorUserId: author?.id ?? null })
            )
          }
        }
      });
    }

    // Entrega em casa (DT-075): duas regiões fictícias; só se ainda não houver nenhuma.
    if ((await prisma.deliveryZone.count({ where: { deletedAt: null } })) === 0) {
      const zones = [
        {
          name: 'Centro (demonstração)',
          fee: '8.00',
          leadDays: 1,
          bairros: ['Centro', 'Bosque', 'Base', 'Cadeia Velha']
        },
        {
          name: 'Zona A (demonstração)',
          fee: '12.00',
          leadDays: 2,
          bairros: ['Jardim Europa', 'Estação Experimental', 'Vila Ivonete', 'Floresta']
        }
      ];

      for (const [index, zone] of zones.entries()) {
        await prisma.deliveryZone.create({
          data: {
            name: zone.name,
            fee: D(zone.fee),
            leadDays: zone.leadDays,
            sortOrder: index,
            neighborhoods: {
              create: zone.bairros.map((name) => ({
                name,
                normalizedName: normalizeNeighborhood(name)
              }))
            }
          }
        });
      }

      await prisma.teamSettings.updateMany({
        data: { deliveryEnabled: true, freeDeliveryMinimum: D('250.00') }
      });
    }

    console.log(
      'Dados de demonstração criados (equipes, atletas, plano, seletiva, produtos, remessa, notícias, eventos, fórum e entrega).'
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha ao criar dados de demonstração.');
  process.exitCode = 1;
});
