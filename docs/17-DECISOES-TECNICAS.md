# Decisões técnicas

## Como registrar

Cada decisão usa um identificador estável, estado, contexto, decisão e consequências.

Estados:

- **Aceita:** base da arquitetura; mudança exige nova decisão.
- **Provisória:** suficiente para a Fase 0, mas depende de validação.
- **Proposta:** ainda não orienta implementação funcional.
- **Substituída:** mantida para histórico e apontada para a decisão nova.

## DT-001 — Monorepo com npm workspaces

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

Web, API e pacotes compartilhados precisam evoluir juntos. A equipe ainda é pequena e não há evidência de que cache remoto ou orquestração avançada reduzam custo.

### Decisão

Usar npm workspaces com `apps/*` e `packages/*`. Scripts raiz coordenam lint, testes e build. Não adotar Turborepo nesta fase.

### Consequências

- instalação única e lockfile único;
- menor número de ferramentas;
- comandos podem ser paralelizados futuramente;
- Turborepo pode ser avaliado quando tempo de CI ou grafo de tarefas justificar.

## DT-002 — Monólito modular com web e API separadas

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

O domínio é amplo, mas a primeira entrega e a equipe não justificam microsserviços. Frontend e backend possuem ciclos e superfícies de ataque diferentes.

### Decisão

Manter dois aplicativos implantáveis: Next.js em `apps/web` e NestJS em `apps/api`. O backend é um monólito modular com limites por domínio.

### Consequências

- transações financeiras permanecem simples e atômicas;
- módulos podem ser testados separadamente sem operação distribuída;
- extração futura exige evidência de escala, segurança ou autonomia, não apenas tamanho de pasta.

## DT-003 — TypeScript estrito em toda a aplicação

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

O PDF original menciona JavaScript, enquanto o briefing da entrega exige TypeScript e proíbe `any` não justificado.

### Decisão

Usar TypeScript com `strict` em web, API e pacotes. JavaScript fica restrito a configurações incompatíveis com TypeScript ou scripts pequenos justificados.

### Consequências

- a diretriz mais segura e mais recente prevalece tecnicamente;
- contratos, nulos e refinamento nas bordas precisam ser explícitos;
- a divergência com o PDF é preservada em `PENDENCIAS.md`, não apagada.

## DT-004 — NestJS para a API REST

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

O briefing permite NestJS ou arquitetura profissional equivalente. O domínio exige módulos, injeção de dependência, validação, guards e OpenAPI.

### Decisão

Usar NestJS com controllers finos, camada de aplicação, domínio independente e adaptadores. A API inicial é REST.

### Consequências

- convenções explícitas para módulos e testes;
- `class-validator` valida DTOs de transporte;
- entidades Prisma e DTOs não são o mesmo contrato;
- GraphQL só será considerado diante de necessidade demonstrada.

## DT-005 — PostgreSQL e Prisma

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

Financeiro, estoque, pagamentos e permissões exigem integridade relacional e transações.

### Decisão

Usar PostgreSQL e Prisma ORM. Migrations serão versionadas a partir da fase de implementação. Todas as entidades persistidas usam UUID; relações e políticas de exclusão são explícitas.

### Consequências

- o banco reforça invariantes que não dependem apenas da aplicação;
- SQL específico pode ser usado em migrations justificadas para constraints que o Prisma não expressar;
- `db push` não será usado para mudança de produção.

## DT-006 — Dinheiro como Decimal/Numeric

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

O SQL do PDF sugere centavos inteiros em vários pontos; o briefing determina `Decimal/Numeric` e proíbe `float`.

### Decisão

Persistir valores monetários como `Decimal` no Prisma e `NUMERIC` no PostgreSQL. O contrato REST transporta valor como string decimal e moeda separada.

### Consequências

- não há erro binário de ponto flutuante;
- escala e arredondamento serão definidos por caso de uso antes da Fase 3;
- cálculos usam biblioteca/tipo decimal, nunca `number`;
- a divergência documental permanece rastreada.

## DT-007 — RBAC normalizado por permissões

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

O PDF traz um campo único de papel; o briefing exige `Role`, `Permission`, `UserRole` e `RolePermission`.

### Decisão

Usar RBAC com usuários podendo receber múltiplos papéis e papéis agrupando permissões. A API autoriza por permissão específica.

### Consequências

- atende diretoria, administração, atleta e funções futuras sem enum rígido;
- a matriz inicial precisa de aprovação;
- mudanças de papel/permissão são auditadas;
- negações explícitas e escopo por registro não serão adicionados sem necessidade.

## DT-008 — Datas em UTC e datas civis separadas

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

Instantes como pagamento e publicação precisam ser comparáveis; nascimento, competência e vencimento são conceitos civis.

### Decisão

Armazenar instantes como timezone-aware/UTC e serializar com `Z`. Armazenar datas civis como `DATE`, sem conversão de fuso. A zona operacional do time será configurável.

### Consequências

- evita deslocamento acidental de data;
- agendamentos exigem zona de origem e conversão explícita;
- a zona operacional ainda precisa ser confirmada.

## DT-009 — Exclusão lógica e histórico financeiro imutável

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

Cadastros referenciados, conteúdo moderado e registros financeiros precisam preservar rastreabilidade.

### Decisão

Preferir `deletedAt` em agregados relevantes. Movimentos financeiros confirmados, pagamentos, fechamentos, estornos e auditoria não são apagados pela aplicação. Correção cria evento ou movimento relacionado.

### Consequências

- consultas comuns precisam filtrar exclusão lógica;
- unicidade com registros excluídos pode exigir índice parcial em migration SQL;
- retenção LGPD deve combinar restrição, anonimização e obrigação legal, sem prometer apagamento incompatível com auditoria.

## DT-010 — Arquivos em object storage

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

Logos, imagens e comprovantes podem crescer, exigem controle de acesso e não devem inflar o banco.

### Decisão

Persistir no PostgreSQL somente metadados, chave do objeto, hash e classificação. Conteúdo fica em armazenamento externo privado; acesso usa URL assinada quando necessário. A pasta `uploads/` é apenas convenção local e não armazenamento de produção.

### Consequências

- provedor, antivírus, limites e retenção precisam ser escolhidos;
- backups incluem banco e objetos;
- referências nunca usam URL pública permanente para comprovantes privados.

## DT-011 — OpenAPI e formato uniforme de erros

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

Web e API são unidades separadas e precisam de contrato testável.

### Decisão

Gerar OpenAPI a partir da API NestJS e usar Problem Details com código de erro estável, `requestId` e erros de campo.

### Consequências

- breaking changes ficam visíveis;
- exemplos não podem conter dados reais;
- geração de cliente só será adicionada quando o contrato da Fase 1 estabilizar.

## DT-012 — Autenticação com sessão revogável e refresh rotativo

- **Estado:** Provisória
- **Data:** 2026-07-23

### Contexto

O briefing pede JWT e refresh token. A topologia final de domínios ainda não foi escolhida.

### Decisão

Planejar access token curto e refresh token rotativo, revogável e armazenado como hash no banco. Preferir cookie `HttpOnly`, `Secure` e `SameSite` compatível com a topologia para o refresh; manter access token fora de armazenamento persistente do browser.

### Consequências

- exige tabela de sessões, detecção de reutilização e proteção CSRF adequada;
- formato do refresh token (opaco ou JWT identificável), duração, domínio de cookie, transporte e estratégia exata dependem do deploy e de `PEN-013`/`PEN-043`;
- até a aprovação, os demais documentos devem tratar essa topologia como recomendação condicional, não contrato definitivo;
- não há autenticação implementada na Fase 0.

## DT-013 — Operações críticas síncronas na mesma transação

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

Pagamento, estoque e Caixa não podem divergir por processamento parcial.

### Decisão

Manter alterações internas críticas em uma transação PostgreSQL coordenada pela aplicação. Integrações externas ocorrem após commit. Avaliar outbox transacional quando notificações e webhooks forem implementados.

### Consequências

- consistência forte dentro do monólito;
- chamadas externas não ficam dentro de transação longa;
- consumidores futuros devem ser idempotentes.

## DT-014 — Paleta da marca provisória

- **Estado:** Provisória
- **Data:** 2026-07-23

### Contexto

O PDF define vermelho `#B80012` e escuro `#7A000A`; o briefing da entrega sugere `#C8102E` e `#8F001A`.

### Decisão

Usar provisoriamente os tokens mais recentes do briefing (`#C8102E` e `#8F001A`) no esqueleto, preservar a paleta do PDF como referência histórica e pedir validação da diretoria.

### Consequências

- a troca futura fica centralizada em tokens;
- nenhuma arte é modificada;
- a identidade da parceria Floresta não compõe a marca principal.

## DT-015 — Estratégia inicial de testes

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

A Fase 0 precisa comprovar que o esqueleto é executável sem criar testes fictícios de domínio.

### Decisão

Manter testes unitários mínimos da página/base e do endpoint de saúde. Nas fases seguintes, aplicar pirâmide de testes, integração real com PostgreSQL para persistência, contratos da API e E2E para fluxos críticos.

### Consequências

- cobertura numérica isolada não define pronto;
- finanças, autorização e transições exigem casos negativos e concorrentes;
- lint, testes e build são gates obrigatórios.

## DT-016 — Relações editoriais em vez de duplicação

- **Estado:** Proposta
- **Data:** 2026-07-23

### Contexto

Uma partida ou evento pode aparecer em notícias, calendário, página inicial, fórum e notificações.

### Decisão proposta

Manter `News`, `Event` e `Match` como entidades próprias com vínculos opcionais e projeções de publicação, evitando copiar manualmente título, data e local entre módulos.

### Consequências

- uma correção pode refletir nos canais relacionados;
- regras de publicação e arquivamento precisam ser definidas na Fase 7;
- a decisão será confirmada antes do schema de produção desse módulo.

## DT-017 — Next.js App Router e preferência por Server Components

- **Estado:** Provisória
- **Data:** 2026-07-23

### Contexto

O esqueleto web da Fase 0 precisa validar roteamento, metadata, conteúdo público indexável e limites claros entre execução no servidor e interação no navegador.

### Decisão provisória

Usar o App Router do Next.js no esqueleto. Preferir Server Components para composição e leitura, especialmente em conteúdo público, e introduzir Client Components somente onde estado ou interação no navegador forem necessários.

### Consequências

- reduz JavaScript no cliente quando a jornada permitir;
- dados sensíveis continuam sujeitos a autorização na API e não podem ser embutidos em HTML estático;
- cache, rendering e fronteiras servidor/cliente devem ser reavaliados com os fluxos reais da Fase 1;
- a decisão será confirmada antes de estabilizar a arquitetura funcional do frontend.

## DT-018 — Topologia gerenciada de produção como referência

- **Estado:** Proposta
- **Data:** 2026-07-23

### Contexto

A aplicação precisa de hospedagem para web e API, PostgreSQL, armazenamento de objetos, e-mail, observabilidade e recuperação, mas provedor, região, orçamento e escala ainda não foram aprovados.

### Decisão proposta

Usar como referência de avaliação web e API implantáveis separadamente, PostgreSQL gerenciado, armazenamento de objetos privado e serviços observáveis. A referência não escolhe fornecedor nem autoriza produção; a decisão final depende de `PEN-042`, `PEN-044` e `PEN-048`.

### Consequências

- o desenvolvimento evita acoplamento desnecessário a um único provedor;
- custos, região, backups, rede, limites e responsabilidades precisam ser comparados antes do staging;
- Docker Compose permanece ferramenta local, não desenho de produção;
- o documento de infraestrutura deve identificar a topologia como recomendação provisória.

## DT-019 — Resolução temporária de dependências vulneráveis da toolchain

- **Estado:** Provisória
- **Data:** 2026-07-23

### Contexto

Na validação da Fase 0, `npm audit` identificou versões vulneráveis de `postcss` e `sharp` trazidas pela versão corrente do Next.js, além de uma versão vulnerável de `shell-quote` na linha mais recente do executor local de processos. A versão estável disponível do Next.js ainda declarava as dependências afetadas.

### Decisão provisória

Fixar `postcss` e `sharp` em versões corrigidas por `overrides` no workspace raiz e declarar as mesmas versões diretamente para que o npm 11 gere uma única resolução segura no lockfile. Manter o Next.js como dependência funcional de `apps/web` e também como restrição de resolução na raiz enquanto esse comportamento for necessário. Usar temporariamente a linha segura `9.x` de `concurrently`.

### Consequências

- `npm audit`, testes e build precisam passar após toda atualização do lockfile;
- a duplicidade declarativa de Next.js não representa um segundo runtime instalado;
- os overrides devem ser removidos quando uma versão estável do Next.js trouxer dependências corrigidas e uma instalação limpa confirmar a resolução;
- upgrades não podem aplicar automaticamente o downgrade incompatível sugerido pelo auditor como correção de segurança.

## DT-020 — Resolução de módulos Node16 no backend

- **Estado:** Aceita
- **Data:** 2026-07-23

### Contexto

O valor histórico `moduleResolution: "Node"` é interpretado pelo TypeScript como `node10`. Essa estratégia foi descontinuada e deixará de funcionar no TypeScript 7. O backend NestJS continua emitindo CommonJS por ser executado como um pacote Node sem `"type": "module"`.

### Decisão

Usar o par coerente `module: "Node16"` e `moduleResolution: "Node16"` na configuração TypeScript compartilhada do NestJS. Não silenciar a depreciação com `ignoreDeprecations`.

### Consequências

- a resolução do backend acompanha as regras modernas de pacotes do Node;
- o JavaScript emitido permanece CommonJS enquanto `apps/api/package.json` não declarar outro tipo;
- uma migração futura para ESM exigirá decisão própria e revisão de imports, execução, Jest e artefatos;
- o teste de configuração resolve o `apps/api/tsconfig.json` pela API do TypeScript e impede regressão para `node10`.

## DT-021 — Aceite da Fase 0 e responsável único

- **Estado:** Aceita
- **Data:** 2026-10-18

### Contexto

A Fase 0 estava tecnicamente concluída, mas dependia de `PEN-001` e `PEN-002`. O responsável do projeto informou ser, por ora, a única pessoa envolvida e autorizou a continuidade até a aplicação completa, delegando decisões técnicas ao agente.

### Decisão

Aceitar a baseline documental v1.2, registrar o responsável único para todas as áreas e autorizar as fases 1 a 8 em sequência, mantendo os gates técnicos (lint, testes e build) de cada fase.

### Consequências

- cada fase continua entregue de forma incremental, com changelog e decisões;
- pendências jurídicas (menores, retenção, políticas) seguem abertas como gate de **produção com dados reais**, não de desenvolvimento;
- quando houver mais pessoas, as permissões separáveis permitem segregar funções sem refatoração.

## DT-022 — Implementação de autenticação, sessões e RBAC

- **Estado:** Aceita
- **Data:** 2026-10-18

### Contexto

`DT-012` deixou duração, formato e topologia em aberto.

### Decisão

- senha com `scrypt` nativo do Node (N=2^15, r=8, p=1, sal aleatório de 16 bytes, formato versionado) e comparação em tempo constante;
- access token JWT HS256 de 15 minutos, assinado com `AUTH_ACCESS_TOKEN_SECRET`, contendo apenas `sub` e `sid`; permissões são recarregadas do banco a cada requisição para revogação imediata;
- refresh token opaco de 32 bytes, guardado como SHA-256 em `user_sessions`, entregue em cookie `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`, `Secure` fora de desenvolvimento; validade de 30 dias;
- cada uso rotaciona a sessão; reuso de token já rotacionado revoga todas as sessões do usuário;
- o navegador fala com uma única origem: o Next.js reescreve `/api/v1/*` para a API;
- papéis de sistema `admin`, `board`, `athlete` e `user`; autorização por permissão granular via decorator `@RequirePermissions`;
- rate limiting por IP em login, cadastro e recuperação.

### Consequências

- logout e troca de senha revogam sessões imediatamente;
- CSRF mitigado por `SameSite=Strict`, cookie restrito ao caminho de autenticação e validação de `Origin` no refresh;
- MFA para perfis privilegiados continua necessário antes de produção (`PEN-013`).

## DT-023 — Organização interna dos módulos da API

- **Estado:** Aceita
- **Data:** 2026-10-18

### Contexto

`07-ARQUITETURA.md` pede limites entre transporte, aplicação, domínio e infraestrutura sem burocracia desnecessária.

### Decisão

Cada módulo em `apps/api/src/modules/<modulo>` contém:

- `domain/`: funções e políticas puras (transições de estado, cálculos monetários, invariantes), sem NestJS nem Prisma, com testes unitários;
- `application/`: serviços de caso de uso que orquestram transação, autorização contextual, auditoria e chamam o domínio; acessam dados pelo `PrismaService` injetado (infraestrutura compartilhada);
- `http/`: controllers finos e DTOs com `class-validator`.

Repositórios dedicados só são criados quando a consulta for reutilizada por mais de um caso de uso ou quando houver necessidade de troca de adaptador.

### Consequências

- regras de negócio testáveis sem banco;
- menos camadas de repasse; o acoplamento a Prisma fica limitado à aplicação;
- testes de integração com PostgreSQL cobrem as consultas.

## DT-024 — Adaptadores locais de e-mail e armazenamento

- **Estado:** Provisória
- **Data:** 2026-10-18

### Contexto

Provedores de e-mail e objetos ainda não foram escolhidos (`PEN-042`).

### Decisão

Definir portas `MailSender` e `ObjectStorage`. Em desenvolvimento, e-mails são gravados como arquivos em `var/mail-outbox/` e objetos em `var/storage/`, ambos ignorados pelo Git. Nenhum token ou conteúdo de e-mail vai para logs. Uploads validam tamanho, extensão e assinatura binária real (PNG, JPEG, WebP, PDF); SVG não é aceito.

### Consequências

- trocar por SMTP/S3 exige apenas um novo adaptador;
- em produção, os adaptadores locais são recusados na inicialização, salvo opt-in explícito.

## DT-025 — Paginação por offset limitada

- **Estado:** Provisória
- **Data:** 2026-10-18

### Decisão

Listas administrativas usam `page`/`pageSize` (máximo 100) e retornam `{ data, meta: { page, pageSize, total } }`. Os volumes previstos são pequenos; cursor pode ser adotado por endpoint quando medição justificar (`PEN-049`).

## DT-026 — Menores de idade

- **Estado:** Provisória (requer revisão jurídica antes de dados reais)
- **Data:** 2026-10-18

### Decisão

Conta própria somente com declaração de idade mínima de 12 anos. Cadastro de atleta calcula a idade pela data de nascimento: menor de 18 exige nome e telefone do responsável; menor de 12 exige ainda a confirmação de ciência do responsável e só é feito pela diretoria. Nenhum dado de saúde é coletado.

## DT-027 — Mensalidades sem encargos automáticos e com pagamento parcial

- **Estado:** Aceita
- **Data:** 2026-10-18

### Decisão

Mensalidade preserva o valor do plano no momento da geração; chave única atleta + mês de referência. Não há multa ou juros automáticos; desconto/isenção é ajuste manual motivado e auditado. Pagamentos parciais são somados; a cobrança passa a `PAID` quando a soma confirmada atinge o valor devido; excedente é rejeitado. Cada pagamento confirmado gera exatamente uma entrada no Caixa (idempotente por pagamento). Atraso é derivado da data de vencimento.

## DT-028 — Modelo de recrutamento: interessados e inscrições em seletiva

- **Estado:** Aceita
- **Data:** 2026-10-18

### Contexto

O schema possui `InterestedPerson`, `Registration` (inscrição geral) e `TryoutRegistration`. `PEN-016` recomenda manter entidades separadas e conversão explícita.

### Decisão

- "Quero jogar no Fênix" grava `InterestedPerson`; inscrição em seletiva grava `TryoutRegistration`. Nenhum dos dois cria conta ou atleta;
- a tabela `Registration` (inscrição geral sem seletiva) permanece reservada no schema, sem endpoint, porque o fluxo de interessado cobre o caso sem duplicar dados;
- conversão em atleta é uma ação da diretoria que recebe os dados completos revisados e grava a origem (`InterestedPerson`/`TryoutRegistration`) na auditoria do atleta criado;
- estados e transições seguem `sports-rules.ts`; recusa e cancelamento exigem motivo; "não compareceu" foi incluído como estado (`RN-ATL-003`);
- inscrição pública registra versão do aviso de privacidade e instante do consentimento; menores de 12 não se inscrevem publicamente (`DT-026`);
- vagas são verificadas em transação serializável; conflito concorrente responde 409.

### Consequências

- `Registration` pode ser ativada no futuro sem migração;
- atletas convertidos mantêm rastreabilidade até a inscrição de origem.

## DT-029 — Notificações internas idempotentes

- **Estado:** Aceita
- **Data:** 2026-10-18

### Decisão

`NotificationsService.notify` grava notificações in-app com `deduplicationKey` única por usuário (`createMany ... skipDuplicates`), permitindo chamar o mesmo evento mais de uma vez sem duplicar. Mensagens não carregam dados de terceiros; o link é relativo à área do usuário. E-mail transacional permanece pendente de provedor (`PEN-040`).

## DT-030 — Livro-caixa, pagamentos e fechamento

- **Estado:** Aceita
- **Data:** 2026-10-18

### Contexto

Fase 3 exige saldo derivado, confirmação idempotente, histórico imutável e bloqueio de períodos (RN-FIN-001..012, RF-025..030).

### Decisão

- todo lançamento passa por `LedgerService.post`, que valida conta/categoria ativas, natureza da categoria × direção, moeda da conta e período fechado;
- valores são `Decimal` (armazenados em `NUMERIC(19,4)`), recebidos e devolvidos como string com 2 casas; arredondamento half-up;
- operações financeiras exigem o cabeçalho `Idempotency-Key`; o mesmo autor reenviando a mesma chave recebe o resultado original, outro autor recebe 409;
- alterações concorrentes na mesma mensalidade, pagamento, lançamento, conta ou obrigação são serializadas com `SELECT … FOR UPDATE` dentro da transação;
- pagamento é criado `PENDING`; confirmá-lo cria exatamente um lançamento (`payment_id` único) na conta escolhida; estorno de pagamento confirmado cria `Refund` e lançamento oposto vinculado (`reverses_transaction_id`, origem `REFUND`); pendente é apenas cancelado;
- lançamento confirmado nunca é cancelado nem editado; correção é estorno datado de hoje; estorno de estorno e estorno duplo são recusados; transferências e lançamentos de pagamento só são corrigidos pelos fluxos de origem;
- a data contábil de filtro e de fechamento é o dia civil de `occurred_at` no fuso do time;
- fechamento por conta/período: saldo esperado = soma assinada dos confirmados até o fim do período; exige zero pendências no período; bloqueia confirmar/criar movimentos datados no período; reabertura exige `cash.reopen` e motivo; refechar atualiza o mesmo registro e a auditoria guarda os valores anteriores;
- saldo inicial é um lançamento `OPENING_BALANCE` único por conta;
- plano de contas provisório semeado por código (`finance-catalog.ts`); categorias de sistema não podem ser inativadas (`PEN-020` segue aberta para validação contábil).

### Consequências

- `npm run db:seed` também semeia contas, categorias e formas de pagamento padrão;
- a área do atleta permite enviar comprovante PIX, que vira pagamento pendente com anexo confidencial.

## DT-031 — Loja: estoque por razão, reserva, pedido e visitante

- **Estado:** Aceita
- **Data:** 2026-10-18

### Decisão

- estoque é derivado de `inventory_movements`; não existe quantidade editável. Disponível = soma dos deltas; reservado = reservas não liberadas;
- checkout trava as variações (`FOR UPDATE`, em ordem de id), revalida preço, disponibilidade, janela de venda, limite por comprador e limites de remessa, cria o pedido com itens congelados (nome, SKU, variação, preço) e registra `RESERVATION` por item de pronta entrega — tudo em uma transação;
- reservas expiram após `STORE_RESERVATION_HOURS` (padrão 72 h) sem pagamento e sem comprovante em análise; uma rotina interna a cada 10 min e um endpoint administrativo cancelam e liberam o estoque;
- "pedido confirmado" (RF-016) = pagamento confirmado: a reserva vira `RELEASE` + `STOCK_OUT` (efeito líquido zero no disponível, saída registrada) e a venda gera uma entrada única no Caixa (categoria vendas da loja ou de parceiros, origem `ORDER`);
- `PAID` só é alcançado pela confirmação do pagamento; cancelar pedido pago exige `payments.correct`, estorna os pagamentos com reembolso vinculado e, opcionalmente, devolve ao estoque (`RETURN`);
- pedido de visitante exige nome, e-mail, telefone e aceite; a consulta usa número + código secreto (hash no banco) enviados por e-mail, nunca na URL; a chave PIX só aparece para o dono do pedido aguardando pagamento;
- carrinho fica no servidor (usuário ou visitante com cookie `HttpOnly` de token opaco), preço sempre recalculado, mesclado ao fazer login;
- exclusão de produto é arquivamento com motivo auditado; produto digital continua indisponível.


## DT-032 — Remessas (campanhas de pré-venda)

- **Estado:** Aceita
- **Data:** 2026-10-19

### Decisão

- ciclo: rascunho → agendada/aberta → encerrada → encomendada → em produção → recebida → pronta para retirada → concluída; cancelamento até antes do recebimento; encerrada pode ser reaberta informando novo prazo (extensão, PEN-031);
- produtos com modo "Remessa" só são vendidos com remessa aberta e dentro da janela; preço da remessa prevalece; máximo da remessa e do produto conferido no checkout com trava da remessa; sem estoque físico;
- pedido de remessa não se mistura com outros itens nem com outra remessa, para que o cancelamento da remessa cancele pedidos inteiros sem afetar compras comuns;
- encomendar exige mínimo de unidades **pagas**, nenhum comprovante pendente e cancela pedidos sem pagamento; configuração (produtos, período, quantidades) fica imutável após a encomenda;
- relatório consolidado e CSV (separador ";", BOM UTF-8) consideram apenas pedidos pagos;
- "pronta para retirada" muda pedidos pagos para pronto e notifica (in-app e e-mail) somente os compradores afetados, uma única vez por item (`arrival_notified_at`); retirada registra `picked_up_at` e entrega o pedido;
- cancelamento exige motivo e permissão de estorno: cada pedido é cancelado com reembolso vinculado (lançamento original preservado);
- política para mínimo não atingido (PEN-032) é texto obrigatório-recomendado exibido na loja antes da compra; o sistema só cobra antes da encomenda, e a devolução é estorno manual registrado.

## DT-033 — Parceiros, comissão, repasses e agendamento manual

- **Estado:** Aceita
- **Data:** 2026-10-19

### Decisão

- parceiro nasce `PENDING`; aprovar (`ACTIVE`) exige início de vigência; `INACTIVE` e `ENDED` exigem motivo, e `ENDED` é terminal. Publicação no site e venda na loja exigem `ACTIVE` **e** data atual (fuso do time) dentro da vigência (`partnerOperational`/`operationalPartnerWhere`, usados pela loja, carrinho e páginas públicas — RN-PAR-001, PEN-034);
- CNPJ/CPF do parceiro e registro do profissional são cifrados (AES-GCM) com hash cego para duplicidade; documentos são arquivos `CONFIDENTIAL`, enviados com `partners.manage` + `partner.documents.read`, lidos só com `partner.documents.read` por rota própria, e cada leitura é auditada; listagens nunca trazem documentos;
- comissão (PEN-035) é a parte do time: `NONE` (repasse integral), `PERCENTAGE` (0–100% do total do item) ou `FIXED` (valor por unidade), limitada ao total do item, arredondamento comercial em 2 casas. O produto pode sobrepor a regra do parceiro. No checkout o item grava `commissionTypeSnapshot`, taxa ou valor fixo e `partnerAmountSnapshot`; mudanças posteriores de regra não alteram vendas feitas;
- a receita da venda continua entrando inteira no Caixa (categoria `vendas-parceiros`); o valor devido ao parceiro sai no repasse (categoria `repasses-parceiros`, origem `PARTNER_SETTLEMENT`). O relatório de vendas por parceiro separa receita do time, valor devido, já repassado e a pagar (RN-PAR-003);
- repasse agrupa itens de pedidos pagos (pago, em separação, pronto, entregue) no período por `paidAt` e ainda não repassados; criação idempotente (`Idempotency-Key`) e serializada por trava no parceiro; ajuste assinado exige motivo e o líquido não pode ficar negativo. Estados `DRAFT → PENDING → APPROVED → PAID`, com volta de `PENDING` a `DRAFT` e cancelamento antes do pagamento;
- pagar exige `transactions.confirm` e lança **uma** saída confirmada com chave natural `partner-settlement:<id>` (reenvios devolvem o mesmo estado); repasse com líquido zero é marcado pago sem lançamento;
- cancelar repasse não pago remove seus itens (que voltam a ficar elegíveis, já que `order_item_id` é único) e registra a lista liberada na auditoria; como não houve efeito financeiro, não há histórico financeiro a preservar. Repasse pago não é cancelado;
- pedido com item em repasse ainda não pago não pode ser cancelado/estornado (`IN_PARTNER_SETTLEMENT`): cancele o repasse antes. Estorno de venda já repassada é permitido e o valor é recuperado por ajuste negativo motivado no próximo repasse (detecção automática pendente, `PEN-052`);
- profissionais e serviços só são cadastrados para parceiro `ACTIVE`; serviço nasce rascunho; inativar ou encerrar o parceiro desativa os serviços. Contato do profissional só aparece no site com autorização explícita (`publicContact`);
- disponibilidade por intervalos (máximo de 12 h) sem sobreposição para o mesmo profissional, com trava na linha do profissional; horários são bloqueados, nunca apagados;
- agendamento manual (PEN-037): usuário autenticado escolhe um horário livre; o horário fica `RESERVED` e o agendamento `REQUESTED` (máximo de 5 pendentes por pessoa); a diretoria confirma (verificando conflito com atendimentos confirmados do profissional), cancela com motivo ou registra realizado/ausência após o horário. Cancelar libera o horário. O solicitante pode cancelar antes do horário. Notificações in-app ao solicitante e a quem tem `appointments.manage`; e-mail mínimo ao profissional na confirmação e no cancelamento;
- nenhum dado de saúde (RN-PAR-008): só observação livre de até 500 caracteres com aviso explícito; a observação interna da diretoria não aparece para o solicitante;
- parceiro não tem login nesta fase (PEN-036): a diretoria opera tudo.

### Consequências

- `NotificationsService.permissionHolders` resolve destinatários operacionais por permissão (limite defensivo de 50);
- migration `fase6_parceiros` adiciona `partners.website_url`, `partner_professionals.public_contact`, `appointments.requester_notes` e `partner_settlements.adjustment_reason`.

## DT-034 — Comunicação: notícias, eventos, fórum e avisos

- **Estado:** Aceita
- **Data:** 2026-10-19

### Decisão

- **fonte editorial única (PEN-038, DT-016):** a notícia é a fonte; "página inicial" e "comunicados do fórum" são canais (`showOnHome`, `showOnForum`) consultados sobre a mesma linha, sem cópia. Editar, ocultar ou arquivar reflete em todos os canais. `News.forumTopicId` fica reservado para um futuro tópico de discussão ligado à notícia;
- **publicação agendada (RN-COM-005):** publicar grava `publishedAt` (agora ou o instante UTC agendado) e o estado `PUBLISHED` ou `SCHEDULED`; o público vê notícias publicadas/agendadas com `publishedAt ≤ agora`, sem depender de rotina. Reagendar é permitido; o slug fica fixo após a primeira publicação; ocultar exige motivo;
- **eventos e partidas (RCF-001, RN-COM-006):** evento rascunho → confirmado (publica se público) → realizado ou cancelado (com motivo); partida guarda adversário, competição, mando, equipe e placar; seletiva e notícia ligam-se ao evento por referência. O evento só lista notícias já visíveis;
- **texto simples:** títulos e textos de notícias, eventos e fórum passam por `sanitizeText` (remove marcação HTML e caracteres de controle) e a interface renderiza sempre como texto (`white-space: pre-line`), nunca como HTML;
- **fórum (PEN-039):** "usuário verificado" é conta ativa autenticada, porque a verificação de e-mail não bloqueia o login (`PEN-008`). Visibilidades: `PUBLIC` (qualquer pessoa lê, contas participam), `MEMBERS` (nova permissão `forum.members.access`, concedida a atleta e diretoria) e `STAFF` (`forum.moderate`). O tópico herda a visibilidade da categoria, e mudar a categoria propaga aos tópicos. Conteúdo restrito responde 404 e não entra em listas nem contagens;
- participação: criar tópico, responder, editar ou apagar a própria mensagem em até 24 h (o texto anterior fica na auditoria), reação única por pessoa e mensagem (idempotente, trocável) e denúncia (uma aberta por pessoa e alvo). Limites antiabuso no servidor: 6 mensagens por minuto, 5 tópicos por hora e 10 denúncias por hora, além do rate limit HTTP;
- moderação (`forum.moderate`): ocultar, restaurar, remover mensagem; ocultar, restaurar, fechar, reabrir, fixar e desafixar tópico. Toda ação exige motivo, grava `ForumModerationAction` (antes/depois) e auditoria, e avisa o autor quando o conteúdo é ocultado ou removido. Exclusão é sempre lógica. Comunicados fixados na criação exigem `forum.publish`;
- **avisos (`notifications.send`):** envio manual a atletas ativos, atletas de uma equipe, diretoria ou todos os usuários ativos; somente in-app (PEN-040), link apenas interno, idempotente pela `Idempotency-Key` (a chave vira a deduplicação de cada notificação) e registrado na auditoria, que também serve de histórico.

### Consequências

- nova permissão `forum.members.access` no catálogo, sincronizada por `npm run db:seed` (concedida uma vez ao papel atleta e, como as demais, à diretoria e ao administrador);
- sem migration: o schema da Fase 0 já tinha as entidades de comunicação.

## DT-035 — Relatórios, exportação, auditoria e direitos do titular

- **Estado:** Aceita
- **Data:** 2026-10-19

### Decisão

- **relatórios integrados (RF-021, RF-045):** módulo `reports` com catálogo fixo (atletas por status e equipe, inscrições por seletiva, mensalidades e inadimplência por mês, Caixa agrupado por categoria/conta/centro de custo/origem, pendências de comprovante, vendas por produto, vendas por parceiro e remessas). Todos devolvem a mesma estrutura de tabela, com período, fuso, moeda, instante de geração e totais calculados em Decimal; nenhum relatório expõe dados pessoais além do necessário (atletas só em contagem);
- consultas síncronas com período limitado a 2 anos e listas limitadas; relatórios assíncronos e volumes maiores ficam para quando houver medição (`PEN-049`);
- **exportação (`reports.export`):** permissão separada de `reports.read`; CSV com separador `;`, BOM UTF-8, cabeçalho com relatório, período, fuso e geração e linha de total; **toda célula de texto iniciada por `=`, `+`, `-`, `@`, tabulação ou retorno de carro recebe apóstrofo** contra injeção de fórmulas (`common/util/csv.ts`, também usado pelas remessas); cada exportação gera `report.exported` na auditoria com relatório, filtros e quantidade de linhas;
- **auditoria:** filtros por ação, entidade, ID da entidade, autor, requisição e período (datas civis no fuso do time); detalhe com antes/depois, metadados e as demais ações da mesma requisição;
- **direitos do titular (LGPD art. 18):** o titular baixa a cópia dos próprios dados a qualquer momento (`me/privacy/export`, JSON sem segredos nem dados de terceiros, auditado) e pede eliminação; um pedido aberto por tipo. A fila é atendida por quem tem `privacy.requests.manage` (somente administrador, como já definido no catálogo);
- **anonimização:** exige também `users.update`, não pode ser feita pela própria pessoa nem sobre conta com papel além de usuário/atleta. Substitui nome, e-mail, telefone e senha, inativa a conta, revoga sessões, remove tokens, favoritos, reações e papéis, apaga logicamente notificações e mensagens do fórum (texto substituído), limpa observações de agendamento e desvincula o cadastro de atleta. **Mantém** pedidos, pagamentos, lançamentos, repasses e auditoria (obrigação legal e prestação de contas) e o cadastro esportivo até a política de retenção (`PEN-011`);
- **otimizações medidas:** índices em `notifications(deduplication_key)`, `audit_logs(action, occurred_at)` e `orders(status, paid_at)`; a lista pública de parceiros passou de uma consulta por parceiro para uma única consulta (p50 de 104 ms para 41 ms no teste de carga local);
- **teste de carga básico:** `scripts/load-test.mjs`, sem dependências; **backup/restauração:** runbook em `15-DEPLOY-E-INFRAESTRUTURA.md` §10.1, validado com restauração e conferência de contagens e saldo.

### Consequências

- migration `fase8_privacidade_indices` (tabela `privacy_requests`, enums e índices);
- o gerador de CSV das remessas passa a neutralizar fórmulas.

## DT-036 — Expiração de sessão por inatividade e duração máxima; endurecimento de segurança

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto (prazos escolhidos explicitamente em 2026-10-25)

### Contexto

Pela `DT-022`, cada renovação emitia um refresh token com mais 30 dias. Com o site renovando o acesso a cada ~14 minutos, a sessão nunca expirava se usada ao menos uma vez por mês. O responsável abriu o sistema após mais de 5 dias sem uso e entrou direto no painel administrativo. Não havia limite de inatividade nem duração máxima.

### Decisão

- **perfis:** conta *privilegiada* é a que tem qualquer permissão além de `forum.members.access` (administrador, diretoria ou papel customizado com permissão administrativa). As demais são *comuns*. A classificação usa as permissões vigentes em cada verificação, então uma promoção encurta imediatamente uma sessão já aberta;
- **inatividade:** 30 minutos para conta privilegiada; 7 dias para conta comum;
- **duração máxima desde o login por senha:** 12 horas para conta privilegiada; 30 dias para conta comum. Não é prorrogada pela rotação;
- `user_sessions` ganha `authenticated_at`, herdado na rotação, e `last_activity_at`. O `expires_at` passa a ser o prazo absoluto;
- **uso real:** toda requisição autenticada registra atividade, gravada no máximo uma vez por minuto. A renovação automática **não** conta como uso; o site só envia `active: true` quando houve clique, tecla, toque ou rolagem desde a renovação anterior;
- a API recusa sessões vencidas tanto na renovação quanto em cada requisição autenticada, revoga com motivo `IDLE_TIMEOUT` ou `ABSOLUTE_TIMEOUT` e registra `auth.session.expired` na auditoria;
- o site também descarta a sessão da memória ao atingir o limite sem interação, mesmo com a aba aberta ou após o computador hibernar, e leva ao login com aviso. A sessão não é revogada no servidor nesse momento, para não derrubar outra aba ainda em uso;
- a regra fica em `auth-rules.ts` (domínio); a persistência, em `SessionLifetimeService`.

#### Endurecimento aplicado na mesma revisão

- **CSP e HSTS no site** (a parte de scripts foi substituída pela CSP com nonce da `DT-046`): política sem nonces, só `'self'` (o site não usa recursos de terceiros), `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`, `Cross-Origin-Opener-Policy: same-origin`; HSTS de 2 anos apenas em produção;
- **redirecionamento aberto:** o parâmetro `next` do login aceitava `/\dominio-externo`, que o navegador normaliza para `//dominio-externo`. Agora só são aceitos caminhos do próprio site (`lib/safe-redirect.ts`);
- **API somente em loopback por padrão** (`API_HOST=127.0.0.1`); `0.0.0.0` só por configuração explícita em contêiner;
- **dependências:** `multer` 2.5.0, `body-parser` 2.4.0 e `zod` 4.6.7 corrigem negação de serviço com severidade alta; `fast-uri` 3.1.9 corrige falhas moderadas. `npm audit` sem vulnerabilidades.

### Consequências

- migração `20261025180000_sessao_inatividade_limite`. Sessões existentes usam o instante de criação como referência e, se já excedem os limites, expiram no próximo uso;
- `refreshTokenTtlSeconds` sai da configuração: o prazo é regra de domínio;
- administradores e diretoria precisam entrar novamente ao menos uma vez por dia de trabalho e após 30 minutos parados;
- 7 testes unitários e 7 de integração cobrem os limites, a não prorrogação pela renovação automática e a herança do instante de login.

## DT-037 — Login em duas etapas (TOTP) para perfis privilegiados

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto decidiu em 2026-10-20 a obrigatoriedade para quem acessa o painel (`PEN-013 (MFA)`); os detalhes de implementação são delegados

### Decisão

- **algoritmo:** TOTP (RFC 6238), HMAC-SHA1, 6 dígitos, passo de 30 s e tolerância de ±1 passo. É o padrão aceito por todos os aplicativos autenticadores. Implementação própria com `node:crypto`, validada pelos vetores oficiais da RFC;
- **quem:** obrigatório para perfis privilegiados, com o mesmo critério da `DT-036` (qualquer permissão além de `forum.members.access`). Contas comuns podem ativar e desativar por opção;
- **aplicação no servidor:** a sessão guarda `mfa_verified_at`, herdado na rotação. Sem ele, um perfil privilegiado fica só com as permissões comuns, e as rotas administrativas respondem `403 MFA_REQUIRED`. Negação por padrão: toda verificação de permissão, inclusive dentro dos serviços, enxerga apenas as permissões efetivas;
- **login:** com a segunda etapa ativa, a senha correta devolve um desafio opaco (hash em `user_tokens`, 5 min, no máximo 5 tentativas), sem sessão nem cookie. `POST /auth/mfa/verify` troca o desafio e o código pela sessão;
- **reutilização:** o último passo aceito fica em `users.mfa_last_used_step` e é gravado de forma condicional, então o mesmo código não vale duas vezes, nem em requisições simultâneas;
- **segredo:** gerado com 160 bits, cifrado com AES-256-GCM (`DATA_ENCRYPTION_KEY`) e mostrado só na ativação. Fica pendente até ser confirmado por um código válido. O QR code é gerado na própria API (`qrcode` 1.5.4, em SVG exibido como imagem), sem serviço externo;
- **ativação:** exige a senha atual e um código válido; a sessão atual passa a ser verificada e as demais são encerradas;
- **recuperação:** 10 códigos de uso único (60 bits, `XXXX-XXXX-XXXX`), guardados só como hash e exibidos uma única vez. Gerar novos exige senha e código;
- **perda do celular:** um administrador com a segunda etapa comprovada redefine a de outra pessoa (`users.update` + `sessions.revoke`, motivo obrigatório, auditado, sessões encerradas). Ninguém redefine a própria. Se o único administrador perder o acesso, `npm run mfa:reset -- <e-mail> "<motivo>"` faz o mesmo a partir do servidor, também auditado;
- **auditoria:** `auth.login.mfa_challenge`, `auth.login` (com o fator usado), `auth.mfa.failed`, `auth.mfa.enabled`, `auth.mfa.disabled`, `auth.mfa.recovery_codes.regenerated` e `auth.mfa.reset`.

### Consequências

- migração `20261025175820_mfa_totp`. Sessões abertas antes dela não têm a segunda etapa comprovada: administradores e diretoria precisam ativá-la para voltar ao painel;
- o helper de testes de integração passa pelo fluxo real (ativa na primeira vez, responde ao desafio nas seguintes), e todas as fases continuam exercitando rotas administrativas como em produção;
- 9 testes unitários de TOTP, 3 de domínio e 9 de integração.

## DT-038 — Persistência dos dados: banco de testes isolado, arquivos fora do projeto e backup

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto ("quero que os dados estejam bem guardados, persistentes e protegidos", 2026-10-25); resolve `PEN-059`

### Contexto

A logo oficial e as configurações do time "sumiam". A auditoria mostrou a causa: os testes de integração usavam o mesmo `DATABASE_URL` do desenvolvimento. A cada execução, o teste de configurações regravava telefone, redes sociais e chave PIX e apontava a logo oficial para uma imagem gravada numa pasta temporária, que depois era apagada. Além disso, `npm run db:demo` sobrescrevia descrição e história do time, e os arquivos enviados ficavam em `apps/api/var/storage`, dentro da pasta do projeto.

### Decisão

- **banco de testes:** a suíte de integração recria o banco `<banco>_test` (ou `DATABASE_URL_TEST`) e aplica as migrations antes de rodar (`apps/api/test/global-setup.cjs`). Todo `PrismaClient` dos testes aponta para ele (`use-test-database.cjs`). A execução é recusada se o nome não terminar em `_test` ou coincidir com o banco de desenvolvimento;
- **dados de demonstração:** `db:demo` só preenche campos vazios das configurações e não grava mais contatos fictícios;
- **limpeza:** `npm run db:clean-test-data` (simula; `-- --apply` grava) identifica pela auditoria o que contas `@exemplo.test` criaram e aplica exclusão lógica só em cadastros não financeiros. Também devolve logos trocadas por teste à última enviada por pessoa real e limpa contato/PIX gravados por teste. Cada ação gera `maintenance.test_data.*` na auditoria;
- **arquivos:** `STORAGE_LOCAL_DIR` deve apontar para fora da pasta do projeto (no ambiente local, `C:/Users/William/FenixVolei-dados/storage`). Em produção, caminho absoluto obrigatório, montado como volume persistente. A API confere na inicialização se a pasta aceita leitura e escrita. A gravação usa arquivo temporário + renomeação, e arquivo ausente responde `404` em vez de erro interno;
- **backup:** `npm run backup` gera em `BACKUP_DIR` (absoluto, fora do projeto) uma pasta datada com o dump do banco (lido por inteiro pelo `pg_restore`), a cópia dos arquivos e um `manifest.json` com SHA-256. Mantém as `BACKUP_KEEP` cópias mais recentes (padrão 30, conforme `PEN-044`). A `DATA_ENCRYPTION_KEY` nunca é copiada.

### Consequências

- a suíte de integração leva alguns segundos a mais para recriar o banco; o banco de desenvolvimento não muda após rodar todos os testes (conferido: 16 equipes, 5 856 registros de auditoria e 815 usuários antes e depois);
- na limpeza de 2026-10-25, 1 053 cadastros de teste receberam exclusão lógica, a logo oficial voltou ao arquivo enviado pelo responsável e a chave PIX de teste foi removida;
- o adaptador de objetos em nuvem (S3 ou compatível) continua dependente de `PEN-042`; até lá, produção usa volume persistente com o adaptador de disco e `ALLOW_LOCAL_ADAPTERS_IN_PRODUCTION=true`.

## DT-039 — Otimização de imagens públicas

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto (fluxo upload → validação → compressão → WebP → redimensionamento → armazenamento, 2026-10-25)

### Decisão

- imagens públicas (logos, capas, fotos de produto e logos de parceiro) passam por `optimizeImage` (`apps/api/src/common/storage/image-processing.ts`, `sharp` 0.35.5, a mesma versão já usada pelo site): decodificação completa, que recusa arquivo corrompido ou truncado com `422 IMAGE_UNREADABLE`; correção da rotação da câmera; redução até 1920 × 1920 sem ampliar; conversão para WebP com qualidade 82; remoção de metadados (EXIF e GPS);
- limite de entrada de 10 MB e de 50 megapixels decodificados (contra "bombas de descompressão");
- a validação anterior continua: assinatura binária real, extensão compatível e tamanho;
- comprovantes, contratos e documentos (`DOCUMENT_POLICY`) **não** são alterados, por serem documentos de prova;
- o banco guarda só metadados do arquivo final (WebP, tamanho e SHA-256).

### Consequências

- arquivos enviados antes desta decisão continuam no formato original;
- 4 testes unitários (conversão, não ampliação, remoção de EXIF, arquivo corrompido) e o teste de integração de logo atualizado para WebP e imagem truncada.

## DT-040 — CPF, telefone e limites de caracteres compartilhados

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto (só CPF no padrão `000.000.000-00` e telefone `(00) 00000-0000`, 2026-10-25; demais pontos pela recomendação de `PEN-056` e `PEN-057`)

### Decisão

- **pacote único:** `packages/validation` passa a gerar JavaScript (`dist/`) e contém as regras de CPF, CNPJ, telefone e os limites de caracteres (`FIELD_LIMITS`). API e site importam o mesmo código; os testes usam o código-fonte via `moduleNameMapper`. A API compila o pacote antes de `build`, `dev` e `typecheck`;
- **API:** decoradores `IsCpf`, `IsCpfOrCnpj`, `IsMobilePhoneBr` e `IsPhoneBr` (`apps/api/src/common/validation/br-fields.ts`) normalizam para só dígitos e validam. `allowEmpty` aceita string vazia nos PATCH em que ela remove o valor;
- **CPF:** opcional; 11 dígitos, dígitos verificadores e recusa de sequências repetidas. Gravado cifrado como antes. Exibição `***.982.247-**`. Documento legado que não é CPF continua gravado e a ficha mostra `documentNeedsReview`;
- **telefone:** celular (DDD 11–99 sem zero, 9 dígitos começando por 9) para atleta, responsável, interessado, inscrição, conta e pedido. Emergência, parceiro, profissional e contato do time aceitam também fixo (8 dígitos começando por 2 a 5);
- **migração de dados:** telefones gravados perdem máscara e `+55`; o que não resulta em 10 ou 11 dígitos fica como está.

### Consequências

- integrações que enviavam telefone em formato livre (`+55 68 ...`) continuam aceitas, desde que o resultado tenha DDD e número válidos;
- 20 testes unitários no pacote e um teste de integração de recusa (RG, CPF inválido, telefone sem DDD ou com DDD inválido).

## DT-041 — Imagens de evento e parceiro, selo do parceiro e atualização imediata do site

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto (pedidos de imagens em notícias, eventos e parceiros, logo do parceiro nos produtos e ícones, 2026-10-25); resolve `PEN-058`

### Decisão

- **capas:** `events.cover_media_file_id` e `partners.cover_media_file_id` (FK para `media_files`, `ON DELETE SET NULL`, com índice), enviadas por `POST /events/:id/cover` e `POST /partners/:id/cover` com o fluxo de imagem pública da `DT-039` e auditoria (`event.cover.updated`, `partner.cover.updated`). A visão do evento devolve `coverUrl` própria ou, na falta, a da notícia vinculada visível;
- **produtos:** a visão pública inclui `partner.logoUrl` e `campaign.salesEndAt`; `GET /public/products?campaign=true` lista só produtos em remessa aberta;
- **cache do site:** as leituras públicas do Next levam a etiqueta `public-content`. Um interceptor global da API, depois de qualquer alteração bem-sucedida (exceto `/auth` e `/me`), chama `POST {WEB_INTERNAL_URL}/api/site-revalidate` com o cabeçalho `x-revalidate-secret` (`SITE_REVALIDATE_SECRET`), agrupando alterações em 1 s. Sem o segredo, o aviso fica desligado e vale o cache de até 60 s. Falhas viram aviso no log e nunca afetam a resposta;
- **ícones:** Bootstrap Icons 1.11.3 (MIT, publicado em 2024-01-03), carregado como fonte no layout e usado pelo componente `Icon`: decorativo por padrão (`aria-hidden`), sempre ao lado de texto;
- **componentes:** `MediaImage`, `NewsCard`, `EventCard`, `PartnerLogo` e `ImageUpload` concentram imagem com reserva, cartões e envio, sem `<img>` solto nas telas.

### Consequências

- migração `20261025210000_capas_evento_parceiro`, gerada por `prisma migrate diff` porque o banco local guarda um registro antigo e já desfeito (`20261025200000_mfa_totp`, `rolled_back`) que impede `migrate dev`; `migrate deploy` não é afetado. O registro foi removido do banco local em 2026-10-25, depois de backup (só metadado: 0 passos aplicados); `prisma migrate status` confirma o banco em dia;
- testes de integração de capa de evento (inclusive WebP e herança da notícia) e de logo e capa do parceiro; 3 testes unitários do interceptor.

## DT-042 — Equipe ativa, efeitos do status do atleta e faixa etária

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto ("aplique as mudanças", 2026-10-25), com as recomendações de `PEN-060` e `PEN-061`

### Decisão

- **equipe ativa:** `assertActiveTeam` (domínio esportivo) é a regra única para escolher equipe em partida, comunicado por equipe e seletiva; aceita manter a equipe que o registro já usava. O vínculo de atleta continua com a validação própria;
- **status do atleta:** `GET /athletes/:id/status-impact` informa mensalidades canceláveis (mês atual em diante, `OPEN`/`OVERDUE`, sem nenhum pagamento registrado), as que ficam em aberto, o plano vigente e os vínculos abertos. `PUT /athletes/:id/status` aceita `cancelFutureFees` e `endPlan` (inativar ou suspender) e `endMemberships` (só inativar), aplicados na mesma transação, com o motivo da mudança e auditoria por item (`fee.cancelled`, `fee_plan.assignment.ended`, `athlete.membership.ended`);
- **faixa etária:** só aviso na tela, com confirmação; a API não bloqueia.

### Consequências

- nenhuma mensalidade com pagamento, nem de mês passado, é cancelada por mudança de status;
- teste de integração cobre o impacto, a recusa de encerrar vínculos na suspensão e os três efeitos.

## DT-043 — Gestão de planos de mensalidade e exclusão segura de cadastros

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto ("preciso controlar as mensalidades melhor: quem paga qual mensalidade, editar, data de cobrança, adicionar ou remover atletas; categorias devem ser editadas e apagadas", 2026-10-25)

### Decisão

- **plano no centro:** cada plano tem tela própria (`/admin/planos/[id]`) com quem paga, quem já saiu e as ações. `GET /fee-plans/:id/athletes` lista os vínculos; `POST /fee-plans/:id/athletes` coloca até 100 atletas de uma vez, com início, valor individual e motivo opcionais. Sem `replaceCurrent`, quem já tem outro plano é informado e fica de fora; com ele, o plano anterior termina na véspera do novo início, sem buraco nem sobreposição. A ficha do atleta continua com a atribuição individual, que usa o mesmo núcleo (`assignInTx`);
- **edição:** nome, valor, dia de vencimento e descrição do plano valem para as próximas cobranças; as já geradas não mudam (RN-MEN). O vencimento de uma cobrança em aberto muda por `PUT /monthly-fees/:id/due-date`, com motivo e auditoria (`fee.due_date.changed`);
- **exclusão de plano:** `DELETE /fee-plans/:id` faz exclusão lógica e só é aceita sem atletas vigentes; as cobranças antigas continuam ligadas ao plano;
- **exclusão de cadastros auxiliares:** `softDeleteIfUnused` (`common/domain/safe-delete.ts`) é a regra única para excluir categoria esportiva, da loja, de notícias, do fórum, categoria financeira e centro de custo: exclusão lógica com motivo e auditoria, recusada com `409 IN_USE` quando há uso (equipes, produtos, notícias, tópicos, lançamentos, contas a pagar e receber, subcategorias). Categorias financeiras do sistema nunca são excluídas. Na interface, `CategoryManager` concentra editar, ativar/inativar e excluir nos cinco tipos.

### Consequências

- nenhum registro financeiro é apagado; cobrança gerada só muda por ajuste, vencimento ou cancelamento auditados;
- testes de integração cobrem atribuição em massa, troca, listagem, recusa de exclusão em uso, exclusão sem uso e mudança de vencimento, além da exclusão de categoria esportiva.

## DT-044 — Foto de perfil e elenco público por categoria

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto (foto de perfil pública ou privada, aberta a todos os usuários cadastrados, e elenco do time por categoria, 2026-10-25); regra para menores pela recomendação de `PEN-062`

### Decisão

- **dados:** `users.avatar_media_file_id` (FK `media_files`, `SET NULL`, indexada), `users.profile_public` (padrão `false`) e `athletes.public_profile_consent_at`. As relações `User`↔`MediaFile` passam a ter nome (`MediaUploader`, `UserAvatar`), sem mudança no banco;
- **foto:** `PUT /me/avatar` e `DELETE /me/avatar`, imagem otimizada para até 800 px em WebP (DT-039). A classificação do arquivo acompanha a escolha da pessoa: `INTERNAL` enquanto privada e `PUBLIC` com perfil público (`PUT /me/profile-visibility`). Foto trocada ou removida recebe exclusão lógica e deixa de abrir;
- **elenco:** `GET /public/teams-roster?type=` agrupa equipes ativas por categoria, com atletas ativos, de vínculo aberto, conta ativa e perfil público. Menor de 18 ou sem nascimento só entra com `public_profile_consent_at`, registrado pela diretoria em `PUT /athletes/:id/public-profile-consent` (motivo obrigatório, auditado). A resposta expõe só nome de exibição (`publicDisplayName`), posição do vínculo (ou do cadastro) e foto;
- **interface:** `Avatar` carrega foto privada pelo cliente com login (como os comprovantes); no site público, a foto já é pública e carrega direto.

### Consequências

- a política está em `docs/13-SEGURANCA-E-LGPD.md` (foto de perfil e elenco público);
- 4 testes unitários do nome de exibição e um teste de integração do fluxo completo: foto privada fechada para anônimo, perfil público, menor sem e com autorização, nome abreviado e volta para privado.

## DT-045 — Cupons de desconto

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto ("cupons para determinado produto, categoria, para a diretoria, para atletas", 2026-10-25); produto de parceiro fica de fora até decisão (`PEN-063`)

### Decisão

- **modelo:** `coupons` (código único em maiúsculas, tipo percentual ou fixo, alvo, público, validade, pedido mínimo, limites) e tabelas de alvo com UUID próprio: `coupon_products`, `coupon_categories`, `coupon_roles`. O uso fica em `coupon_redemptions`, um por pedido, com o valor do desconto congelado. Restrições `CHECK` no banco garantem valor coerente com o tipo, limites positivos e período válido;
- **regras puras:** `evaluateCoupon` (`store/domain/coupon-rules.ts`): um cupom por pedido, sobre o preço atual do item (já com promoção), nunca em produto de parceiro; percentual sobre o subtotal elegível, valor fixo limitado a ele; pedido mínimo sobre o subtotal do pedido. Público por papel aceita qualquer papel, inclusive personalizados. O desconto é repartido entre os itens elegíveis em centavos, sem sobra (`allocateDiscount`);
- **fechamento do pedido:** dentro da transação do checkout, a linha do cupom é travada (`SELECT … FOR UPDATE`) e tudo é conferido de novo, para os limites valerem com pedidos simultâneos. O pedido grava subtotal, desconto e total; cada item, sua parte do desconto. O Caixa recebe o valor efetivamente pago;
- **liberação:** cancelar, expirar ou estornar o pedido marca o uso como `RELEASED`, que deixa de contar nos limites;
- **prévia:** `POST /cart/coupon` calcula sem reservar, com limite de 15 tentativas por minuto contra adivinhação de códigos. Mensagens dizem o motivo da recusa (expirado, esgotado, público, mínimo, sem item elegível);
- **painel:** `/admin/cupons` com a permissão nova `coupons.manage` (administração e diretoria a recebem automaticamente). Cupom usado não é excluído, só inativado (`softDeleteIfUnused`).

### Consequências

- desconto aparece no resumo do pedido para cliente e diretoria; o lançamento no Caixa continua pelo total pago (receita líquida);
- 15 testes unitários das regras e um teste de integração do fluxo real (público, prévia, desconto por produto, limite por pessoa, liberação ao cancelar, inativação e permissão).

## DT-046 — Limpeza, CSP com nonce, SEO e padrão pt-BR

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto ("aplique tudo, e tem minha total aprovação de tudo que foi indicado", sobre `docs/30-REVISAO-GERAL.md`; "o padrão definitivo de todo o sistema é o português brasileiro", 2026-10-25)

### Decisão

- **remoções (R-13):** `packages/types` e `packages/ui`, que nenhuma aplicação importava, e a tabela reservada `registrations` com o tipo `RegistrationStatus` (migração `20261026042015_remove_registrations`). A migração para sem apagar nada se a tabela tiver qualquer linha. Nenhum requisito sai: a inscrição geral sem seletiva já é atendida pelo interessado (`DT-028`);
- **CSP com nonce (R-05):** substitui a política fixa da revisão de segurança (`script-src 'self' 'unsafe-inline'`). `proxy.ts` (o antigo `middleware` do Next 16) gera 16 bytes aleatórios por requisição e envia a política no pedido, para o Next marcar os próprios scripts, e na resposta. `script-src 'self' 'nonce-…' 'strict-dynamic'`; `unsafe-eval` e `ws:` só em desenvolvimento. Estilos continuam com `'unsafe-inline'` enquanto houver atributos `style` (R-09). O layout raiz lê os cabeçalhos, então todas as páginas são renderizadas por requisição; sitemap, robots e manifesto continuam estáticos;
- **SEO e compartilhamento (R-12):** `sitemap.xml` (páginas fixas, notícias, produtos, seletivas e parceiros publicados, revalidado a cada hora), `robots.txt` (bloqueia painel, Minha conta, API, carrinho e pedido) e `openGraph`/`twitter` com a logo como imagem padrão e `metadataBase` a partir de `WEB_ORIGIN`;
- **app instalável:** `manifest.webmanifest` com ícones de 192 e 512 px e versão `maskable`, gerados da logo. O service worker fica para a etapa de funcionalidades;
- **pt-BR em todo o sistema:**
  - mensagens padrão do class-validator traduzidas na borda (`validation-messages.ts`), preservando os números da regra; mensagens próprias passam sem mudança;
  - erros do framework (rota inexistente, JSON malformado, corpo grande demais) trocados por textos em português no `ProblemDetailsFilter`;
  - páginas próprias de "não encontrada" e de erro no site;
  - títulos dos testes, grupos da documentação da API (`@ApiTags`) e comentários gerados pelo Prisma nas migrações. Identificadores de código seguem em inglês.
- **checksums das migrações:** traduzir comentários muda o conteúdo dos arquivos já aplicados. O `checksum` de cada migração foi recalculado (sha256 do arquivo) no banco de desenvolvimento, e `prisma migrate status` confirma o histórico. O banco de testes é recriado a cada execução. Em outro ambiente com as migrações já aplicadas, rodar o mesmo `UPDATE _prisma_migrations SET checksum = …` antes do próximo `migrate deploy`. Hoje não existe esse ambiente.

### Consequências

- nenhum script embutido roda sem o nonce da página; testes unitários conferem a política de produção e de desenvolvimento;
- 11 testes unitários das mensagens de validação; 404 e JSON inválido conferidos na API em execução;
- `npm run check` e os 94 testes de integração passam.

## DT-047 — Tarefas automáticas e limite de requisições com mais de um servidor

- **Estado:** Aceita
- **Data:** 2026-10-25
- **Aprovador:** responsável do projeto (aprovação de `docs/30-REVISAO-GERAL.md`, item R-04, 2026-10-25)

### Contexto

As tarefas de 10 em 10 minutos (expirar reservas, encerrar remessas) rodavam com `setInterval` em cada processo, e o limite de requisições contava na memória de cada processo. Com dois ou mais servidores, as tarefas rodariam em dobro e cada servidor contaria os limites sozinho, o que enfraquece a proteção contra força bruta. Também havia erros engolidos em silêncio (`.catch(() => undefined)`).

### Decisão

- **sem serviço novo:** tudo no PostgreSQL que o projeto já usa. Redis só se a carga pedir no futuro;
- **concessão das tarefas:** `JobScheduler` (`common/jobs`) reserva cada tarefa na tabela `scheduled_job_leases` com uma instrução atômica (`INSERT … ON CONFLICT … WHERE locked_until <= now()`). A concessão dura 90% do intervalo e não é devolvida ao terminar: a tarefa roda no máximo uma vez por intervalo no conjunto de servidores. Se o servidor cair, a concessão vence e outro assume. Foi escolhida no lugar de `pg_try_advisory_lock` porque a trava de sessão do PostgreSQL exige a mesma conexão do começo ao fim, o que o pool do Prisma não garante;
- **falhas:** registradas no log com o tipo e a pilha de chamadas e na concessão (`last_status`, `last_error`), sem a mensagem do erro, que pode conter dado pessoal;
- **limite de requisições:** `PostgresThrottlerStorage` guarda a contagem em `rate_limit_buckets`, com a mesma regra da memória do Nest (janela fixa, bloqueio ao passar do limite, tentativas durante o bloqueio não somam). Uma instrução atômica por requisição. A chave é o hash que o Nest já gera (rota + IP); nenhum IP fica em claro. Contagens vencidas são apagadas a cada 10 minutos por uma tarefa do próprio agendador;
- **banco indisponível:** a contagem passa para a memória do processo até o banco voltar, com aviso no log no máximo uma vez por minuto. Sem banco a API já não atende quase nada; derrubar também as rotas que ainda funcionam não protegeria nada;
- **configuração:** `THROTTLE_STORE=memory` volta à contagem em memória (só desenvolvimento). `SCHEDULED_JOBS=off` desliga as tarefas no servidor; `ORDER_EXPIRY_JOB=off` continua valendo.

### Consequências

- uma escrita pequena no banco por requisição limitada; com a carga atual do clube não pesa (linha de base de `docs/15`);
- testes de integração simulam dois servidores: execução única com disparos simultâneos, troca de servidor quando a concessão vence, falha sem mensagem, soma das tentativas entre servidores, 12 requisições simultâneas com limite 10, recomeço após janela e bloqueio, limites com nomes separados e limpeza. Testes unitários do registro de erro sem mensagem e da configuração.

## DT-048 — Avisos por e-mail e WhatsApp, sem atendimento no site

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto ("preciso de um canal de comunicação por meio de e-mail ou WhatsApp, não quero fazer um atendimento no site", com aprovação das recomendações de `docs/30-REVISAO-GERAL.md`, 2026-10-25); resolve `PEN-040` com a recomendação registrada lá

### Decisão

- **sem chat no site:** o contato com a diretoria é pelo WhatsApp e pelo e-mail do clube. A página Contato e um atalho fixo nas páginas públicas abrem o WhatsApp (`wa.me`, com mensagem inicial) ou o e-mail de quem clica. No painel, fichas de atleta, interessados, inscrições de seletiva e pedidos ganham botões de WhatsApp e e-mail para a pessoa e o responsável. Nada passa pelo servidor;
- **avisos automáticos:** toda notificação continua no painel e, conforme a finalidade, entra na fila de e-mail e WhatsApp. A finalidade sai do tipo (`fee.` → mensalidades, `order.`/`campaign.` → pedidos, `tryout`/`athlete.` → seletivas e cadastro, `appointment.` → agenda, `announcement` → avisos da diretoria, `forum.` → fórum, `privacy.` e demais → conta);
- **padrões (recomendação de `PEN-040`):** e-mail ligado para mensalidades, pedidos, seletivas, agenda e avisos da diretoria; fórum e conta só no painel. A pessoa muda por finalidade e canal. WhatsApp segue o mesmo padrão, mas só depois do consentimento dela, com celular válido no cadastro;
- **consentimento do WhatsApp:** aceite destacado com o número exibido, retirada a qualquer momento, ambos auditados. Retirar cancela os envios pendentes;
- **fila (`notification_deliveries`):** uma entrega por notificação e canal, sem copiar destino nem conteúdo. No envio, conta ativa, preferência e consentimento são conferidos de novo. Lotes reservados com `FOR UPDATE SKIP LOCKED` (nada sai em dobro com vários servidores, `DT-047`); a fila roda logo depois do aviso e a cada 30 segundos. Falha temporária tenta de novo em 1 min, 5 min, 30 min e 2 h; recusa definitiva (destino inválido, modelo recusado) para na hora. Só um código curto fica gravado;
- **horários:** WhatsApp não sai entre 21h e 8h no fuso do clube e espera sem gastar tentativa; e-mail sai a qualquer hora. Lembretes de mensalidade são criados entre 9h e 19h;
- **lembretes de mensalidade:** mensalidade em aberto (aberta ou paga em parte), de atleta com conta ligada, recebe lembrete 3 dias antes, no dia, 1 e 7 dias depois do vencimento, uma vez por tipo. O texto não informa valor. Pedido pronto para retirada e resultado de seletiva já geravam aviso e passam a sair também por e-mail e WhatsApp;
- **sem duplicidade:** a chegada de remessa manda e-mail direto só para quem comprou sem conta; quem tem conta recebe pelo aviso, no canal que escolheu;
- **provedores:** e-mail por SMTP (`nodemailer` 10.1.7, sem dependências; adotado 8 dias após a publicação porque corrige três falhas moderadas do leitor de endereços da 10.1.0, mesmo critério de `PEN-055`) e WhatsApp pela Cloud API oficial da Meta, com modelo de mensagem aprovado de quatro variáveis (nome, título, texto, link). Sem credenciais, os dois gravam arquivos (modo de teste); em produção, o WhatsApp começa desligado e o modo de teste exige opt-in explícito.

### Consequências

- `PEN-040` resolvida; `PEN-064` registra o que depende do clube: contas nos provedores, aprovação do modelo na Meta, lembrete ao responsável de atleta menor sem conta e confirmação de entrega por webhook;
- Painel → Avisos mostra a situação dos canais, os envios dos últimos 7 dias e as falhas recentes, sem destinatário;
- 46 testes unitários (finalidades, padrões, número de WhatsApp, horários, tentativas, lembretes, textos, erros dos provedores e configuração), 3 testes de interface dos botões de contato e 11 testes de integração (envio por e-mail e WhatsApp em modo de teste, deduplicação, consentimento auditado e retirada, horário noturno, preferência conferida no envio, nova tentativa e recusa definitiva, dois processadores simultâneos, conta inativa, lembretes e resumo com permissão).

## DT-049 — Tempo real

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto ("preciso que o sistema seja em tempo real", 2026-10-25)

### Decisão

- **transporte:** Server-Sent Events em `GET /api/v1/me/events`, lido no navegador com `fetch` e o token no cabeçalho `Authorization`, nunca na URL. Passa pelo mesmo caminho `/api/v1` do site (DT-022). `Cache-Control: no-cache, no-transform` e `X-Accel-Buffering: no` impedem compressão e buffer no caminho; comentário a cada 25 s mantém a conexão viva;
- **eventos sem dados:** `notification` (a pessoa recebeu um aviso) e `changed` (algo mudou no sistema, só para quem tem `dashboard.read`). A tela que recebe busca de novo pela API, com as permissões de quem está vendo; nada vaza pelo evento. `changed` sai depois de cada escrita bem-sucedida, exceto login, sessão, carrinho, leitura de notificações, favoritos e preferências;
- **vários servidores:** `LISTEN/NOTIFY` do PostgreSQL (driver `pg` 8.23.1), sem serviço novo. Publicado dentro da transação, o evento só sai depois do commit. Destinatários vão em lotes de 100 por evento (limite de 8000 bytes do `NOTIFY`). Sem a conexão de escuta, entrega só no próprio servidor e tenta reconectar com espera crescente até 30 s. `REALTIME_DATABASE_URL` permite uma conexão direta quando o `DATABASE_URL` passa por pooler em modo transação; `REALTIME=off` desliga;
- **sessão:** a conexão é marcada como passiva (`@Passive()`): não conta como uso e não adia a expiração por inatividade (DT-036, DT-037). Fecha sozinha a cada 10 minutos, e o navegador reconecta com o token atual; sessão revogada ou vencida não reconecta. Até 8 conexões por pessoa em cada servidor;
- **navegador:** `lib/realtime.ts` liga a conexão enquanto há sessão, reconecta sozinho e, depois de uma queda maior que 5 s, pede ressincronização. `useResource` busca de novo: recursos da própria pessoa (`/me…`) em `notification`; os demais em `changed`, exceto quando a mudança veio da mesma aba (`X-Client-Id`). Eventos seguidos viram uma busca só, e a busca espera a pessoa sair do campo que está editando;
- **sino:** cabeçalho do site e do painel mostram a contagem de notificações não lidas, que atualiza na hora.

### Consequências

- listas do painel (pedidos, inscrições, interessados, mensalidades, atletas) atualizam sozinhas quando outra pessoa ou um cliente faz uma mudança;
- desligar o servidor encerra as conexões abertas e a escuta, inclusive se ela ainda estiver abrindo;
- 5 testes unitários (endereço da escuta, destino, lotes, aba de origem, formato), 3 testes no navegador (leitura do fluxo, recursos próprios, quem recarrega) e 5 de integração com conexões reais (login exigido, sessão não tocada, aviso só ao destinatário e só após o commit, mudança só para a diretoria, login sem aviso).

## DT-050 — Lembrar o navegador na segunda etapa

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto ("adicione uma caixa de marcação para que o sistema lembre do dispositivo [...] como o gov.br", 2026-10-26)

### Contexto

Com a segunda etapa (DT-037), o código do autenticador era pedido em todo login, o que afastava as pessoas.

### Decisão

- na tela do código, a caixa **"Lembrar este dispositivo por 30 dias"** vem marcada, com o aviso para desmarcar em computador público ou de outra pessoa;
- ao confirmar o código com a caixa marcada, a API cria um token aleatório e o envia num cookie `fenix_dv` HttpOnly, `SameSite=Strict`, `Secure` em produção, restrito a `/api/v1/auth`, válido por 30 dias. O banco (`trusted_devices`) guarda só o hash, ligado à conta, com nome legível do navegador ("Chrome no Windows") e sem IP;
- no login por senha, navegador lembrado **pela mesma conta** vale como segunda etapa: a sessão nasce com a segunda etapa comprovada e a auditoria registra `secondFactor: TRUSTED_DEVICE`. Senha errada continua barrando; o cookie de uma conta não serve para outra;
- vale para contas comuns e privilegiadas, como nos serviços de referência (gov.br, bancos): o navegador lembrado é o segundo fator "algo que você tem";
- em Minha conta → Segurança, a pessoa vê os navegadores lembrados (o atual marcado) e pode esquecer um ou todos. Até 10 por conta; ao lembrar o 11º, o mais antigo é esquecido;
- **esquece todos:** troca ou redefinição de senha, desativação da segunda etapa e redefinição pelo administrador. Criar e esquecer ficam na auditoria.

### Consequências

- login de quem usa sempre o mesmo navegador pede o código só uma vez por mês;
- 7 testes unitários (nome do navegador, validade) e 6 de integração (sem marcar continua pedindo; lembrado entra só com a senha e com segunda etapa comprovada; cookie de outra conta não serve; listar e trocar a senha esquece todos; esquecer volta a pedir; listar exige login).

## DT-051 — Loja profissional e páginas públicas ao vivo

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto ("quero o sistema em tempo real por conta da loja e inscrições [...] melhora da loja e carrinho de compras e edição do item escolhido, campos que só podem aceitar numeração [...] mais imagens [...] mover a foto [...] zoom [...] imagem do item no carrinho", 2026-10-26)

### Decisão

- **fotos:** até 12 por produto. No painel: envio de várias de uma vez com progresso, ordem por arrastar (computador) ou pelos botões de mover (celular), "Tornar capa", descrição de cada foto e remoção com confirmação. A primeira é a capa (`PUT /store/products/:id/images/order`, que exige exatamente as fotos atuais, trava o produto e registra antes/depois na auditoria; `PATCH /store/products/:id/images/:imageId` para a descrição);
- **galeria no site:** foto principal com lupa ao passar o mouse, miniaturas, setas, teclado (← →) e tela cheia com zoom que acompanha o mouse ou o dedo. Respeita "reduzir movimento";
- **carrinho:** cada item com miniatura, troca de opção (tamanho, cor) na própria linha (`POST /cart/items/change`: valida a nova opção antes de tirar a antiga e soma se ela já estiver no carrinho), quantidade com − e +, preço unitário e total. Opções esgotadas não aparecem para troca;
- **produto:** caminho de navegação (Loja / categoria / produto), quantidade com − e + limitada pelo que ainda cabe no limite por comprador, e o aviso "Últimas unidades" quando restam 3 ou menos. O site continua sem mostrar a quantidade em estoque;
- **campos numéricos em todo o sistema:** o `TextField` com `numeric="integer"` (ou `type="number"`) só aceita dígitos, inclusive ao colar; o `type="number"` do navegador, que aceita "e", "+" e "-", deixou de ser usado. Valores em reais (`numeric="decimal"`) aparecem com vírgula e seguem com ponto para a API; com vírgula, pontos são lidos como milhar ("1.234,50" → 1234.50). Isso corrige também o erro de quem digitava "89,90";
- **páginas públicas ao vivo:** `GET /api/v1/public/live?topics=store,tryouts` (Server-Sent Events, sem login, até 6 conexões por IP em cada servidor). A loja (vitrine, produto e carrinho) e as seletivas (lista e página) recarregam os dados quando estoque, preço, pedidos ou vagas mudam. O aviso sai **depois** do descarte do cache do site (DT-041), para a página não recarregar dados velhos; as tarefas que liberam estoque (reservas vencidas, remessas encerradas) também avisam. Mexer no carrinho não descarta o cache nem gera aviso.

### Consequências

- correção de passagem: o carrinho fica em `/cart`, e as mexidas nele geravam aviso de mudança à diretoria (DT-049); agora não geram;
- 8 testes de integração (ordem das fotos e capa no site, ordem inválida, descrição e permissão, opções com estoque e troca, troca sem estoque mantém o item, soma e opção de outro produto, fluxo público com assunto inválido e aviso ao mudar estoque), 6 testes de unidade da API (assuntos públicos e ordem cache → aviso) e 7 de interface (números, quantidade, ordem das fotos, campo de valor e galeria).

## DT-052 — Cache de dados nas telas

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto (aprovação de `docs/30-REVISAO-GERAL.md`, item R-08)

### Decisão

- **TanStack Query** 5.104.2 por trás do `useResource`, com a mesma interface (`data`, `error`, `loading`, `reload`, `setData`): nenhuma das 110 telas precisou mudar;
- **cache:** chave = caminho + parâmetros não vazios em ordem fixa. Telas que pedem o mesmo recurso dividem uma busca; dados vistos há menos de 30 s aparecem na hora ao voltar para a tela, que busca de novo ao ficar desatualizada ou quando a janela volta ao foco. Mudar só a página ou o filtro mantém a lista anterior até a nova chegar (sem piscar);
- **invalidação:** depois de qualquer alteração bem-sucedida pela API, todo o cache fica desatualizado (a tela aberta segue o que já fazia; as outras buscam ao abrir). Os avisos em tempo real (DT-049) invalidam num ponto só, com a mesma regra de quem recarrega e a mesma espera por quem está editando;
- **novas tentativas:** só para falha de rede ou do servidor (5xx), no máximo 2; validação, permissão e "não encontrado" não repetem;
- **privacidade:** um cache por renderização no servidor e um só no navegador; ao sair da conta, ou quando a sessão expira, o cache é apagado, para a próxima pessoa no mesmo computador não ver dados de quem saiu;
- buscas canceladas quando a tela não precisa mais delas (`AbortSignal`).

### Consequências

- menos chamadas à API ao navegar no painel e listas compartilhadas (equipes, categorias) buscadas uma vez;
- 4 testes de interface (chave estável, busca única, troca de página sem piscar, cache apagado).

## DT-053 — Produção com Docker, Nginx e armazenamento S3

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto (aprovação de `docs/30-REVISAO-GERAL.md`, itens R-06 e R-11)

### Decisão

- **imagens:** um `Dockerfile` com alvos `api`, `web` e `migrate`, base Node 24.22.0 fixada por digest, usuário sem privilégio, `tini` como processo inicial e `HEALTHCHECK`. O site usa a saída `standalone` do Next (só na imagem; local segue com `next start`). Medidos: site 411 MB, API 806 MB;
- **`docker-compose.prod.yml`:** PostgreSQL → `migrate` (aplica migrações e sai) → `preparar` (catálogo de papéis, permissões e plano de contas, repetível, e primeiro administrador por `SEED_ADMIN_*`) → API → site → Nginx. Só o Nginx publica portas; os demais ficam na rede interna. Volumes persistentes para banco e arquivos. S3 próprio opcional (perfil `s3-proprio`, SeaweedFS fixado por digest), já que o MinIO deixou de publicar imagens;
- **Nginx:** HTTP → HTTPS, TLS 1.2/1.3, HTTP/2, certificados montados (Let's Encrypt com desafio HTTP), uploads até 12 MB, API direto (sem passar pelo site), fluxos ao vivo sem buffer e com 1 h de leitura, cache longo para `/_next/static`, rota interna de cache do site bloqueada para fora. O cabeçalho `X-Forwarded-For` é **substituído** pelo IP real, para ninguém forjar o próprio IP;
- **IP real:** `TRUST_PROXY` (padrão `loopback`; em contêiner, `loopback,uniquelocal`) define quem pode informar o IP. Sem isso, atrás do Nginx todos os visitantes dividiriam o mesmo limite de requisições;
- **leituras do próprio site:** as páginas renderizadas no servidor chamam a API com o segredo já compartilhado (`SITE_REVALIDATE_SECRET`, cabeçalho `x-fenix-internal`, comparação em tempo constante) e ficam fora do limite por IP; antes, sob tráfego alto, o limite bloquearia o próprio site;
- **armazenamento S3 (R-11):** `STORAGE_DRIVER=s3` com AWS ou compatível (R2, B2, SeaweedFS, MinIO), criptografia no servidor ligada por padrão, bucket privado (a API continua sendo a única porta, com autorização). Endereço público exige `https`; serviço da rede interna pode usar `http`. Versionamento do bucket é recomendado para recuperar arquivos;
- **migração dos arquivos:** `npm run storage:migrate` copia cada arquivo do disco para o S3, confere o SHA-256 antes e depois (lendo de volta) e só então atualiza o registro; repetível; `--simular` só confere;
- **erros 500:** o log passa a trazer onde ocorreram (pilha de chamadas), ainda sem a mensagem.

### Consequências

- verificado de ponta a ponta numa pilha real (banco, migrações, preparo, API, site, Nginx com HTTPS e S3): páginas públicas, cabeçalhos de segurança, fluxo ao vivo, redirecionamento HTTP → HTTPS, rota interna bloqueada, cadastro de conta e foto de perfil gravada no S3 e lida de volta;
- **bug de implantação encontrado e corrigido:** num banco novo, sem o catálogo do seed, o cadastro de qualquer pessoa dava erro 500. A etapa `preparar` resolve;
- **arquivos fora do lugar no desenvolvimento:** o servidor local, iniciado antes da mudança de `STORAGE_LOCAL_DIR` (DT-038), gravava em `apps/api/var/storage`. Os 2 envios afetados foram copiados para o lugar certo (conferidos pelo hash); a API agora mostra no início onde guarda os arquivos e avisa se for dentro do projeto. Ver `PEN-065`;
- 3 testes de integração contra S3 real (opcionais, com `S3_TEST_ENDPOINT`) e 4 testes unitários (rede interna, regras do S3, proxy confiável, leitura interna).

## DT-054 — Prisma 7

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto (aprovação de `docs/30-REVISAO-GERAL.md`, item R-01)

### Decisão

- **versão 7.10.1** (CLI, cliente e `@prisma/adapter-pg`), adotada 11 dias após a publicação porque a 7.10.0 trazia no CLI uma dependência (`mysql2`) com falha alta, mesmo critério de `PEN-055`. O projeto só usa PostgreSQL;
- **gerador `prisma-client`** em CommonJS (`moduleFormat = "cjs"`), com saída em `apps/api/src/generated/prisma` (fora do git; gerado no `npm install`, antes do build, do typecheck e dos testes). As 61 importações de `@prisma/client` passaram a apontar para o cliente gerado;
- **adaptador do driver** obrigatório: `PrismaService` e `createPrismaClient()` usam `PrismaPg` com o endereço limpo dos parâmetros do Prisma e 5 s para conectar (padrão do Prisma 6; o `pg` esperaria para sempre). Fora de produção, sem `DATABASE_URL`, a aplicação sobe e só a consulta falha; em produção, falta de endereço impede iniciar;
- **`prisma.config.ts`** na raiz com o caminho do esquema, das migrações e do banco (lido do ambiente; opcional para gerar sem banco, como no Docker). O esquema não tem mais `url`;
- **`.env`:** o Prisma 7 não carrega mais o `.env` sozinho. Os scripts do projeto já usavam `dotenv`; um teste dependia sem saber do carregamento automático e foi corrigido para declarar o que precisa;
- **testes:** o motor novo carrega o compilador de consultas (WebAssembly) com `import()` dinâmico; o Jest da API roda com `--experimental-vm-modules`. A preparação do banco de testes usa o `pg` direto;
- **Docker:** a imagem da API leva o motor novo; a de migrações usa o CLI 7.10.1 e o `prisma.config.ts`.

### Consequências

- nenhuma mudança no esquema nem nas migrações; consultas, transações, travas de linha e `LISTEN/NOTIFY` seguem iguais;
- verificado: `npm run check` (lint, typecheck, 216 + 56 testes, build), 132 testes de integração, pilha Docker completa (migrações, preparo, cadastro e arquivo no S3) e a API local contra o banco de desenvolvimento;
- `prisma migrate dev` não gera mais o cliente sozinho: rodar `npm run prisma:generate` depois de mudar o esquema.

## DT-055 — NestJS 12

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto (aprovação de `docs/30-REVISAO-GERAL.md`, item R-02)

### Decisão

- **versões:** `@nestjs/common`, `core`, `platform-express` e `testing` 12.1.3; `@nestjs/swagger` 12.0.2; `@nestjs/cli` 12.0.8; `@nestjs/throttler` 6.7.1 (já aceita o 12). Todas com 14 dias ou mais. Os `overrides` da raiz passaram a fixar o Nest em 12.1.3;
- **continua CommonJS:** os pacotes do Nest 12 são só ESM, e o Node 24 permite `require` de ESM. O TypeScript do backend passou de `Node16` para `node20`/`nodenext`, o modo que entende isso (no `Node16`, o compilador recusa). O teste que protege essa configuração foi atualizado;
- **adaptador HTTP explícito:** `NestFactory.create(AppModule, new ExpressAdapter())` e o mesmo nos testes. A busca automática parte do `@nestjs/core`, na raiz do `node_modules`, e não achava o `@nestjs/platform-express`, que o npm instalou dentro da API. Sem isso, **a API não iniciava**; os testes não mostravam porque o problema só aparecia fora deles. Encontrado ao subir a API de verdade;
- **imagem Docker:** passa a copiar também `apps/api/node_modules`, pelo mesmo motivo;
- **DTOs com nome repetido** no Swagger (`CategoryDto`, `ReasonDto`), que virarão erro na próxima versão maior, receberam nomes por módulo (`FinanceCategoryDto`, `SportCategoryDto`, `AccessReasonDto`, `PartnerReasonDto`). A API sobe sem avisos.

### Consequências

- nenhuma mudança de comportamento; a mudança de ordem dos ganchos de ciclo de vida do Nest 12 não afetou nada (testes de integração passam);
- verificado: `npm run check`, 132 testes de integração, API local contra o banco de desenvolvimento (inclusive `/docs/openapi.json`) e a pilha Docker completa.

## DT-056 — TypeScript 7 com o 6 de compatibilidade

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto (aprovação de `docs/30-REVISAO-GERAL.md`, item R-03)

### Contexto

O TypeScript 7.0 (compilador nativo) ainda não tem a API em JavaScript que typescript-eslint, ts-jest, Next.js e o CLI do Nest usam; ela deve chegar na 7.1, hoje só em versões noturnas.

### Decisão

- **arranjo recomendado pela Microsoft:** `@typescript/native` → `typescript@7.0.2` (comando `tsc`) e `typescript` → `@typescript/typescript6@6.0.2` (API do 6.0.3 para as ferramentas, comando `tsc6`);
- **o TypeScript 7 verifica os tipos** de todo o projeto (`npm run typecheck`) e compila o pacote compartilhado; lint, testes, Next e o build do Nest usam o 6 até as ferramentas suportarem o 7;
- opções removidas no 7: a biblioteca compartilhada saiu de `CommonJS`/`node10` para `node20`/`nodenext` (continua gerando CommonJS). O backend já estava em `node20` (DT-055);
- decoradores do Nest (`experimentalDecorators`, `emitDecoratorMetadata`) passam na verificação do 7.

### Consequências

- verificado: `npm run check`, 132 testes de integração e a pilha Docker completa;
- medido na API: verificação de tipos em cerca de 7 s nas duas versões; o ganho de velocidade anunciado não apareceu neste projeto e nesta máquina;
- revisar quando o typescript-eslint, o ts-jest, o Next e o Nest suportarem a API do 7.1: aí sai o pacote de compatibilidade.

## DT-057 — Busca global no painel

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto (Fase 9, `docs/30-REVISAO-GERAL.md` §4 item 7)

### Decisão

- `GET /api/v1/search?q=` (mínimo 2, máximo 80 caracteres; `dashboard.read`; 60 por minuto) procura em atletas, pedidos (número e cliente), produtos (nome e SKU), parceiros, usuários (nome e e-mail), interessados, seletivas e notícias, até 5 por grupo;
- cada grupo só aparece para quem tem a permissão daquele módulo; o resultado traz nome, uma linha de contexto e o link, sem documento, telefone ou e-mail de terceiros;
- sem diferenciar maiúsculas nem acentos, com a extensão `unaccent` do PostgreSQL (migração `20261026200000_busca_sem_acento`); curingas digitados (`%`, `_`) são tratados como texto;
- no painel, botão "Buscar" e atalho Ctrl+K (⌘K), resultados enquanto se digita, setas e Enter.

### Consequências

- 3 testes de integração (acentos e link, curingas, tamanho mínimo e permissão).

## DT-058 — Painel financeiro com gráficos

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto (Fase 9, `docs/30-REVISAO-GERAL.md` §4 item 5)

### Decisão

- `GET /api/v1/finance/trend?months=` (3 a 24, padrão 12; `finance.read`): por mês, no fuso do clube, receita e despesa **confirmadas** (transferências entre contas não contam) e resultado. Com `fees.read`, também a inadimplência e o previsto a receber;
- **inadimplência do mês** = valor ainda em aberto das mensalidades daquele mês de referência que já venceram ÷ valor cobrado delas. Sem mensalidade vencida no mês, não há taxa (o gráfico mostra lacuna, não zero). **Previsto** = mensalidades em aberto que vencem nos próximos 30 dias;
- tela Caixa → Painel financeiro: números do mês, colunas de receita × despesa e linha de inadimplência, em SVG próprio (sem biblioteca). Cores validadas por ferramenta para daltonismo e contraste; dica ao passar o mouse e no foco do teclado; tabela equivalente; marcas do eixo em passos redondos.

### Consequências

- conferido com uma prévia renderizada: corrigidos rótulos do eixo cortados e marcas quebradas (1,3 mil), e o eixo repetido "R$ 0" num clube sem movimento;
- 3 testes de unidade da API, 3 de interface e 3 de integração (meses em ordem, só lançamentos confirmados, inadimplência só com permissão).

## DT-059 — App instalável (PWA)

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto (Fase 9, `docs/30-REVISAO-GERAL.md` §4 item 6)

### Decisão

- manifesto com ícones (DT-046) e **service worker conservador** (`public/sw.js`), registrado só em produção: guarda apenas arquivos estáticos com hash no nome e a pasta da marca; **nunca** páginas, respostas da API ou fotos, para que dados de uma conta não fiquem no aparelho. Sem internet, abre `/offline` ("Você está sem internet");
- botão "Instalar aplicativo" no rodapé, visível só quando o navegador oferece a instalação;
- CSP com `worker-src 'self'` e `manifest-src 'self'`; `/offline` fora da indexação.

### Consequências

- verificado na pilha Docker (modo produção): `/sw.js`, `/offline` e o manifesto servidos e liberados pela CSP. O comportamento no navegador entra nos testes de ponta a ponta;
- avisos no celular por notificação push ficam para depois: hoje os avisos saem por e-mail e WhatsApp (DT-048).

## DT-060 — Presença em treinos: cancelada

- **Estado:** Cancelada
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto ("cancela treinos e chamada", 2026-10-26)

### Decisão

- a presença em treinos (treinos por equipe e chamada por atleta), recomendada em `docs/30-REVISAO-GERAL.md` §4 item 3, foi cancelada durante a implementação, antes de qualquer entrega. Nada foi commitado; a migração aplicada só no banco de desenvolvimento foi desfeita (tabelas vazias removidas e o registro da migração apagado), e o esquema voltou a coincidir com o banco;
- o item volta para "itens futuros sem fase autorizada" do roadmap.

## DT-061 — Pendências no menu do painel e avisos flutuantes

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto ("mostrar bolinhas informando quando chegar coisas novas" e "notificações flutuantes em tempo real", 2026-10-26)

### Decisão

- **bolinhas do menu** (`GET /dashboard/badges`): contam o que espera ação, não o que cada pessoa já viu, para todos da diretoria verem o mesmo número e ele zerar quando a tarefa é feita. Pedidos: comprovantes a conferir + pedidos pagos a separar; Mensalidades: comprovantes a conferir; Interessados e Seletivas: novos; Agendamentos: pedidos; Fórum: denúncias abertas; Privacidade: pedidos de titulares em aberto. Cada contagem só sai com a permissão do módulo; o botão "Menu" do celular mostra o total; tudo se atualiza pelo tempo real (DT-049);
- **avisos à diretoria:** pedido novo, comprovante de pedido, comprovante de mensalidade, interessado novo e inscrição em seletiva viram notificação para quem tem a permissão do módulo. Finalidade nova **"Tarefas da diretoria"** (`OPERATIONS`, tipos `staff.*`): no painel sempre, e-mail e WhatsApp desligados por padrão, para não lotar a caixa de entrada; só quem acessa o painel vê essa finalidade nas preferências. O aviso roda depois da operação e nunca a desfaz;
- **avisos flutuantes:** ao chegar uma notificação nova, ela surge no canto superior direito, some em 7 s (pausa com o mouse ou o foco), pode ser fechada ou clicada para abrir; no máximo 3 de uma vez; só o que chegou depois de a página abrir.

### Consequências

- migração `finalidade_tarefas_diretoria` (valor novo no enum);
- 3 testes de integração (interessado novo soma na bolinha e avisa a diretoria; sem pendência o item some; finalidade só para a diretoria, com e-mail desligado).

## DT-062 — Excluir contas financeiras e remessas sem apagar histórico

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto ("poder excluir Contas financeiras criadas, poder criar, editar, excluir (CRUD) e remessas? [...] e cupons", 2026-10-26)

### Decisão

- **conta financeira:** exclusão lógica (`deletedAt`) só quando a conta nunca foi movimentada (sem lançamentos, transferências nem fechamentos). Com uso, a API recusa (409) dizendo onde está em uso e sugere inativar, que esconde a conta sem perder o histórico (AGENTS.md: registros financeiros não podem sumir). A única conta ativa não pode ser excluída, senão o clube fica sem onde registrar recebimentos. A tela usa o mesmo gerenciador das categorias (editar nome, inativar/reativar, excluir com motivo);
- **remessa:** exclusão lógica só em rascunho, agendada ou cancelada e sem nenhum item de pedido; remessa aberta precisa ser cancelada antes, e remessa com pedidos fica para sempre (os pedidos e estornos apontam para ela). Ao excluir, os produtos vinculados saem junto e itens de carrinho que apontavam para ela são removidos (carrinho não é histórico). A tela de detalhes ganha **Editar** (nome, descrição, política, previsão de chegada; período e quantidades só até a encomenda, como a API já exigia) e **Excluir**;
- **cupons:** o cadastro completo já existia (criar, editar, ativar/inativar, excluir sem uso), sem mudança;
- toda exclusão pede motivo e vai para a auditoria (`finance.account.deleted`, `campaign.deleted`).

### Consequências

- `DELETE /finance/accounts/:id` (`finance.setup`) e `DELETE /campaigns/:id` (`campaigns.manage`);
- 2 testes de integração (conta usada recusada e preservada; conta sem uso excluída; remessa aberta e com pedido recusadas; rascunho editado e excluído).
- correção junto: o ajuste de estoque (+/−) não aceitava o sinal de menos depois de o campo virar só números (DT-051); ganhou o modo "inteiro com sinal", com o teclado comum no celular.

## DT-063 — Logos de cada contexto usadas no site

- **Estado:** Aceita
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto ("existe logo dos times, mas elas não são usadas de fato", 2026-10-26)

### Decisão

As imagens enviadas em Configurações → Marca passam a aparecer onde fazem sentido; sem a do contexto, usa-se o brasão oficial (`lib/brand.ts`):

- **time masculino / feminino:** nos cartões "Nossos times" do Início, no título de Times quando filtrado e em cada time da página Times (misto e outros usam o brasão);
- **diretoria:** no topo do menu do painel;
- **capa:** faixa no topo do Sobre e imagem padrão ao compartilhar links do site (sem capa, o brasão). Notícias continuam com a própria capa.

## DT-064 — Logo própria em cada equipe

- **Estado:** Aceita (substitui a parte "time masculino / feminino" da DT-063)
- **Data:** 2026-10-26
- **Aprovador:** responsável do projeto ("seria bom transferir essa parte de imagens para dentro das configurações dos times criados [...] ficaria lá apenas a logo do time oficial", 2026-10-26)

### Contexto

As logos "time masculino" e "time feminino" ficavam em Configurações e eram associadas pelo **tipo** da equipe: qualquer equipe masculina herdava a mesma logo, e equipes de outros tipos (ex.: 4x4, misto) não tinham como ter logo própria.

### Decisão

- cada equipe tem `logoMediaFileId` (opcional), enviado em Painel → Equipes, na edição do time (`PUT /teams/:id/logo`, `DELETE /teams/:id/logo`, permissão `teams.manage`); imagem pública validada e otimizada como as demais logos; troca e remoção auditadas;
- sem logo própria, o site usa o brasão oficial;
- no site: cada cartão em Times mostra a logo da equipe; o título de Times filtrado e os cartões Masculino/Feminino do Início usam a logo da primeira equipe daquele tipo que tenha logo;
- Configurações → Marca fica com **brasão oficial, logo da diretoria e capa**, que não pertencem a uma equipe; o envio de "masculino"/"feminino" lá passa a responder 422 (`TEAM_LOGO_MOVED`) indicando Equipes;
- a migração `logo_por_equipe` copia as logos antigas para as equipes desse tipo e remove as duas entradas de Configurações, para nada sumir do site. Equipes criadas depois começam sem logo (brasão) até receberem a própria.

### Consequências

- 1 teste de integração (permissão, envio sem arquivo, envio, elenco público com a logo, remoção) e ajuste do teste de logos de Configurações.

## DT-065 — Excluir conta financeira com histórico

- **Estado:** Aceita (amplia a DT-062)
- **Data:** 2026-10-27
- **Aprovador:** responsável do projeto ("não consigo excluir contas desativadas e nem excluir", 2026-10-27)

### Contexto

A DT-062 só deixava excluir conta nunca movimentada e, nas demais, sugeria inativar. Conta já inativa ficava sem saída e a lista crescia sem fim.

### Decisão

- conta sem lançamentos, transferências nem fechamentos: exclusão lógica direta (como antes);
- conta com histórico: exclusão lógica permitida se estiver **inativa**, **sem lançamento pendente** e com **saldo zero** (calculado de todos os lançamentos confirmados). Os lançamentos, transferências e fechamentos continuam ligados à conta e aparecem nos relatórios pelo nome; nada do histórico financeiro é apagado ou reescrito (AGENTS.md);
- conta com saldo: recusa (`BALANCE_NOT_ZERO`) pedindo transferir o saldo antes; ativa: recusa (`ACCOUNT_ACTIVE`) pedindo inativar antes; a única conta ativa não pode ser excluída;
- a verificação trava a conta (`FOR UPDATE`) para nenhum lançamento entrar no meio; motivo, contagens e saldo vão para a auditoria;
- na tela, contas inativas ficam recolhidas em "Contas inativas (N)".

## DT-066 — Mensalidades de planos inativados ou excluídos

- **Estado:** Aceita (complementa RN-MEN-001)
- **Data:** 2026-10-27
- **Aprovador:** responsável do projeto ("existe um plano ativo, mas ainda tem muitas mensalidades antigas ainda vigentes. construa a regra de negócio das mensalidades desativadas ou apagadas", 2026-10-27)

### Contexto

Inativar ou excluir um plano não tocava nas cobranças já geradas: mensalidades futuras de um plano excluído continuavam em aberto para sempre, e os atletas seguiam vinculados a ele (sem poder receber outro plano).

### Decisão

Mesmo padrão da inativação de atleta (COR-018):

- **inativar:** antes de confirmar, a tela mostra o impacto (`GET /fee-plans/:id/impact`: atletas vigentes, mensalidades canceláveis e as que continuam) e oferece, já marcados: cancelar as mensalidades **do mês atual em diante sem nenhum pagamento** e encerrar hoje o vínculo dos atletas. Com algum efeito, o motivo é obrigatório;
- **excluir:** os dois efeitos valem sempre (plano excluído não pode seguir cobrando); antes era recusado com atletas vigentes;
- **nunca mudam:** mensalidades de meses passados (dívida real) e qualquer mensalidade com pagamento; reativar o plano não recria o que foi cancelado;
- cada mensalidade cancelada e cada vínculo encerrado gera auditoria com o motivo;
- dados anteriores à regra: `npm run db:fees-ended-plans` (simula; grava com `--apply`) aplica o mesmo aos planos já excluídos, com auditoria `maintenance.fee_plan.ended`.

## DT-067 — Avisos de notícias, eventos e tópicos do fórum

- **Estado:** Aceita
- **Data:** 2026-10-27
- **Aprovador:** responsável do projeto ("colocar nas opções para receber avisos sobre notícias, eventos, fórum por e-mail ou WhatsApp (qualquer usuário pode configurar se recebe ou não)", 2026-10-27)

### Decisão

- finalidades novas: **Notícias do clube** (`NEWS`), **Eventos e jogos** (`EVENTS`) e **Novos tópicos no fórum** (`FORUM_TOPICS`); "Fórum" passa a se chamar "Fórum: respostas aos meus tópicos e moderação";
- disponíveis para qualquer conta; começam **desligadas**. Só quem liga e-mail ou WhatsApp recebe (inclusive o aviso no painel), para ninguém ser inundado;
- notícia: ao publicar agora, ou quando a agendada fica visível (rotina a cada 5 min); evento: público, agendado e ainda por acontecer; tópico: só em categoria pública, sem avisar o autor;
- cada conteúdo é anunciado uma vez (`announcedAt` + chave idempotente por pessoa); conteúdo com mais de 7 dias não é anunciado; o que já estava no ar na atualização foi marcado como anunciado;
- envio em lotes de 500 pessoas pela fila de entregas existente (DT-048); falha no aviso nunca desfaz a publicação.

## DT-068 — Carteirinha digital: atleta e afiliado, benefícios de parceiros

- **Estado:** Aceita
- **Data:** 2026-10-27
- **Aprovador:** responsável do projeto (regras A a G aprovadas em 2026-10-27; "a carteirinha será usada para conseguir desconto em lojas parceiras e outras coisas"; "QR só confere"; "a diretoria faz a suspensão quando achar necessário"; menores "foto só com autorização"; afiliação "como pedido da loja", "período em meses", impressão "incluir agora")

### Decisão

**A. Tipos.** *Atleta:* quem faz parte do time; gratuita, existe enquanto o atleta estiver Ativo. *Afiliado:* qualquer pessoa compra um plano de afiliação na loja e ganha os benefícios dos parceiros. Diretoria só tem carteirinha se também for atleta ou afiliado.

**B. Situações.** Ativa, suspensa (pela diretoria, com motivo, quando achar necessário), vencida (afiliação depois da data final) e cancelada. Nada suspende sozinho (atraso de mensalidade não afeta). Suspensa: o dono vê "Carteirinha suspensa, fale com a diretoria"; quem confere vê "inválida". Carteirinha de atleta também é inválida se o atleta não estiver Ativo.

**C. QR e conferência.** O QR leva só um código assinado (sem dado pessoal) que muda a cada minuto e vale no máximo 2 minutos; print não serve. Ler o QR abre `/validar/<código>`: válida/inválida, tipo, nome curto (ex.: "Ana S."), foto, validade (afiliado) e os benefícios que valem para aquele tipo. Parceiro só confere, sem login e sem registrar uso. Quem tem a permissão **Conferir carteirinhas** (`cards.read`) vê, logado, nome completo, equipes e situação; "mensalidade em dia" só com `fees.read`. Reemitir (com motivo) cria versão nova e invalida na hora os QR anteriores, inclusive o impresso.

**Menores de idade.** Para quem confere sem login, a foto só aparece se o responsável autorizou o perfil público do menor; sem autorização, só o primeiro nome e "menor de idade: confira documento". A diretoria sempre vê a foto.

**D. Benefícios.** Por parceiro: título, desconto em % (1 a 100), condições opcionais (texto), para quem vale (Atletas, Afiliados ou Ambos), início e fim opcionais, ativo/inativo. Criar, editar, desativar/reativar e excluir (lógico). Só aparecem os ativos, dentro do período e de parceiro ativo; aparecem na página do parceiro no site e na carteirinha.

**E. Administração** (Painel → Carteirinhas; permissões `cards.manage` e `benefits.manage`). Lista com filtro por tipo e situação; suspender/reativar e cancelar (com motivo), reemitir, estender a validade de afiliado, corrigir nome de beneficiário (só erro de digitação, com motivo) e histórico de conferências.

**F. Visual.** Três modelos prontos (Clássico escuro e vermelho, Claro, Faixa), logo oficial (ou a logo da equipe, para atleta) e imagem de fundo opcional enviada pela diretoria; configuração única para todas as carteirinhas.

**Impressão.** Botão Imprimir gera a carteirinha no tamanho de cartão (85,6 × 54 mm, frente e verso). O impresso tem QR fixo daquela versão (o papel não muda a cada minuto); reemitir o invalida.

**G. Registro e privacidade.** Cada conferência registra carteirinha, instante e resultado, sem dados de quem leu; retenção de 12 meses. Quem confere nunca vê CPF, contato, idade ou mensalidade.

**Afiliação na loja** (detalhe aprovado em 2026-10-27: "a afiliação é especial [...] quantidade de vezes comprada é preciso informar o nome do beneficiário 1, 2 [...] a diretoria informa o tempo de validade [...] podendo estender, revogar benefícios quando quiser [...] é de uso pessoal"):

- produto do tipo **Afiliação**, com preço e validade em meses definidos pela diretoria;
- comprar quantidade N exige N beneficiários (nome completo obrigatório, e-mail opcional; o beneficiário 1 vem preenchido com quem compra);
- pagamento confirmado: nasce uma carteirinha de afiliado por beneficiário, da confirmação até a data final. Com e-mail de conta existente, aparece na conta do beneficiário; senão, em "Carteirinhas que comprei" de quem pagou, e passa para o beneficiário quando ele criar conta com aquele e-mail;
- pessoal e intransferível; renovar (comprar de novo para a mesma carteirinha) soma ao período atual; aviso 15 dias antes de vencer;
- enquanto houver afiliação à venda, o Início mostra o bloco "Afiliações abertas", e o painel tem o botão "Avisar todos" (uma notificação, finalidade "Avisos da diretoria").

## DT-069 — Produtos personalizados

- **Estado:** Aceita
- **Data:** 2026-10-27
- **Aprovador:** responsável do projeto ("a Fênix vende produtos personalizados com tamanho, variação de modelo e cor, nome na camisa, isso tem que entrar como um cadastro especial da loja"; ajuste: "adicione na planilha para envio tamanho")

### Decisão

- a diretoria marca o produto como **personalizado** e define os campos (ex.: "Nome na camisa", texto até 12 letras, maiúsculas automáticas; "Número", de 0 a 99), cada um obrigatório ou opcional e com acréscimo de preço opcional;
- tamanho, modelo e cor continuam como variações; a página do produto os mostra como seletores por atributo, com guia de medidas opcional;
- no carrinho, cada personalização diferente é uma linha própria, editável até fechar o pedido; depois do pagamento a personalização fica travada;
- a planilha de produção da remessa (envio à malharia) traz, por peça, **tamanho, modelo, cor, nome e número**;
- no checkout, item personalizado exige marcar "Este item é personalizado: não tem troca ou devolução por arrependimento".

## DT-070 — Entrega comprovada, desistência e defeito

- **Estado:** Aceita
- **Data:** 2026-10-27
- **Aprovador:** responsável do projeto ("ao comprar online qualquer item da loja o usuário tem direito a pedir reembolso com 7 dias [...] produtos feitos personalizadamente não têm reembolso"; prazo "da retirada do produto"; prova de entrega "foto ou confirmação")

### Decisão

- **entrega comprovada:** ao registrar a retirada, a diretoria anexa uma foto (item entregue ou documento assinado) **ou** o comprador toca em "Recebi" em Meus pedidos. Sem nenhum dos dois, a retirada fica "aguardando confirmação" e o comprador é avisado; os prazos só começam com uma das provas;
- **arrependimento (CDC art. 49):** "Desistir da compra" em Meus pedidos até 7 dias depois da entrega comprovada, para itens não personalizados; afiliação, 7 dias a partir da ativação (a carteirinha é cancelada). Não exige motivo. Pedido ainda não retirado pode ser cancelado com estorno. Dentro do prazo, a diretoria não pode negar: registra a devolução do item e faz o estorno integral pelo fluxo do Caixa;
- **defeito (CDC arts. 18 e 26):** "Problema com o produto" por 90 dias depois da entrega comprovada, para qualquer item, inclusive personalizado; a diretoria analisa e resolve com troca, conserto ou estorno, sempre com resposta registrada;
- solicitações geram aviso e bolinha no painel; os textos dos direitos aparecem na página do produto, no carrinho, no checkout e em Termos;
- ressalva registrada: a exclusão de personalizados do arrependimento segue o entendimento usual dos tribunais, não um texto expresso do CDC; recomenda-se conferência jurídica antes da publicação.

## DT-071 — PIX automático

- **Estado:** Aceita
- **Data:** 2026-10-27
- **Aprovador:** responsável do projeto (intermediário "Mercado Pago"; alcance "pedidos e mensalidades"; "PIX com comprovante continua como alternativa"; validade "pedido: reserva; mensalidade: 24 h")

### Decisão

- módulo `pix` com conector trocável (`PIX_PROVIDER`): `sandbox` (modo de teste: QR com chave fictícia, pagamento só por "Simular pagamento"; proibido em produção), `mercadopago` (`/v1/payments` com `payment_method_id: pix`) ou `off`;
- o QR vale pela reserva do pedido (mínimo de 30 minutos, exigência do Mercado Pago; com menos, a tela orienta usar o comprovante) e por 24 horas na mensalidade; QR pendente que ainda vale é reaproveitado;
- **baixa:** o aviso do intermediário (webhook) só é aceito com assinatura válida (HMAC-SHA256 sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, conforme a documentação oficial) e nunca é usado sozinho: a situação é sempre buscada no intermediário. Avisos repetidos são ignorados (`pix_webhook_events`); uma conferência a cada 2 minutos cobre avisos perdidos;
- pago e conferido: cria o pagamento (intermediário e referência guardados), confirma e lança a entrada no Caixa sem pessoa da diretoria (auditoria com ator "sistema"), pela mesma rotina do pagamento manual;
- pago fora do esperado (pedido cancelado ou vencido, valor diferente do saldo, mensalidade cancelada): **nada é baixado**; a cobrança fica "para revisar", a diretoria recebe aviso e bolinha em Painel → PIX automático, estorna no intermediário ou registra manualmente e marca como resolvido (com motivo);
- a conta do Caixa que recebe é escolhida no painel (padrão: "Conta bancária / PIX");
- o PIX com comprovante continua disponível ao lado, e o intermediário fora do ar só desliga o botão automático;
- segredos só no ambiente; token nunca em log ou mensagem de erro; o QR guarda só o "copia e cola".

### Consequências

- tabelas `pix_charges` e `pix_webhook_events`; `team_settings.pix_account_id`; confirmação de pagamento aceita ator nulo (sistema);
- testes: assinatura, CRC do BR Code e conector do Mercado Pago (unidade, com a API simulada); pedido, mensalidade, revisão e visitante (integração, modo de teste). O conector real só é exercitado com credenciais do clube (passo a passo em `docs/COMO-EXECUTAR.md`).

## DT-072 — Aba Afiliação no painel

- **Estado:** Aceita
- **Data:** 2026-10-27
- **Aprovador:** responsável do projeto ("assim como existe uma aba para remessas eu gostaria de uma aba para a afiliação")

### Decisão

- área própria no painel, **Afiliação**, com abas: Visão geral, Planos de afiliação, Benefícios, Carteirinhas e Visual da carteirinha; sai de Loja → Produtos e de Parceiros;
- o plano de afiliação **continua sendo um produto da loja** (tipo afiliação) por baixo, para manter carrinho, beneficiários, pagamento, PIX, desistência e estorno iguais aos da DT-068/DT-070. Nenhuma regra de negócio mudou;
- plano novo pela aba: nome, preço (por carteirinha), validade em meses e descrição; nasce como rascunho na categoria "Afiliação" da loja, criada na primeira vez; edição com preço promocional, período de venda opcional (de/até, que pode ser limpo), limite por comprador, destaque, fotos, publicar, pausar venda, excluir (com motivo) e aviso "afiliações abertas";
- validade alterada vale para as próximas vendas; carteirinhas já emitidas mantêm a data (estender é ação da carteirinha);
- visão geral: afiliados válidos, vencendo em 15 dias, suspensas e vencidas, atletas com carteirinha, benefícios valendo, planos com carteirinhas ativas/emitidas e benefícios valendo hoje;
- carteirinhas filtráveis por plano; Produtos lista só mercadorias e não oferece mais o tipo afiliação; endereços antigos (`/admin/carteirinhas`) redirecionam.

### Consequências

- rotas `POST /store/memberships`, `GET /cards/overview`, filtros `kind` (produtos) e `planId` (carteirinhas); `availableFrom/Until` aceitam string vazia para limpar;
- produto de afiliação nasce com uma única variação "Afiliação";
- testes: integração (criação, permissões, visão geral por plano, filtros e período de venda) e E2E da aba em 390 px e 1280 px.

## DT-073 — Permissões novas sincronizadas ao iniciar a API

- **Estado:** Aceita
- **Data:** 2026-10-27
- **Motivo:** as permissões da carteirinha (`cards.read`, `cards.manage`, `benefits.manage`) existiam no código, mas só chegavam ao banco com `npm run db:seed`; a diretoria recebia "Você não tem permissão para esta ação" na aba Afiliação.

### Decisão

- ao subir, a API roda a mesma sincronização do seed (`syncAccessCatalog`): cria permissões novas do catálogo e as concede aos papéis de sistema conforme o padrão (administrador: todas; diretoria: todas menos governança);
- permissões que a administração removeu de um papel continuam removidas (só se concede o que o banco ainda não conhecia);
- falha na sincronização (ex.: duas instâncias ao mesmo tempo) só gera aviso e não impede a API de subir.

### Consequências

- nenhuma versão nova depende de lembrar o seed para liberar telas; `npm run db:seed` continua servindo para o primeiro administrador.

