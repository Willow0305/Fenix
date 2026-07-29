# Índice da documentação

## Fontes

1. [`referencias/documento_requisitos_fenix_volei_melhorado.pdf`](../referencias/documento_requisitos_fenix_volei_melhorado.pdf): fonte original principal dos requisitos.
2. Briefing técnico da primeira entrega: amplia o documento com TypeScript, NestJS, Prisma, segurança, LGPD e organização da Fase 0.
3. Arquivos desta pasta: consolidação rastreável para desenvolvimento.

Quando as fontes divergirem, a divergência é mantida em [`PENDENCIAS.md`](../PENDENCIAS.md) e uma decisão provisória pode ser registrada em [17-DECISOES-TECNICAS.md](./17-DECISOES-TECNICAS.md). Nenhum requisito é removido silenciosamente.

## Ordem recomendada

| Documento | Conteúdo |
|---|---|
| [00-VISAO-GERAL](./00-VISAO-GERAL.md) | contexto, públicos e visão do produto |
| [01-OBJETIVOS-E-ESCOPO](./01-OBJETIVOS-E-ESCOPO.md) | objetivos, limites e entregas |
| [02-REQUISITOS-FUNCIONAIS](./02-REQUISITOS-FUNCIONAIS.md) | capacidades rastreáveis |
| [03-REQUISITOS-NAO-FUNCIONAIS](./03-REQUISITOS-NAO-FUNCIONAIS.md) | atributos de qualidade |
| [04-REGRAS-DE-NEGOCIO](./04-REGRAS-DE-NEGOCIO.md) | políticas e invariantes |
| [05-PERFIS-E-PERMISSOES](./05-PERFIS-E-PERMISSOES.md) | RBAC e acesso |
| [06-FLUXOS-DO-SISTEMA](./06-FLUXOS-DO-SISTEMA.md) | jornadas e transições |
| [07-ARQUITETURA](./07-ARQUITETURA.md) | contêineres, camadas e módulos |
| [08-MODELO-DE-DADOS](./08-MODELO-DE-DADOS.md) | modelo conceitual e lógico |
| [09-DICIONARIO-DE-DADOS](./09-DICIONARIO-DE-DADOS.md) | definição inicial das tabelas |
| [10-API](./10-API.md) | convenções e catálogo REST |
| [11-UX-UI](./11-UX-UI.md) | telas e wireframes textuais |
| [12-IDENTIDADE-VISUAL](./12-IDENTIDADE-VISUAL.md) | marca, tokens e acessibilidade |
| [13-SEGURANCA-E-LGPD](./13-SEGURANCA-E-LGPD.md) | controles e privacidade |
| [14-TESTES](./14-TESTES.md) | estratégia e gates |
| [15-DEPLOY-E-INFRAESTRUTURA](./15-DEPLOY-E-INFRAESTRUTURA.md) | ambientes e operação |
| [16-ROADMAP](./16-ROADMAP.md) | fases e critérios de saída |
| [17-DECISOES-TECNICAS](./17-DECISOES-TECNICAS.md) | registros de decisão |
| [18-ESTUDO-DE-VIABILIDADE](./18-ESTUDO-DE-VIABILIDADE.md) | viabilidade e riscos |
| [19-RELATORIO-FASE-0](./19-RELATORIO-FASE-0.md) | entrega, validações e próximos passos |
| [20-RELATORIO-FASE-1-ADMIN-AUDITORIA](./20-RELATORIO-FASE-1-ADMIN-AUDITORIA.md) | implementação, validações e bloqueios do recorte administrativo da Fase 1 |
| [21-RELATORIO-FINALIZACAO-FASE-1-INICIO-FASES-2-3](./21-RELATORIO-FINALIZACAO-FASE-1-INICIO-FASES-2-3.md) | finalização técnica da Fase 1, primeiras entregas verticais das Fases 2 e 3, migrations, testes e bloqueios |
| [diagramas/ERD](./diagramas/ERD.md) | relacionamentos Mermaid |
| [referencias/schema-conceitual.prisma](./referencias/schema-conceitual.prisma) | visão futura não executável; o schema físico fica em `prisma/schema.prisma` |

## Governança

- dúvidas e bloqueios: [`PENDENCIAS.md`](../PENDENCIAS.md);
- mudanças entregues: [`CHANGELOG.md`](../CHANGELOG.md);
- contribuição: [`CONTRIBUTING.md`](../CONTRIBUTING.md);
- reporte de vulnerabilidade: [`SECURITY.md`](../SECURITY.md);
- regras permanentes de agentes: [`AGENTS.md`](../AGENTS.md).
