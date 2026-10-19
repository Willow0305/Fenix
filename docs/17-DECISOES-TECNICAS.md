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
