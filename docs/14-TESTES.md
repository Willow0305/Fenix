# Estratégia de testes

## Objetivo

Demonstrar que requisitos, regras, permissões, transições e atributos de qualidade funcionam sob caminhos válidos, inválidos, concorrentes e de falha. Teste não serve apenas para aumentar cobertura: deve proteger os riscos principais — autorização, finanças, estoque, menores, uploads e moderação.

## Princípios

- teste acompanha requisito e regra desde a análise;
- domínio é testado sem depender da interface;
- rotas administrativas têm casos negativos obrigatórios;
- relógio, UUIDs, aleatoriedade e integrações são controláveis;
- dinheiro usa valores Decimal e cenários de arredondamento;
- testes não usam dados pessoais/segredos reais;
- falha parcial e repetição são casos de primeira classe;
- flakiness é defeito, não motivo para reexecutar até passar;
- evidência de lint, testes e build é requisito de conclusão.

## Pirâmide e tipos

| Nível | Objetivo | Exemplos |
|---|---|---|
| Estático | Detectar erro antes de executar | TypeScript `strict`, lint, formatação, regras de dependência, schema/OpenAPI |
| Unitário | Validar regra isolada | transição, cálculo Decimal, permissão, período de campanha |
| Integração | Validar módulo + banco/adaptador | restrições Prisma/PostgreSQL, transação, auditoria, repositório |
| Contrato/API | Validar entrada, resposta e autorização | endpoints REST, erros, paginação, idempotência, OpenAPI |
| Componente | Validar comportamento acessível da UI | formulário, tabela, diálogo, status, loading/error |
| Ponta a ponta | Validar jornada crítica | inscrição, login, mensalidade paga, pedido, remessa, moderação |
| Não funcional | Medir qualidade | acessibilidade, compatibilidade, carga, segurança, backup/restauração |
| Aceite | Confirmar processo real | diretoria/atleta executam cenário aprovado em ambiente controlado |

## Ambientes e dados

- **unitário:** sem rede/banco real quando não necessário;
- **integração:** PostgreSQL efêmero/isolado com migrações reais;
- **E2E:** aplicação completa e armazenamento/e-mail falsos controlados;
- **homologação:** configuração próxima à produção, sem credencial/dado real;
- cada teste cria seus dados, usa UUIDs próprios e limpa somente seu escopo;
- fixtures usam pessoas fictícias inequívocas, arquivos inertes e valores monetários conhecidos;
- datas são fixadas e testadas em fusos distintos;
- segredos de CI são mínimos, rotacionáveis e nunca impressos.

## Suítes implementadas

| Suíte | Comando | Escopo | Dependências |
|---|---|---|---|
| Unitária (API) | `npm test` | domínio puro (autenticação, criptografia, datas e fusos, dinheiro, mensalidades, Caixa, estoque, remessas), inicialização da aplicação | nenhuma |
| Componentes (web) | `npm test` | formatação de datas/dinheiro, formulários acessíveis, erros e paginação | nenhuma |
| Integração (API) | `npm run test:integration` | fluxos HTTP reais contra PostgreSQL, uma suíte por fase (`apps/api/test/phase*.int-spec.ts`) | PostgreSQL do `.env` |
| Smoke | `npm run smoke` | web, health, Swagger e OpenAPI | build |

A suíte de integração cobre, para cada domínio, caso autorizado, sem autenticação, sem permissão, recurso de outro titular, estados inválidos e auditoria, além de concorrência real em pagamentos e estoque. Ela também roda no CI após aplicar as migrations. Os dados criados usam e-mails e nomes fictícios aleatórios.

## Gate de cada fase

Os scripts raiz e o `README.md` são a fonte oficial dos comandos. O gate lógico deve executar:

1. `npm ci` com o lockfile versionado, sem alteração do grafo de dependências;
2. `npm run check`, que agrega `format:check`, lint, tipos, testes, validação Prisma e build dos workspaces;
3. `docker compose up -d postgres` e verificação saudável em `docker compose ps`;
4. `npm run dev:api` e resposta saudável de `GET http://localhost:3333/health`;
5. `npm run dev:web` e abertura de `http://localhost:3000`;
6. em ambiente com `NODE_ENV` diferente de `production`, disponibilidade do Swagger em `/docs` e `/docs/openapi.json`;
7. em `production`, resposta `404` tanto em `/docs` quanto em `/docs/openapi.json`;
8. `npm run db:migrate` e `npm run test:integration` aprovados contra PostgreSQL.

`npm install` permanece apropriado para desenvolvimento local quando for necessário atualizar intencionalmente o lockfile. Se a nomenclatura de scripts mudar, atualizar este documento e o README no mesmo change set.

## Matriz de testes funcionais canônicos

| Requisitos | Suítes mínimas |
|---|---|
| RF-001, RF-002 | renderização pública, conteúdo restrito ausente, filtros, SEO, responsividade |
| RF-003, RF-004 | validação pública, período/estado, duplicidade aprovada, transições e auditoria |
| RF-005 a RF-007 | conta, hash, login/logout/recuperação, revogação, rate, matriz de autorização |
| RF-008 a RF-010 | cadastro/edição, histórico, status e vínculo temporal de equipe |
| RF-011 a RF-014 | plano, geração idempotente, vencimento/status, pagamento e filtros |
| RF-015 a RF-018 | produto/variação, preço, estoque, pedido visitante/logado e estados |
| RF-019, RF-020 | isolamento de dados próprios e consistência de indicadores |
| RF-021, RF-045 | filtros, período/fuso/moeda, totais, exportação e permissão |
| RF-022 | destinatário, idempotência, leitura e conteúdo mínimo |
| RF-023, RF-039 | edição sem deploy, visibilidade, upload e histórico |
| RF-024 | completude, imutabilidade lógica, redação e acesso do log |
| RF-025 a RF-030 | saldo derivado, lançamentos, anexos, automação, conciliação/fechamento |
| RF-031 a RF-034 | aprovação de parceiro, origem/repasse, serviços e agenda |
| RF-035 a RF-038 | modo de venda, período de campanha, carrinho e favorito privado |
| RF-040 a RF-043 | visibilidade, publicação, multicanal, moderação e auditoria |
| RF-044 | chegada, seleção de compradores, mensagem e não duplicidade |

Requisitos complementares `RCF-*` devem ser adicionados às mesmas suítes do módulo indicado em `02-REQUISITOS-FUNCIONAIS.md`.

## Casos críticos por domínio

### Autenticação e autorização

- senha correta/incorreta, conta inexistente com resposta equivalente;
- conta inativa, bloqueada e sessão revogada;
- recuperação expirada, já usada, adulterada e repetida;
- cliente tenta atribuir papel privilegiado;
- usuário com permissão tenta acessar recurso de outro titular/equipe/conta;
- UUID válido mas não autorizado;
- alteração de papel gera auditoria;
- logout/troca de senha invalida sessão conforme política;
- Swagger exposto somente no ambiente permitido.

### Atletas, menores e inscrições

- seletiva aberta versus rascunho/encerrada/cancelada;
- encerramento concorrente durante envio;
- campos/duplicidade conforme decisão aprovada;
- conversão preserva vínculo com inscrição;
- atleta vê apenas os próprios dados;
- entrada tenta incluir dado de saúde e é rejeitada quando fora do schema;
- jornadas com menores só recebem E2E/aceite após decisão LGPD/ECA Digital;
- mecanismo futuro de idade/supervisão deve ter teste de minimização, bypass e acessibilidade.

### Mensalidades e Caixa Fênix

- duas execuções de geração não duplicam mensalidade;
- datas civis não mudam com fuso;
- pagamento repetido não duplica entrada;
- falha entre pagamento e caixa faz rollback/compensação;
- soma Decimal e arredondamento por moeda/regra aprovada;
- cancelamento/estorno/reembolso preserva original e vínculo;
- transferência tem lados iguais e saldo agregado neutro;
- conciliação calcula diferença;
- período fechado bloqueia ação; reabertura exige permissão/motivo;
- dois operadores concorrentes não confirmam duas vezes;
- relatório reproduz saldo e totais por conta/período.

### Loja, estoque e remessas

- preço/estoque muda entre carrinho e finalização;
- variação obrigatória ausente/inativa;
- dois compradores disputam a última unidade;
- repetição de confirmação não baixa estoque duas vezes;
- pedido visitante não pode ser consultado por ID previsível;
- favorito é idempotente e privado;
- campanha bloqueia antes/depois do período;
- mínimo não atingido segue política e vincula reembolsos;
- consolidação coincide com itens elegíveis;
- chegada notifica apenas compradores uma vez;
- retirada repetida não cria dois eventos.

### Parceiros e agenda

- parceiro pendente/inativo não aparece nem recebe oferta;
- item preserva origem e regra de repasse;
- apuração separa receita do Fênix e valor devido;
- documento comercial não usa URL pública;
- horário concorrente não gera duas confirmações;
- solicitação não aparece como confirmada;
- perfil de parceiro não acessa outro parceiro;
- nenhum campo/payload aceita prontuário.

### Fórum, notícias e eventos

- tópico público, membros e administrativo em todos os perfis;
- conteúdo restrito ausente de busca, contagem e resposta;
- tópico fechado rejeita nova publicação;
- reação idempotente e denúncia privada;
- rate limit/abuso;
- moderação exige permissão/motivo e soft delete;
- publicação agendada antes/depois do instante UTC;
- notícia relacionada aparece nos canais selecionados sem cópia;
- ocultação propaga aos canais.

### Uploads

- extensão permitida com MIME divergente;
- arquivo excede limite, vazio, truncado ou conteúdo ativo;
- nome tenta traversal/controle;
- acesso sem permissão, URL expirada e vínculo trocado;
- objeto criado com falha no banco e banco criado com falha no objeto;
- hash e metadados registrados;
- log não contém conteúdo/URL assinada/segredo;
- política pública não se aplica a comprovante/contrato.

## Requisitos não funcionais — método de verificação

| RNF | Método |
|---|---|
| RNF-001 | matriz de viewports, teclado, zoom/reflow e dispositivos reais selecionados |
| RNF-002 | monitor sintético, teste de falha/recuperação e relatório contra SLO aprovado |
| RNF-003 a RNF-005 | revisão de armazenamento, testes de autenticação e autorização negativa |
| RNF-006 | criação + restauração verificada com RPO/RTO aprovados |
| RNF-007, RNF-008 | Core Web Vitals, perfil de API/SQL e carga por cenário/volume aprovado em `PEN-050` |
| RNF-009 | lint, regras de dependência e revisão arquitetural |
| RNF-010 | regressão visual seletiva + revisão de tokens/contraste |
| RNF-011 | matriz de navegadores/versões aprovada |
| RNF-012 | migrações, constraints, concorrência e `onDelete` |
| RNF-013 | injeção de falha, correlação, alerta e inspeção de redação |
| RNF-014 | teste de usabilidade com tarefas críticas e contagem de passos após protótipo |
| RNF-015 | auditoria de título, descrição, semântica, compartilhamento e indexabilidade |
| RNF-016 | build/deploy/restauração em ambiente substituto ou ensaio documentado |
| RNF-017 a RNF-019 | auditoria, arquivos, transações, idempotência e falha parcial |
| RNF-020 | autorização, rate, abuso, denúncia e moderação |
| RNF-021 | alteração pelo painel refletida sem rebuild/deploy |
| RNF-022 | testes/checagens de fronteira entre módulos |

## Segurança

Antes de liberar uma fase:

- análise de composição/dependências e contêineres;
- varredura de segredos;
- teste automatizado de autenticação/autorização;
- revisão de headers, CORS, cookies/tokens e erros;
- teste de injeção, XSS e CSRF conforme arquitetura;
- abuso de rate limit;
- revisão de upload;
- teste manual focado nos fluxos críticos;
- triagem: vulnerabilidade crítica/alta bloqueia, salvo aceite formal justificado.

Um teste de invasão independente deve ser planejado antes de produção financeira/ampla, com escopo e reteste definidos.

## Acessibilidade e UX

- análise automatizada em cada componente/página principal;
- navegação integral por teclado;
- foco, diálogo, menu, tabela, formulário e atualização dinâmica;
- leitor de tela nos fluxos de inscrição, login, compra e consulta;
- contraste medido após paleta aprovada;
- zoom/reflow e orientação;
- toque e mobile real;
- teste com usuários representativos quando possível.

Automação não substitui revisão manual.

## Desempenho, carga e resiliência

Os números dependem de linha de base/volume aprovado. Cada plano informa:

- cenário, dados e concorrência;
- percentis e taxa de erro, não apenas média;
- orçamento de página/API/consulta;
- limites de banco/conexão/arquivo;
- comportamento com dependência lenta/indisponível;
- critérios de interrupção e proteção;
- resultado comparado à versão anterior.

Cobrir no mínimo login, listagem administrativa, geração de mensalidades, confirmação de pagamento, checkout/pedido, relatório e fórum quando suas fases chegarem.

## Cobertura e mutação

As fontes não definem percentual mínimo; ferramentas e limiares permanecem em `PEN-051`. Até decisão:

- 100% das regras financeiras, permissões e transições aprovadas devem ter ao menos um teste positivo e negativo;
- linhas/branches são indicador secundário, não gate isolado;
- exceção de código não coberto precisa de risco/justificativa;
- teste de mutação pode ser adotado nas regras financeiras e de permissão após estabilização.

Um percentual global só deve ser registrado após linha de base, sem incentivar testes vazios.

## Testes de aceite por papel

| Papel | Cenários |
|---|---|
| Visitante/interessado | navegar, inscrever-se, cadastrar interesse, comprar quando habilitado |
| Atleta | consultar próprios dados, mensalidades, pagamentos, pedidos e notificações |
| Diretoria | analisar inscrição, gerir atleta, registrar/conciliar financeiro, operar loja/remessa e moderar |
| Administrador | gerir acesso/configuração sem obter dados de negócio indevidos |
| Parceiro provisório | somente após aprovação: operar agenda/oferta própria sem acessar terceiros |
| Privacidade/segurança | atender solicitação fictícia e simular incidente |

O aceite usa roteiro, resultado esperado, evidência, responsável e decisão.

## Evidências e relatório

Cada execução relevante registra:

- commit/versão e ambiente;
- comandos/scripts e configuração;
- resumo de aprovados, falhos, ignorados e instáveis;
- cobertura quando aplicável;
- artefatos de falha sem dados privados;
- vulnerabilidades e severidade;
- desvios aceitos, responsável e prazo;
- vínculo a requisito/risco.

## Critérios de saída de uma fase

- requisitos da fase têm testes rastreáveis;
- nenhum teste ignorado sem justificativa/prazo;
- lint, tipos, testes e build passam;
- migrações foram testadas;
- riscos críticos não estão abertos;
- autorização e erros seguros foram revisados;
- acessibilidade/responsividade foram verificadas;
- evidências foram registradas;
- aceite explícito foi concedido.

## Decisões provisórias

- ferramentas/comandos adicionais além dos scripts npm oficiais do `README.md` (`PEN-051`);
- metas de cobertura (`PEN-051`), desempenho e carga (`PEN-050`) e disponibilidade (`PEN-044`);
- matriz exata de navegadores/dispositivos (`PEN-047`);
- ferramenta de E2E, acessibilidade, contrato, carga e segurança (`PEN-051`);
- política de snapshot visual (`PEN-051`);
- frequência de teste de restauração e invasão (`PEN-044`, `PEN-051`);
- massa/mecanismo de testes de aferição etária após análise jurídica.
