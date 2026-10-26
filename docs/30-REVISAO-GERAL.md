# 30 — Revisão geral do sistema

- **Data:** 2026-10-25
- **Base:** branch `dev`, depois dos cupons de desconto (`14c5625`)
- **Método:** leitura do código, `npm outdated`, análise do build do site, consultas ao banco local e varredura por padrões (N+1, duplicação, estilos inline, dependências mortas).

O sistema está **sólido nas bases**: TypeScript estrito sem `any`, regras de negócio em funções puras com testes, dinheiro em `Decimal`, auditoria em todas as mudanças sensíveis, autorização no servidor, MFA, CSP, limites de requisição e 94 testes de integração contra PostgreSQL real. Os problemas abaixo são de **versões, escala, operação e acabamento**, não de fundação.

## 1. Já corrigido nesta revisão

| Item | Antes | Depois |
|---|---|---|
| `zod` no navegador | o pacote compartilhado levava o `zod` para o site (pacote de 496 KB) | entrada separada `@fenix/validation/health`; JavaScript estático de 2,3 MB para 1,9 MB |
| N+1 em pedidos | uma consulta ao banco por pagamento em cada lista de pedidos | uma consulta para todos (`PaymentsService.views`) |
| Código duplicado | função de iniciais repetida em dois componentes | `lib/initials.ts` |
| Dependências menores | React 19.2.8, Bootstrap Icons 1.11.3, bibliotecas de teste antigas | React 19.3.0, Bootstrap Icons 1.13.2, testes atualizados; 0 vulnerabilidades |

## 2. Versões: o que está defasado

Regra do projeto: só adotar versão publicada há pelo menos 14 dias (`PEN-055`).

| Pacote | Projeto | Atual | Publicação | Situação |
|---|---|---|---|---|
| Prisma | 6.19.3 | 7.10.1 | 7.0.0 em 2025-11-19 | **maior defasagem**: quase um ano |
| NestJS | 11.2.7 | 12.2.0 | 12.0.0 em 2026-08-27 | versão maior nova |
| TypeScript | 5.9.3 | 7.0.2 | 2026-07-08 | compilador nativo, muito mais rápido |
| `@types/node` | 22 | 26 | — | acompanha o Node 24 em uso (`v24.22.0`) |
| ESLint | 10.7.0 | 10.13.0 | 2026-10-16 | aguardar 14 dias |
| Next.js | 16.4.2 | 16.4.3 | 2026-10-23 | aguardar 14 dias |
| `concurrently` | 9.2.5 | 10.0.6 | 2026-10-08 | só ferramenta de desenvolvimento |

### R-01 — Prisma 6 → 7

- **Gravidade:** média · **Prioridade:** P1 · **Esforço:** 1 a 2 dias
- **Explicação:** o Prisma 7 troca o motor em Rust por um cliente em TypeScript com adaptador de driver (`@prisma/adapter-pg`), gera o cliente dentro do projeto (`prisma-client`) e lê a conexão de `prisma.config.ts`.
- **Impacto:** consultas mais leves, imagem de produção menor, fim do erro `EPERM` no Windows (o arquivo `query_engine-*.dll` travado pela API em execução) e acompanhamento das correções de segurança.
- **Solução:** criar `prisma.config.ts`, trocar o gerador, passar o adaptador ao `PrismaClient` em `PrismaService`, atualizar os imports de `@prisma/client`, rodar as migrations e toda a suíte de integração.
- **Arquivos:** `prisma/schema.prisma`, `apps/api/src/common/prisma/prisma.service.ts`, `apps/api/test/*`, imports de enums e tipos em cerca de 80 arquivos.

### R-02 — NestJS 11 → 12

- **Gravidade:** média · **Prioridade:** P2 · **Esforço:** 1 dia
- **Explicação:** versão maior do framework da API; os pacotes `@nestjs/*` (core, swagger, testing, cli e throttler) precisam subir juntos.
- **Solução:** seguir o guia oficial de migração da versão 12, atualizar todos os `@nestjs/*` de uma vez e rodar a suíte completa de unitários e integração. Fazer **depois** do Prisma, para não misturar causas de falha.

### R-03 — TypeScript 7

- **Gravidade:** baixa · **Prioridade:** P3 · **Esforço:** meio dia a 1 dia
- **Explicação:** o compilador nativo reduz muito o tempo de `typecheck` e build. Depende de `ts-jest` e do `nest build` aceitarem a versão 7; até lá, pode-se usar o TS 7 só no `typecheck` (`tsgo`).

## 3. Problemas encontrados

| ID | Problema | Gravidade | Prioridade | Esforço |
|---|---|---|---|---|
| R-04 | Tarefas automáticas e limites de requisição na memória do processo | alta para escalar | P1 antes de ter 2+ servidores | 1 dia |
| R-05 | CSP permite script inline | média | P2 | 1 dia |
| R-06 | Sem empacotamento para produção (Dockerfile da API e do site) | alta para publicar | P1 antes da hospedagem | 1 dia |
| R-07 | Logs em texto, sem métricas nem rastreio de erro | média | P2 | 1 a 2 dias |
| R-08 | Busca de dados no painel sem cache nem compartilhamento | média | P2 | 2 dias |
| R-09 | 207 estilos inline nas telas | baixa | P3 | contínuo |
| R-10 | Sem testes de ponta a ponta no navegador | média | P2 | 2 a 3 dias |
| R-11 | Arquivos e e-mail só com adaptadores locais | alta para publicar | P1 antes da hospedagem (`PEN-042`) | 1 a 2 dias |
| R-12 | Site sem `sitemap.xml`, `robots.txt` e imagem padrão de compartilhamento | baixa | P3 | meio dia |
| R-13 | Pacotes e tabela sem uso | baixa | P3 | 1 hora |

### R-04 — Tarefas e limites na memória do processo

- **Explicação:** a expiração de pedidos e o fechamento de remessas rodam com `setInterval` dentro de cada processo da API (`orders.service.ts`, `campaigns.service.ts`), e o `ThrottlerModule` guarda as contagens em memória.
- **Impacto:** com dois ou mais servidores, as tarefas rodam em dobro (as transações evitam dano, mas multiplicam carga) e cada servidor conta os limites separadamente, o que enfraquece a proteção contra força bruta.
- **Solução:** `pg_try_advisory_lock` para cada tarefa rodar em um só servidor, e armazenamento compartilhado do throttler (Redis ou tabela no PostgreSQL). Com um servidor só, como hoje, não há problema prático.

### R-05 — CSP com `'unsafe-inline'`

- **Explicação:** `script-src 'self' 'unsafe-inline'` (`apps/web/next.config.ts`) aceita qualquer script embutido; se algum dia entrar conteúdo malicioso na página, o navegador não bloqueia.
- **Solução:** CSP com *nonce* gerado por requisição no `middleware` do Next e `strict-dynamic`; a renderização dinâmica já é usada nas páginas públicas.

### R-06 — Sem empacotamento para produção

- **Explicação:** o `docker-compose.yml` sobe só o PostgreSQL. Não há imagem da API nem do site.
- **Solução:** Dockerfiles multiestágio (Next em modo `standalone`), usuário sem privilégio, `HEALTHCHECK`, volume persistente para `STORAGE_LOCAL_DIR` e Nginx com HTTPS, como pede `docs/15`.

### R-07 — Observabilidade

- **Explicação:** a API usa o `Logger` padrão em texto; não há identificador de requisição nos logs de acesso, nem métricas, nem alerta de erro.
- **Solução:** logs em JSON (`nestjs-pino`) com o `requestId` que a API já gera, endpoint de métricas e um coletor de erros. Ajuda a cumprir as metas de backup e resposta a incidente.

### R-08 — Busca de dados no painel

- **Explicação:** 53 telas usam `useResource`, que busca de novo a cada montagem e não compartilha resultados (ex.: a lista de equipes é pedida várias vezes ao navegar).
- **Solução:** adotar uma camada de cache de consultas (TanStack Query) atrás do mesmo `useResource`, com invalidação após cada alteração; reduz chamadas e deixa a navegação instantânea.

### R-09 — Estilos inline

- **Explicação:** 207 ocorrências de `style={{…}}` espalham decisões visuais fora do CSS e dificultam manter o padrão de `docs/29`.
- **Solução:** trocar por classes utilitárias já existentes (`row`, `stack`, `muted`) ou novas, aos poucos, a cada tela corrigida.

### R-10 — Testes de ponta a ponta

- **Explicação:** há 127 testes unitários e 94 de integração, mas nenhum teste abre o navegador. Problemas de layout, celular e fluxo de tela só aparecem com uso manual.
- **Solução:** Playwright com os fluxos críticos (login com MFA, cadastro de atleta, mensalidade e pagamento, compra com cupom), nas larguras de 390 px e 1280 px, no CI.

### R-11 — Arquivos e e-mail locais

- **Explicação:** imagens ficam em disco (`DT-038`) e e-mails são gravados em arquivo; nada é enviado de verdade. Recuperação de senha e avisos de pedido não chegam a ninguém.
- **Solução:** escolher provedores (`PEN-042`): armazenamento S3 compatível com versionamento e e-mail transacional; os adaptadores (`ObjectStorage`, `MailSender`) já isolam a troca.

### R-12 — SEO e compartilhamento

- **Solução:** `app/sitemap.ts`, `app/robots.ts` e imagem padrão de compartilhamento com a logo; notícias já usam a capa no `openGraph`.

### R-13 — O que pode ser removido

| Item | Motivo | Recomendação |
|---|---|---|
| `packages/types` | nenhuma aplicação importa | remover |
| `packages/ui` | nenhuma aplicação importa; os componentes vivem em `apps/web/components` | remover, ou transformar em biblioteca de componentes de verdade se houver um segundo app |
| tabela `registrations` | reservada desde a fase 2 sem endpoint (`DT-028`) | remover por migração, depois de confirmar que está vazia |

A remoção depende de aprovação e registro em `17-DECISOES-TECNICAS.md` (`AGENTS.md`).

## 4. O que pode ser adicionado

Em ordem de valor para o time:

1. **PIX com confirmação automática:** cobrança PIX por um intermediário de pagamento com aviso automático (webhook). Hoje a diretoria confere comprovante por comprovante; com a integração, a mensalidade e o pedido são baixados sozinhos e lançados no Caixa.
2. **Avisos por e-mail e WhatsApp:** lembrete de mensalidade a vencer e vencida, pedido pronto para retirada e resultado de seletiva (depende de R-11).
3. **Presença em treinos:** chamada por treino e por equipe, com frequência do atleta; útil para convocações e bolsas. **Cancelado pelo responsável em 2026-10-26 (`DT-060`).**
4. **Carteirinha digital do atleta** com QR code, validada na entrada de jogos e eventos.
5. **Painel financeiro com gráficos:** receita, inadimplência e projeção por mês, com os dados que os relatórios já calculam.
6. **App instalável (PWA)** para atletas e diretoria: atalho na tela do celular e avisos.
7. **Busca global no painel** (atleta, pedido, parceiro) pelo nome, de qualquer tela.

## 5. Ordem recomendada

1. **Antes de publicar:** R-06, R-11, R-04 e R-05.
2. **Atualização de versões, uma por vez:** R-01 (Prisma), depois R-02 (NestJS), depois R-03 (TypeScript).
3. **Qualidade contínua:** R-10, R-07 e R-08.
4. **Funcionalidades:** PIX automático e avisos primeiro.
5. **Limpeza:** R-13, R-12 e R-09.

## 6. Andamento

Aprovado por inteiro pelo responsável do projeto em 2026-10-25.

| Item | Situação |
|---|---|
| R-01 Prisma 7 | feito (`DT-054`) |
| R-02 NestJS 12 | feito (`DT-055`) |
| R-03 TypeScript 7 | feito para a verificação de tipos, com o 6 de compatibilidade nas ferramentas (`DT-056`) |
| R-04 tarefas e limites com mais de um servidor | feito (`DT-047`) |
| R-08 cache de dados nas telas | feito (`DT-052`) |
| R-06 Docker e Nginx | feito e testado numa pilha real (`DT-053`) |
| R-11 arquivos e e-mail | adaptadores S3 e SMTP prontos (`DT-048`, `DT-053`); falta escolher os provedores (`PEN-042`) |
| R-05 CSP com nonce | feito (`DT-046`) |
| R-12 sitemap, robots e imagem de compartilhamento | feito (`DT-046`) |
| R-13 pacotes e tabela sem uso | removidos (`DT-046`) |
| Padrão pt-BR em mensagens, testes e migrações | feito (`DT-046`) |
| PWA | manifesto e ícones feitos; service worker pendente |
| Tempo real | feito no painel, em Minha conta (`DT-049`) e nas páginas públicas da loja e das seletivas (`DT-051`) |
| Avisos por e-mail e WhatsApp | feito em modo de teste; envio real depende das contas nos provedores (`DT-048`, `PEN-064`) |
