# Objetivos e escopo

## Objetivo geral

Disponibilizar uma aplicação web responsiva, segura e continuamente acessível para administrar as atividades do Time Fênix de Vôlei, integrando processos institucionais, esportivos, financeiros, comerciais e de comunicação sem perder rastreabilidade.

## Objetivos específicos

| Objetivo | Resultado verificável |
|---|---|
| Profissionalizar a gestão | Cadastros e mudanças críticas ficam centralizados, autorizados e auditáveis. |
| Facilitar inscrições | Interessados concluem cadastro geral ou inscrição em seletiva ativa e recebem um status consultável. |
| Organizar atletas e equipes | A diretoria mantém dados, situação e histórico de vínculos do atleta com equipes/categorias. |
| Controlar mensalidades | Cobranças possuem referência, vencimento, situação, pagamentos e histórico. |
| Profissionalizar o financeiro | Caixa Fênix deriva saldos de movimentações, integra origens e permite conferência/fechamento. |
| Organizar vendas | Produtos, variações, estoque/remessas, pedidos, pagamentos e retiradas ficam rastreáveis. |
| Ampliar parcerias | Parceiros aprovados podem ter produtos, serviços, profissionais e regras de repasse documentadas. |
| Melhorar comunicação | Notícias, eventos, partidas e fórum evitam duplicação desnecessária e respeitam visibilidade/moderação. |
| Dar transparência ao usuário | Cada usuário autorizado consulta apenas dados e operações do seu contexto. |
| Apoiar decisões | Relatórios mostram atletas, inscrições, inadimplência, vendas, caixa, parceiros e pendências. |

## Escopo funcional consolidado

Os 28 módulos solicitados são:

| Grupo | Módulos |
|---|---|
| Identidade e acesso | Autenticação e usuários; perfis e permissões; configurações do time |
| Esportivo/cadastro | Atletas; equipes e categorias; inscrições; seletivas; interessados |
| Financeiro | Mensalidades; Caixa Fênix; pagamentos; arquivos e comprovantes |
| Comércio | Loja; produtos e variações; estoque; remessas e campanhas; carrinho; favoritos; pedidos |
| Ecossistema | Parceiros; profissionais parceiros; serviços e agendamentos |
| Comunicação | Fórum; notícias; eventos e partidas; notificações |
| Governança | Relatórios; auditoria |

O detalhamento obrigatório está nos requisitos e regras associados. A presença de um módulo no escopo do produto não autoriza sua implementação fora da fase indicada em `16-ROADMAP.md`.

## Escopo por horizonte

### Fase 0 — entrega atual

- analisar fontes e repositório;
- consolidar documentação e pendências;
- registrar arquitetura, modelo e decisões;
- criar esqueleto do monorepo e ferramentas básicas;
- preparar PostgreSQL em Docker e contrato de ambiente;
- validar inicialização, lint, testes iniciais e build.

Não serão implementados fluxos de negócio completos nesta fase.

### Produto incremental

As Fases 1 a 8 entregam, em ordem, acesso/administração básica; atletas/inscrições; mensalidades/caixa; loja; remessas; parceiros; comunicação; e otimizações/governança. Cada fase depende do aceite da anterior.

## Fora do escopo vigente

| Item | Tratamento |
|---|---|
| Aplicativo móvel nativo | Fora do escopo inicial; a aplicação web deve ser responsiva. |
| Scout, estatísticas avançadas e gestão detalhada de treinos | Possível fase futura, sem requisito aprovado. |
| Marketplace aberto | Proibido no escopo inicial; apenas parceiros cadastrados e aprovados. |
| Prontuário médico | Fora do escopo até decisão jurídica, técnica e de segurança. |
| Armazenamento de dados de cartão | Não permitido. Um eventual gateway deve tokenizar/processar fora do sistema. |
| Produto digital | Possibilidade futura citada no briefing; não implementar sem detalhamento e inclusão no roadmap. |
| Avaliação de profissionais | Somente “caso autorizado”; permanece fora das fases atuais até decisão. |
| Integrações externas reais na Fase 0 | Não implementar, incluindo gateway, e-mail transacional e armazenamento em nuvem real. |

## Restrições obrigatórias

- Front-end com Next.js, React, TypeScript estrito, HTML semântico e SCSS Modules.
- Back-end Node.js/TypeScript, API REST e arquitetura modular profissional.
- PostgreSQL com Prisma ORM.
- UUID em todas as tabelas, inclusive associações com identidade própria.
- Dinheiro em `Decimal`/`NUMERIC`, nunca `float`/`double`.
- Instantes em UTC e datas civis em `DATE`.
- Variáveis sensíveis somente no ambiente; `.env` nunca versionado.
- Autorização administrativa validada no servidor.
- Uploads fora do banco, com metadados, integridade, validação e acesso protegido.
- Mudanças sensíveis e financeiras com autoria, instante, motivo e histórico permitido pela LGPD.
- TypeScript sem `any`, salvo exceção inevitável justificada no código e em decisão técnica.

## Dependências de negócio

| Dependência | Módulos afetados |
|---|---|
| Plano de categorias, contas e centros de custo | Caixa Fênix, mensalidades, loja, parceiros e relatórios |
| Política de pagamento manual/PIX e eventual automação | Mensalidades, pedidos, Caixa Fênix e notificações |
| Política de anexos e retenção | Comprovantes, parceiros, atletas, auditoria e LGPD |
| Regras de aprovação, repasse e responsabilidade | Parceiros, produtos, serviços, agendamentos e financeiro |
| Regras de moderação e visibilidade | Fórum, notícias, notificações e auditoria |
| Vínculo e representação de menores | Atletas, responsáveis, inscrições, consentimento e acesso |
| Paleta e variantes oficiais de logo | Site público, painéis, loja, notícias e configurações |

## Critérios de aceite de escopo

Uma entrega está dentro do escopo quando:

1. corresponde a requisito versionado e à fase vigente;
2. não reduz nem redefine requisito canônico;
3. explicita decisões provisórias e dependências;
4. possui autorização, validações, erros seguros e testes proporcionais ao risco;
5. mantém rastreabilidade entre requisito, regra, fluxo, permissão e teste;
6. passa pelos gates de lint, testes e build descritos no repositório.

## Controle de mudança

Qualquer inclusão, remoção ou redefinição de requisito deve:

1. indicar a fonte e o motivo;
2. avaliar impactos em dados, segurança, LGPD, UX, testes e roadmap;
3. receber aprovação explícita;
4. ser registrada em `CHANGELOG.md` e `17-DECISOES-TECNICAS.md`;
5. atualizar documentos e matriz de rastreabilidade relacionados.

## Pontos provisórios sem decisão de negócio

- campos obrigatórios exatos de atleta e inscrição pública;
- política de descontos, multas, juros, pagamentos parciais e tolerância;
- momento de reserva e baixa definitiva de estoque;
- expiração e recuperação de carrinho de visitante;
- quantidade mínima/máxima padrão de campanhas;
- regras e prazo de reembolso de campanha;
- modelo contratual, comissão, repasse e responsabilidade de parceiro;
- disponibilidade, antecedência e cancelamento de agendamento;
- quem pode publicar/interagir em cada categoria do fórum;
- vínculo e poderes de responsáveis por atletas, sobretudo menores;
- prazos de retenção por categoria de dado e arquivo;
- metas quantitativas de disponibilidade, desempenho e recuperação.

Esses pontos não devem ser preenchidos por suposição durante a implementação.

