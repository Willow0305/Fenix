# Requisitos não funcionais

## Convenções

Os identificadores `RNF-001` a `RNF-022` e sua intenção vêm do documento-base. Critérios quantitativos ausentes nas fontes são marcados como provisórios; não devem virar compromisso de produção sem medição e aprovação.

## Requisitos canônicos RNF-001 a RNF-022

| ID | Requisito consolidado | Pri. | Verificação |
|---|---|---:|---|
| RNF-001 | Responsividade em celular, tablet e desktop, com prioridade mobile para inscrições e consultas. | Alta | Testes de viewport e conteúdo sem perda de ação, leitura ou navegação; formulários operáveis por toque e teclado. |
| RNF-002 | Aplicação online continuamente disponível, exceto manutenções. | Alta | Monitoramento externo, janela de manutenção comunicada e relatório de disponibilidade. Meta percentual é provisória. |
| RNF-003 | Senhas armazenadas somente com hash adaptativo seguro. | Alta | Inspeção de schema/logs e teste de autenticação confirmam ausência de senha reversível ou em texto puro. |
| RNF-004 | Dados pessoais com finalidade clara, acesso restrito e proteção contra vazamento. | Alta | Inventário de dados, matriz de acesso, testes de autorização e evidência de política/retenção. |
| RNF-005 | Rotas administrativas protegidas por autenticação e perfil/permissão. | Alta | Testes negativos em cada operação administrativa no servidor; ocultação no front-end não conta como controle. |
| RNF-006 | Backup periódico antes do uso real em produção. | Alta | Política define frequência, retenção, criptografia, responsáveis e teste restaurável. Valores exatos dependem de decisão de infraestrutura. |
| RNF-007 | Páginas principais rápidas e consultas indexadas em campos relevantes. | Média | Medição automatizada e planos de consulta nas rotas críticas. Referência provisória web: Core Web Vitals “bons” no percentil 75; orçamento de API depende de linha de base. |
| RNF-008 | Crescimento de usuários, atletas, pedidos e finanças sem troca completa da stack. | Média | Teste de carga por cenário e revisão de gargalos; serviços permanecem escaláveis por módulo. Meta volumétrica é provisória. |
| RNF-009 | Código modular, com nomes claros e separação entre front-end, back-end e banco. | Alta | Revisão arquitetural e regras de dependência impedem domínio em UI/controllers/adaptadores. |
| RNF-010 | Cores, botões, cards e tipografia consistentes com a marca Fênix. | Média | Revisão visual e de tokens conforme `12-IDENTIDADE-VISUAL.md`, incluindo estados e contraste. |
| RNF-011 | Compatibilidade com versões modernas de Chrome, Edge, Firefox e Safari. | Média | Matriz de testes nas versões suportadas. Política exata de versões deve ser definida antes de produção. |
| RNF-012 | Integridade por chaves, relacionamentos e restrições. | Alta | Migrações e testes impedem órfãos, duplicidades e estados inválidos definidos; `onDelete` é explícito. |
| RNF-013 | Registro servidor de erros importantes para manutenção. | Média | Falha gera evento estruturado e correlacionável, sem segredo/dado pessoal desnecessário; alertas cobrem criticidade alta. |
| RNF-014 | Poucos passos nos fluxos de inscrição, pagamento, compra e consulta. | Alta | Teste de usabilidade e contagem de etapas desde a entrada adequada; metas numéricas dependem do protótipo aprovado. |
| RNF-015 | SEO básico em páginas públicas. | Baixa | Título, descrição, HTML semântico, URL canônica/compartilhável e metadados sociais válidos nas páginas indexáveis. |
| RNF-016 | Portabilidade entre hospedagens modernas, sem dependência exclusiva desnecessária. | Média | Ambiente reproduzível, configuração externa e abstração de serviços substituíveis; restauração é ensaiada. |
| RNF-017 | Movimentação financeira sensível registra responsável, data, origem, alteração e histórico. | Alta | Testes de auditoria cobrem criação, confirmação, cancelamento, estorno, reembolso, fechamento e reabertura. |
| RNF-018 | Anexos armazenados em serviço seguro/pasta controlada, validados por tipo, tamanho e permissão. | Alta | Testes rejeitam MIME real/extensão/tamanho não permitidos e acesso sem autorização; banco guarda só metadados/chave/URL segura. |
| RNF-019 | Pedido, pagamento, estoque e caixa mantêm consistência transacional no back-end. | Alta | Testes de atomicidade, concorrência, repetição e falha parcial demonstram idempotência ou compensação. |
| RNF-020 | Fórum/notícias/comentários protegidos contra spam, conteúdo inadequado e abuso de permissão. | Média | Rate limit, denúncia/moderação, testes de autorização e trilha de moderação; regras editoriais ainda precisam aprovação. |
| RNF-021 | Logos, contatos, links e textos públicos alteráveis no painel sem deploy. | Média | Usuário autorizado altera e vê publicação refletida; versões/rollback seguem política aprovada. |
| RNF-022 | Caixa, loja, parceiros e fórum separados para manutenção e evolução por etapas. | Média | Dependências entre módulos são explícitas; um módulo não acessa persistência interna de outro sem contrato de aplicação. |

## Restrições complementares consolidadas

| ID | Restrição | Evidência de conformidade |
|---|---|---|
| RCNF-001 | TypeScript em modo `strict`; `any` somente se inevitável e justificado. | Configuração compilada, lint e busca/revisão de exceções documentadas. |
| RCNF-002 | PostgreSQL e Prisma ORM; todas as tabelas com UUID, inclusive associações com identidade. | Schema/migrações revisados e testes de integração. |
| RCNF-003 | Instantes persistidos em UTC e datas civis sem horário como `DATE`. | Testes em fusos distintos e inspeção de tipos do schema. |
| RCNF-004 | Dinheiro em `Decimal`/`NUMERIC` com moeda explícita; nunca `float`/`double`. | Inspeção do schema e testes de arredondamento/soma. |
| RCNF-005 | Exclusão lógica para registros importantes, históricos, moderados e referenciados. | Testes de consulta, restauração quando aplicável e preservação da auditoria. |
| RCNF-006 | Registros financeiros confirmados não podem ser apagados ou reescritos para esconder histórico. | Testes negativos e uso de cancelamento/estorno/reembolso vinculados. |
| RCNF-007 | Segredos vêm do ambiente; `.env` não é versionado e `.env.example` não contém valor real. | Varredura de segredos e revisão de configuração. |
| RCNF-008 | Validação de entrada nas bordas e erro seguro em todos os módulos. | Testes unitários/integração para entradas válidas, limites e malformadas. |
| RCNF-009 | Toda operação crítica possui autorização e testes proporcionais ao risco. | Matriz requisito–permissão–teste e cobertura dos caminhos negativos. |
| RCNF-010 | Nenhum módulo é concluído sem lint, testes e build oficiais bem-sucedidos. | Resultado reproduzível dos comandos documentados no `README.md`. |
| RCNF-011 | HTML semântico, navegação por teclado, foco visível e comunicação não dependente só de cor. | Testes automáticos e revisão manual de acessibilidade. |
| RCNF-012 | Dependências e imagens de contêiner devem ser atualizáveis e verificadas quanto a vulnerabilidades. | Relatório de dependências/contêiner e processo de correção por severidade. |

## Atributos de qualidade e responsáveis

| Atributo | Evidência principal | Responsabilidade |
|---|---|---|
| Segurança/privacidade | testes de autorização, varreduras, auditoria e revisão LGPD | Engenharia + responsável de negócio/jurídico |
| Confiabilidade financeira | testes transacionais, reconciliação e trilha | Engenharia + diretoria financeira |
| Usabilidade/acessibilidade | protótipo, testes com teclado/leitor e usuários | Produto/UX + engenharia |
| Desempenho/disponibilidade | métricas, testes de carga e monitoramento | Engenharia/operação |
| Manutenibilidade/portabilidade | lint, build, arquitetura e recuperação | Engenharia |

## Metas provisórias que exigem ratificação

- disponibilidade mensal e janelas de manutenção (`PEN-044`);
- RPO/RTO, frequência e retenção de backups (`PEN-044`);
- versões mínimas dos navegadores (`PEN-047`);
- volumes simultâneos e orçamento de resposta da API (`PEN-050`);
- orçamento de imagens e páginas públicas (`PEN-050`);
- limites de upload por tipo (`PEN-041`);
- taxa de requisições por rota/ator (`PEN-050`);
- cobertura percentual mínima e ferramentas de teste (`PEN-051`).

Até a ratificação, os testes devem produzir uma linha de base e nunca declarar esses requisitos “cumpridos” apenas por ausência de falha observada.
