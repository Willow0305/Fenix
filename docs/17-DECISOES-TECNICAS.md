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
- enquanto algoritmo e codificação permanecem abertos, os hashes de sessão e recuperação usam coluna textual sem comprimento associado a uma estratégia específica;
- a exclusão física do usuário é restringida pelas sessões e tokens; limpeza posterior exige política de retenção e operação explícita;
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

Fixar `postcss` e `sharp` em versões corrigidas por `overrides` no workspace raiz e declarar as mesmas versões diretamente em `apps/web` para que o npm 11 gere uma resolução segura no lockfile. Manter o Next.js somente como dependência funcional de `apps/web`. Usar temporariamente a linha segura `9.x` de `concurrently`.

### Consequências

- `npm audit`, testes e build precisam passar após toda atualização do lockfile;
- os `overrides` na raiz restringem dependências transitivas sem mover o runtime do frontend para o manifesto raiz;
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

## DT-021 — Resolução de módulos Node16 nos pacotes compartilhados

- **Estado:** Aceita
- **Data:** 2026-07-24

### Contexto

Após a correção do backend, `packages/config/typescript/library.json` ainda usava `moduleResolution: "Node"`, interpretado pelo TypeScript como `node10`. A configuração era herdada por `@fenix/types`, `@fenix/ui` e `@fenix/validation`, mantendo nesses pacotes a mesma estratégia descontinuada que deixará de funcionar no TypeScript 7.

### Decisão

Usar o par coerente `module: "Node16"` e `moduleResolution: "Node16"` também na configuração dos pacotes compartilhados. Os pacotes continuam sem emissão própria e, na ausência de `"type": "module"` em seus manifestos, preservam a semântica CommonJS necessária à configuração atual de Jest e aos consumidores.

### Consequências

- nenhum workspace TypeScript herda mais a resolução legada `node10`;
- os pacotes compartilhados seguem as regras modernas de resolução de pacotes do Node sem exigir migração para ESM;
- testes de regressão resolvem os `tsconfig.json` de `@fenix/types`, `@fenix/ui` e `@fenix/validation` pela API do TypeScript;
- uma futura publicação com artefatos emitidos ou migração para ESM continua exigindo decisão e revisão próprias.

## DT-022 — Baseline documental e abertura controlada da Fase 1

- **Estado:** Aceita
- **Data:** 2026-07-24

### Contexto

A Fase 0 possuía base técnica validada, mas ainda dependia da aprovação explícita da baseline documental e da nomeação de responsáveis. Em 24/07/2026, William Nascimento aprovou a baseline documental para orientar a Fase 1. William Nascimento Oliveira assumiu provisoriamente a responsabilidade de Produto, enquanto Tecnologia, Financeiro, Privacidade e Segurança seguem pendentes de nomeação formal antes da produção.

### Decisão

Considerar `PEN-001` resolvida e permitir a preparação da Fase 1 somente em ambiente local/teste com dados fictícios. Manter `PEN-002` parcialmente resolvida e bloqueadora para produção, staging público, dados reais e resposta formal a incidentes até a nomeação completa dos responsáveis.

### Consequências

- a Fase 1 pode começar pela base de identidade, autenticação, sessões, RBAC e painel administrativo mínimo;
- nenhuma funcionalidade com dados reais, menores de idade ou exposição pública de produção fica autorizada por esta decisão;
- mudanças futuras na baseline precisam registrar justificativa, impacto, decisão e changelog;
- os gates P0 de LGPD, segurança, menores, infraestrutura e produção continuam aplicáveis.

## DT-023 — Matriz documental inicial de papéis e permissões da Fase 1

- **Estado:** Aceita
- **Data:** 2026-07-24

### Contexto

`PEN-007` bloqueava a Fase 1 por falta de alçadas detalhadas para administrador, diretoria, atleta, responsável, moderador, financeiro e parceiro. O anexo aprovado em 24/07/2026 detalhou perfis, funções da diretoria, conselheiros, separação entre Tesoureiro e Assistente Financeiro, limites de parceiro e perfil de Comunicação Externa.

### Decisão

Adotar a matriz documental registrada em `05-PERFIS-E-PERMISSOES.md` como referência inicial da Fase 1. O sistema deve negar por padrão, permitir múltiplas funções por conta, validar permissão no servidor e auditar ações sensíveis.

### Consequências

- `PEN-007` fica resolvida para documentação da Fase 1;
- `PEN-008` continua definindo o bloqueio de cadastro, aprovação e vínculo de contas;
- `PEN-010` continua bloqueando uso real com menores até decisão jurídica, técnica e de segurança;
- permissões técnicas, seeds e testes devem seguir a matriz aprovada sem conceder poderes implícitos por texto de interface.

## DT-024 — Schema Prisma físico incremental por fase

- **Estado:** Aceita
- **Data:** 2026-07-27

### Contexto

O schema produzido na Fase 0 reunia os 66 modelos e 53 enums do produto futuro para
validar o desenho conceitual. Usá-lo diretamente na primeira migration criaria
tabelas das Fases 2 a 8 e tabelas da própria Fase 1 ainda dependentes de decisões
abertas, contrariando o roadmap e o princípio de minimização. A resolução de
`PEN-052` aprovou a separação entre a referência conceitual e o contrato físico
executável.

### Decisão

Manter `prisma/schema.prisma` como o único schema consumido pelos comandos Prisma
de validação, geração e migration. Esse arquivo contém somente modelos promovidos
da fase e da tarefa autorizadas.

Preservar o modelo completo em `docs/08-MODELO-DE-DADOS.md`,
`docs/09-DICIONARIO-DE-DADOS.md`, `docs/diagramas/ERD.md` e no arquivo
`docs/referencias/schema-conceitual.prisma`. O arquivo de referência não participa
de `prisma migrate` e não representa tabelas existentes.

O primeiro recorte físico da Fase 1 será a migration
`fase_1_identidade_acesso`, limitada a `User`, `UserSession`, `UserToken`, `Role`,
`Permission`, `UserRole` e `RolePermission`. `AuditLog`, configurações, mídias,
seed administrativo, API e interface serão promovidos em tarefas próprias, sem
antecipar módulos.

### Consequências

- uma migration não pode criar tabela ou enum fora da allowlist da tarefa;
- cada promoção exige decisão/fase válida, revisão do SQL, teste de escopo,
  documentação e changelog;
- o CI aplica migrations em PostgreSQL vazio, repete o deploy, consulta o catálogo
  e compara a estrutura resultante ao schema físico;
- o schema conceitual pode evoluir como planejamento sem alterar o banco;
- o schema físico e o histórico de migrations passam a ser a fonte da estrutura
  realmente implantável;
- dados fictícios e ambiente local/teste continuam obrigatórios;
- produção, dados reais, menores, uploads e Fases 2 a 8 permanecem bloqueados
  pelos respectivos gates.

## DT-025 — Administração e auditoria defensivas com parâmetros provisórios

- **Estado:** Aceita para desenvolvimento local/teste
- **Data:** 2026-07-27

### Contexto

O objetivo `fase_1_admin_auditoria` exige autenticação, primeiro administrador,
RBAC e trilha funcional sem aguardar a definição canônica de todos os parâmetros
de `PEN-013`. A mesma pendência impede tratar duração de inatividade, bloqueios,
refresh, MFA e verificação de e-mail como política final de produção.

### Decisão

Implementar o recorte com bcrypt configurável, access JWT curto em cookie
`HttpOnly`, refresh opaco rotativo armazenado por HMAC, CSRF de duplo envio
vinculado à sessão, bloqueio temporário por conta, recuperação por código de uso
único armazenado por HMAC e expiração por inatividade. Os valores de
`.env.example` são defaults defensivos locais e continuam provisórios.

Criar o administrador exclusivamente por comando, sob trava transacional, apenas
quando nenhum administrador existe e com bloqueio absoluto em `production`.
Catalogar `ADMIN`, `BOARD`, `FINANCE` e `USER`; somente `ADMIN` recebe todas as
permissões administrativas desta tarefa, `BOARD` recebe consulta limitada e os
demais não recebem capacidades de fases futuras.

Persistir `AuditLog` append-only, com filtro de chaves sensíveis, contexto de
requisição hasheado, consulta protegida por `audit.read` e trigger PostgreSQL que
rejeita `UPDATE`/`DELETE`. Usar Mailpit apenas como adaptador efêmero local; nenhum
provedor de e-mail de produção foi escolhido.

### Consequências

- login, logout, recuperação, redefinição, refresh, expiração, usuários, RBAC e
  auditoria podem ser testados localmente com dados fictícios;
- reuso de refresh revoga sessões ativas e alterações de estado/papel também
  revogam quando necessário;
- senhas, tokens, códigos e cookies não entram na trilha de auditoria;
- verificação de e-mail, MFA, rate limit distribuído, limite global de sessões e
  parâmetros canônicos continuam pendentes em `PEN-013`/`PEN-050`;
- identidade visual e conteúdo das telas são provisórios;
- produção, dados reais, Fases 2 e 3 e qualquer coleta médica permanecem fora do
  escopo.

## DT-026 — Segurança canônica da Fase 1 e gates de produção

- **Estado:** Aceita para a entrega técnica; produção continua bloqueada
- **Data:** 2026-07-29

### Contexto

A tarefa de finalização da Fase 1 definiu parâmetros exatos, verificação de
e-mail, MFA, rate limit distribuído, e-mail transacional, retenção e condições
obrigatórias de inicialização. DT-025 permanece como histórico do recorte
anterior e é sucedida por esta decisão nos pontos agora definidos.

### Decisão

- access/inatividade de 45 minutos e sessão absoluta de 30 dias;
- recuperação por 10 minutos e até cinco tentativas;
- cinco falhas de login em 15 minutos e bloqueio inicial de 15 minutos;
- verificação de e-mail por token de uso único, hash, 24 horas e reenvio limitado;
- refresh opaco rotativo e de uso único, CSRF vinculado à sessão;
- MFA TOTP obrigatório para todos os papéis privilegiados e opcional para
  `USER`, com segredo criptografado e recuperação de uso único;
- Redis obrigatório para rate limit em staging/produção, com adaptação local
  controlada;
- adaptador SMTP com Mailpit local e configuração explícita fora do local;
- aplicação recusa produção sem responsáveis, contatos, Redis, cookies seguros,
  segredos fortes e aceite de release;
- solicitações do titular, retenção rastreável e metadados de anexo privado são
  estrutura técnica, não política jurídica inventada.

### Consequências

- nenhum token, segredo MFA ou código é persistido em claro ou auditado;
- o último administrador não pode perder a única forma segura de acesso;
- `PEN-013` deixa de bloquear a conclusão técnica local, mas domínio/cookies,
  cofre, LGPD, canal de segurança, responsáveis e operação continuam bloqueando
  produção;
- a entrega não certifica conformidade jurídica nem autoriza dados reais.

## DT-027 — Perfil esportivo separado e proteção de menores por desenho

- **Estado:** Aceita para a primeira entrega vertical da Fase 2
- **Data:** 2026-07-29

### Contexto

Conta de acesso, atleta, inscrição e responsável possuem ciclos de vida
distintos. Dados reais de menores e de saúde não estão autorizados.

### Decisão

Promover `AthleteProfile` separado de `User`, histórico temporal de
equipe/categoria, responsável e autorização por metadados privados, seletivas,
inscrições e histórico de estados. Conversão ocorre somente por ator autorizado,
em transação serializável e com auditoria. Fingerprint HMAC apenas sinaliza
possível duplicidade; nunca há fusão automática. Menor exige responsável e
autorização válida. Importação permanece somente modelada, sem processamento.

### Consequências

- criar conta comum nunca cria atleta;
- vínculos anteriores não são sobrescritos;
- dados fictícios de menores são permitidos apenas em local/teste;
- não existem campos de diagnóstico, laudo, prontuário ou saúde;
- jornadas públicas, área de atleta/responsável e dados reais dependem de LGPD,
  ECA Digital e decisões institucionais.

## DT-028 — Razão financeiro imutável e segregação do Caixa Fênix

- **Estado:** Aceita para a primeira entrega vertical da Fase 3
- **Data:** 2026-07-29

### Contexto

O Caixa precisa preservar valores históricos, suportar parcial/excedente,
evitar baixa duplicada e separar registro de decisão.

### Decisão

Usar BRL e `Decimal`/`NUMERIC(19,4)`. Planos recebem versões imutáveis;
cobranças preservam competência, vencimento e valor. Pagamentos são conciliados
explicitamente por alocações; parcial mantém saldo e excedente exige destino.
Assistente/`FINANCE` cria pendências; `TREASURER` concilia, aprova, rejeita,
reverte, decide transferências e fecha caixa. Transferência é neutra por duas
pernas. Saldo é derivado do razão; correção cria reversão vinculada. Operações
críticas exigem `Idempotency-Key` e transação serializável.

### Consequências

- versões, conciliações, alocações, fechamentos e razão aprovado recebem
  proteção física contra alteração/exclusão destrutiva;
- pagamentos parciais, excedentes, concorrência e fechamento possuem testes
  integrados;
- estorno genérico não pode contornar fluxos específicos de pagamento ou
  transferência;
- gateway, PIX real, mensalidade automática, reembolso completo, comprovante
  real e reabertura formal continuam fora da entrega.

## DT-029 — Migrations das Fases 2 e 3 estritamente aditivas

- **Estado:** Aceita
- **Data:** 2026-07-29

### Contexto

As novas estruturas precisavam preservar bancos existentes da Fase 1 e garantir
paridade real entre Prisma e PostgreSQL.

### Decisão

Criar migrations independentes para esportivo, vínculo de responsável e Caixa
Fênix, sem apagar/renomear tabelas ou colunas anteriores. Constraints e triggers
que o Prisma não expressa são mantidos em SQL revisado. O gate deve validar:

1. aplicação desde banco vazio;
2. upgrade de uma baseline com apenas as três migrations da Fase 1;
3. diff vazio entre banco e schema;
4. UUID, dinheiro exato, FKs explícitas, constraints, triggers e histórico.

### Consequências

- `db push` continua proibido como estratégia de evolução;
- correções futuras são novas migrations, nunca reescrita silenciosa do
  histórico aplicado;
- a promoção física não autoriza produção ou dados reais.

## DT-030 — Logo oficial sem mudança da linguagem visual existente

- **Estado:** Aceita
- **Data:** 2026-07-29

### Contexto

O responsável de Produto forneceu `logo_fenix.png`, declarou-a oficial e pediu
preservação da identidade visual já implementada.

### Decisão

Manter o PNG original em `referencias/logos/logo_fenix.png`, publicar cópia
íntegra em `apps/web/public/brand/logo-fenix.png` e usar derivação sem
recoloração como favicon. Não alterar a paleta, layout ou componentes além do
necessário para aplicar a marca.

### Consequências

- a logo principal está aprovada e deixa de ser fallback;
- variantes masculina, feminina e diretoria e o manual de marca permanecem
  pendentes;
- a aprovação da logo não resolve a divergência entre as duas paletas
  documentais.
