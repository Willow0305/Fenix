# Arquitetura

## 1. Estado e propósito

Este documento define a arquitetura de referência da Fase 0. Ele organiza o desenvolvimento incremental, mas não declara os módulos de negócio como implementados.

As decisões vinculantes e seus motivos estão em [17-DECISOES-TECNICAS.md](./17-DECISOES-TECNICAS.md). Questões ainda abertas estão em [`PENDENCIAS.md`](../PENDENCIAS.md).

## 2. Direcionadores

- aplicação web responsiva, com páginas públicas indexáveis e áreas autenticadas;
- regras administrativas, financeiras e de autorização centralizadas no servidor;
- rastreabilidade de operações financeiras e administrativas;
- tratamento adequado de dados pessoais, dados de menores e anexos;
- evolução por módulos sem distribuir prematuramente o sistema em microsserviços;
- portabilidade entre provedores compatíveis com Node.js e PostgreSQL;
- contratos verificáveis por OpenAPI, tipos compartilhados apenas quando não acoplarem camadas;
- modo estrito do TypeScript, validação nas bordas e testes proporcionais ao risco.

## 3. Visão de contexto

```mermaid
flowchart LR
    visitor[Visitante ou interessado]
    athlete[Atleta]
    guardian[Responsável<br/>acesso provisório]
    staff[Diretoria e administração]
    partner[Parceiro autorizado]
    system[Sistema Fênix Vôlei]
    mail[Serviço de e-mail futuro]
    storage[Armazenamento de objetos futuro]
    payment[Gateway de pagamento futuro]

    visitor --> system
    athlete --> system
    guardian -. somente após vínculo e base aprovados .-> system
    staff --> system
    partner -. acesso futuro e restrito .-> system
    system -. notificações .-> mail
    system -. arquivos por URL segura .-> storage
    system -. integração posterior .-> payment
```

Parceiros não recebem acesso administrativo por padrão. O perfil, o contrato de acesso e as permissões dessa audiência permanecem pendentes. Responsável por atleta também não é um perfil autorizado nesta fase: o acesso depende de `PEN-010`, vínculo verificável, escopo e fundamento jurídico.

## 4. Contêineres

```mermaid
flowchart TB
    browser[Navegador]
    web[apps/web<br/>Next.js e React]
    api[apps/api<br/>NestJS e API REST]
    db[(PostgreSQL)]
    objects[(Armazenamento de objetos)]
    email[Provedor de e-mail]
    payments[Gateway de pagamento]

    browser -->|HTTPS| web
    web -->|HTTPS / JSON| api
    browser -. upload direto com URL assinada .-> objects
    api -->|Prisma / conexão TLS| db
    api -. metadados e URLs assinadas .-> objects
    api -. envio assíncrono .-> email
    api -. fase posterior, webhooks assinados .-> payments
```

Na Fase 0, somente os contêineres `web`, `api` e PostgreSQL local possuem esqueleto. Armazenamento, e-mail e pagamentos são fronteiras planejadas, não integrações disponíveis.

## 5. Organização do monorepo

```text
apps/
  web/          interface Next.js
  api/          API NestJS
packages/
  ui/           componentes visuais reutilizáveis e sem regra de negócio
  types/        tipos estáveis e independentes de transporte
  config/       configurações compartilhadas
  validation/   schemas reutilizáveis nas bordas permitidas
prisma/
  schema.prisma modelo lógico inicial
docs/           especificação e decisões
```

O gerenciador escolhido é npm workspaces. Não há Turborepo nesta fase: os scripts raiz são suficientes para o tamanho atual e evitam uma camada operacional sem benefício comprovado.

## 6. Arquitetura do frontend

O esqueleto da Fase 0 utiliza App Router do Next.js conforme a decisão provisória `DT-017` e separa:

- `app/`: rotas, layouts, metadata e composição de páginas;
- `components/`: elementos de apresentação;
- `features/`: interface e orquestração específicas de uma capacidade, quando a implementação começar;
- `services/`: cliente HTTP e adaptadores de browser;
- `styles/`: tokens e estilos globais;
- `utils/`: utilitários puros e pequenos.

Regras:

1. componentes não acessam banco nem implementam regra financeira;
2. autorização visual melhora a experiência, mas não substitui autorização da API;
3. dados vindos da rede são tratados como desconhecidos e validados;
4. enquanto `DT-017` estiver provisória, Server Components são a recomendação para conteúdo público e leitura; Client Components ficam restritos à interação necessária;
5. SCSS Modules isolam estilos de componentes; tokens globais sustentam identidade e acessibilidade;
6. estados de carregamento, vazio, erro e sucesso fazem parte do contrato de cada tela;
7. nenhum dado sensível deve ser colocado em HTML estático, analytics ou logs do navegador.

## 7. Arquitetura do backend

O backend começa como monólito modular. Cada módulo futuro deve manter a seguinte direção:

```mermaid
flowchart LR
    controller[Controller / transporte]
    application[Casos de uso / aplicação]
    domain[Domínio e políticas]
    ports[Portas]
    adapters[Adaptadores Prisma, arquivos, e-mail]

    controller --> application
    application --> domain
    application --> ports
    adapters --> ports
```

- **Transporte:** REST, DTOs, autenticação, serialização e códigos HTTP.
- **Aplicação:** coordena casos de uso, transações e permissões do caso.
- **Domínio:** invariantes e transições de estado, sem dependência de NestJS ou Prisma.
- **Infraestrutura:** Prisma, armazenamento, e-mail e outros adaptadores.

Controllers permanecem finos. Repositórios não decidem regras. Objetos do Prisma não se tornam automaticamente contratos públicos.

## 8. Limites modulares

| Domínio | Capacidades principais | Fase |
|---|---|---:|
| Identidade e acesso | autenticação, sessões, usuários, papéis e permissões | 1 |
| Configurações | dados institucionais, marca, termos e parâmetros | 1 |
| Esportivo | atletas, equipes, categorias, interessados, inscrições e seletivas | 2 |
| Mensalidades | planos, cobranças e pagamentos de mensalidade | 3 |
| Caixa Fênix | contas, categorias, centros de custo, movimentos, conciliação e fechamento | 3 |
| Comércio | catálogo, variações, estoque, carrinho, favoritos, pedidos e pagamentos | 4 |
| Campanhas | remessas, janelas de venda, produção, chegada e retirada | 5 |
| Parceiros | contratos, produtos, profissionais, serviços, agenda e repasses | 6 |
| Conteúdo | notícias, eventos, partidas e publicação relacionada | 7 |
| Comunidade | fórum, reações, denúncias e moderação | 7 |
| Plataforma | arquivos, notificações, auditoria, relatórios e observabilidade | transversal |

Dependências entre domínios ocorrem por identificadores e casos de uso explícitos. Um módulo não consulta tabelas internas de outro para contornar sua política.

## 9. Consistência e transações

Operações que alterem mais de uma responsabilidade crítica devem ter fronteira transacional no backend. Exemplos futuros:

- confirmar mensalidade + registrar pagamento + criar entrada financeira;
- confirmar pedido + registrar pagamento + criar entrada + efetivar movimento de estoque;
- reembolsar pagamento + criar saída vinculada + atualizar o estado permitido;
- transferir entre contas + criar as duas pernas vinculadas da transferência.

O lançamento contábil/gerencial não será atualizado silenciosamente por edição destrutiva. Correções geram novos fatos vinculados, motivo e auditoria. Efeitos externos, como e-mail, serão disparados depois da confirmação da transação; uma caixa de saída transacional será avaliada quando as notificações forem implementadas.

## 10. Modelo de dados

- PostgreSQL é a fonte transacional de verdade.
- Prisma é o ORM e o mecanismo de migrations futuro.
- Identificadores principais usam UUID.
- Instantes usam UTC; datas civis usam `DATE`.
- Dinheiro usa `Decimal`/`NUMERIC`, acompanhado de moeda.
- Exclusão lógica é aplicada onde apagar quebraria histórico ou auditoria.
- Saldo é derivado de movimentações; valores de abertura são eventos controlados, não atalhos editáveis.
- Arquivos ficam fora do banco; somente metadados, hash/chave e localização segura são persistidos.

O detalhamento está em [08-MODELO-DE-DADOS.md](./08-MODELO-DE-DADOS.md), [09-DICIONARIO-DE-DADOS.md](./09-DICIONARIO-DE-DADOS.md) e [diagramas/ERD.md](./diagramas/ERD.md).

## 11. Segurança

Defesa em profundidade:

1. HTTPS em qualquer ambiente exposto;
2. autenticação planejada com sessão revogável, access token curto e refresh rotacionável, ainda condicionada à decisão provisória `DT-012`;
3. autorização por permissão em cada caso de uso administrativo;
4. validação e normalização de entrada no DTO e no domínio;
5. queries parametrizadas pelo Prisma e restrições no banco;
6. CORS por lista explícita e headers seguros;
7. proteção contra força bruta e rate limiting por risco;
8. segredos somente em cofre/ambiente;
9. uploads validados e servidos por acesso controlado;
10. logs estruturados, sem segredo ou dado pessoal desnecessário;
11. auditoria separada de observabilidade operacional;
12. backup criptografado e restauração testada antes da produção.

Detalhes e pendências jurídicas estão em [13-SEGURANCA-E-LGPD.md](./13-SEGURANCA-E-LGPD.md).

## 12. API e contratos

- REST versionada sob `/api/v1`;
- OpenAPI gerado e revisado como contrato;
- JSON em `camelCase`;
- UUID como string, data civil em `YYYY-MM-DD`, instante ISO 8601 UTC;
- dinheiro serializado como string decimal e moeda separada;
- erros no formato Problem Details, com código estável e identificador de correlação;
- idempotência obrigatória para confirmações financeiras e webhooks;
- paginação e filtros com limites defensivos;
- nenhuma resposta administrativa expõe campos privados por conveniência.

O inventário planejado e o único endpoint técnico da Fase 0 constam em [10-API.md](./10-API.md).

## 13. Observabilidade e auditoria

Observabilidade operacional e auditoria têm objetivos diferentes:

- **logs e métricas:** saúde, latência, taxa de erro e capacidade, com retenção operacional;
- **traces/correlation ID:** caminho de uma requisição entre web, API e integrações;
- **auditoria:** quem executou uma ação sensível, quando, por qual motivo e qual entidade foi afetada.

Auditoria não deve copiar senha, token, comprovante ou payload pessoal completo. Campos anteriores/novos exigem minimização e mascaramento por domínio.

## 14. Implantação

O frontend e a API são unidades implantáveis separadas. PostgreSQL gerenciado e armazenamento de objetos privado formam a **topologia de referência recomendada**, não uma escolha aprovada de provedor ou hospedagem; `DT-018`, `PEN-042` e `PEN-048` mantêm essa decisão provisória. O Docker Compose da Fase 0 serve apenas ao PostgreSQL de desenvolvimento. Imagens de produção, CI/CD, região, provedor e objetivos de recuperação dependem das decisões listadas em `PENDENCIAS.md`.

## 15. Restrições desta fase

Não fazem parte da Fase 0:

- autenticação funcional;
- módulos de atletas, mensalidades, Caixa, loja, fórum ou agendamento;
- upload em nuvem;
- envio real de e-mail;
- checkout, PIX automatizado ou gateway;
- migrations de produção;
- dados iniciais de negócio.

O endpoint de saúde e a página mínima existem somente para validar o esqueleto e a cadeia de ferramentas.
