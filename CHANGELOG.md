# Changelog

Todas as mudanças relevantes deste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adotará versionamento semântico a partir do primeiro release.

## [Não publicado]

### TypeScript 7 (2026-10-26)

#### Alterado

- verificação de tipos com o TypeScript 7.0.2; as ferramentas que ainda dependem da API antiga usam o pacote de compatibilidade do 6 (DT-056).

### NestJS 12 (2026-10-26)

#### Alterado

- NestJS 11.2.7 → 12.1.3 e Swagger 12 (DT-055); sem mudança de comportamento.

#### Corrigido

- com o Nest 12, a API não iniciava por não achar o adaptador HTTP; agora ele é passado explicitamente, também na imagem Docker.

### Prisma 7 (2026-10-26)

#### Alterado

- Prisma 6.19.3 → 7.10.1, com o novo cliente gerado na API e o adaptador oficial do PostgreSQL (DT-054); sem mudança no banco.

### Pronto para hospedar: Docker, Nginx e S3 (2026-10-26)

#### Adicionado

- imagens Docker da API e do site, `docker-compose.prod.yml` com banco, migrações, preparo, API, site e Nginx com HTTPS (DT-053);
- armazenamento de arquivos em S3 ou compatível, com criptografia e comando `npm run storage:migrate` para levar os arquivos do disco, conferidos pelo hash;
- `TRUST_PROXY` para o IP real atrás do Nginx.

#### Corrigido

- num banco novo, o cadastro de pessoas dava erro 500 por falta do catálogo de permissões; a etapa de preparo cria o catálogo;
- sob tráfego alto, o limite de requisições poderia bloquear as páginas do próprio site;
- arquivos enviados no ambiente local estavam indo para a pasta antiga dentro do projeto; foram copiados para o lugar certo e a API avisa no início onde guarda os arquivos.

### Navegação mais rápida no painel (2026-10-26)

#### Alterado

- telas guardam os dados recentes: voltar a uma tela é instantâneo, listas iguais são buscadas uma vez só e trocar de página não pisca (DT-052);
- ao sair da conta, os dados guardados no navegador são apagados.

### Loja profissional e páginas ao vivo (2026-10-26)

#### Adicionado

- até 12 fotos por produto, enviadas de uma vez, com ordem por arrastar ou por botões, capa e descrição de cada foto (DT-051);
- galeria na página do produto com miniaturas, lupa ao passar o mouse e tela cheia com zoom;
- carrinho com a foto de cada item, troca de tamanho ou cor na própria linha e quantidade com − e +;
- aviso "Últimas unidades" e caminho de navegação na página do produto;
- loja e seletivas se atualizam sozinhas quando estoque, preço ou vagas mudam.

#### Alterado

- campos numéricos aceitam só números, inclusive ao colar; valores em reais aceitam vírgula ("89,90"), que antes dava erro.

### Lembrar o dispositivo na verificação em duas etapas (2026-10-26)

#### Adicionado

- caixa "Lembrar este dispositivo por 30 dias" na tela do código: no mesmo navegador, o login pede só a senha (DT-050);
- lista de dispositivos lembrados em Minha conta → Segurança, com opção de esquecer um ou todos; trocar a senha esquece todos;
- migração `dispositivos_lembrados`.

### Tempo real (2026-10-26)

#### Adicionado

- listas do painel atualizam sozinhas quando alguém muda algo: pedidos, inscrições, interessados, mensalidades e demais telas (DT-049);
- sino de notificações no cabeçalho do site e do painel, com a contagem de não lidas atualizada na hora;
- telas de Minha conta (pedidos, mensalidades, notificações) atualizam quando chega um aviso.

### Avisos por e-mail e WhatsApp (2026-10-26)

#### Adicionado

- contato com a diretoria pelo WhatsApp e pelo e-mail do clube, sem chat no site: botões na página Contato e atalho fixo de WhatsApp nas páginas públicas (DT-048);
- botões de WhatsApp e e-mail no painel, nas fichas de atleta (e do responsável), interessados, inscrições de seletiva e pedidos;
- avisos também por e-mail e WhatsApp, conforme a escolha de cada pessoa por finalidade em Minha conta → Notificações; WhatsApp só depois do aceite, que pode ser retirado a qualquer momento;
- lembretes automáticos de mensalidade: 3 dias antes, no dia, 1 e 7 dias depois do vencimento;
- situação dos canais e falhas de envio em Painel → Avisos;
- envio por SMTP e pela WhatsApp Cloud API da Meta, em modo de teste até as credenciais serem configuradas; migração `20261026044923_avisos_email_whatsapp`.

#### Alterado

- quem tem conta não recebe mais o e-mail de chegada de remessa em dobro: o aviso segue o canal escolhido.

### Escala com mais de um servidor (2026-10-25)

#### Alterado

- as tarefas automáticas (expirar reservas, encerrar remessas) rodam em um só servidor por vez, com registro da última execução e do erro, se houver (DT-047);
- o limite de requisições conta no banco, igual para todos os servidores; falhas das tarefas aparecem no log em vez de serem ignoradas.

#### Adicionado

- variáveis `THROTTLE_STORE` e `SCHEDULED_JOBS`; migração `20261026043819_escala_tarefas_limites`.

### Limpeza, segurança e padrão pt-BR (2026-10-25)

#### Adicionado

- `sitemap.xml`, `robots.txt` e imagem padrão de compartilhamento com a logo (DT-046);
- manifesto de app instalável com ícones gerados da logo;
- páginas próprias de "Página não encontrada" e de erro no site.

#### Alterado

- a política de segurança de conteúdo passa a usar um código (nonce) novo a cada página; nenhum script embutido roda sem ele;
- mensagens de validação e de erro da API, títulos de testes, grupos da documentação da API e comentários das migrações em português do Brasil.

#### Removido

- pacotes `packages/types` e `packages/ui`, sem uso;
- tabela reservada `registrations`, nunca usada; a inscrição geral segue pelo cadastro de interessado (migração `20261026042015_remove_registrations`, que para se houver dados).

### Revisão geral (2026-10-25)

#### Alterado

- o `zod` deixou de ir para o navegador (JavaScript do site de 2,3 MB para 1,9 MB) e as listas de pedidos não fazem mais uma consulta por pagamento;
- React 19.3.0, Bootstrap Icons 1.13.2 e bibliotecas de teste atualizados; `supertest` fica na 7.2.2, porque a 7.3.1 quebra os testes de integração com requisições simultâneas.

#### Adicionado

- `docs/30-REVISAO-GERAL.md`: versões defasadas (Prisma 7, NestJS 12, TypeScript 7), riscos de escala e operação, o que remover e o que adicionar, com ordem recomendada.

### Cupons de desconto (2026-10-25)

#### Adicionado

- cupons por percentual ou valor fixo, para toda a loja, produtos escolhidos ou categorias escolhidas, e para qualquer pessoa, só quem tem conta ou públicos escolhidos (ex.: diretoria, atletas) (DT-045);
- validade, pedido mínimo, limite total de usos e limite por pessoa; cancelamento, expiração ou estorno do pedido libera o uso;
- campo de cupom no carrinho, com prévia do desconto que se refaz ao mudar quantidades; subtotal, desconto e total no pedido;
- tela Cupons no painel (permissão `coupons.manage`), com edição, inativação, exclusão de cupom nunca usado e lista dos pedidos que usaram cada cupom;
- migração `20261025230727_cupons_desconto`, com restrições no banco para valor, percentual, limites e datas.

### Foto de perfil e elenco público (2026-10-25)

#### Adicionado

- foto de perfil para todos os usuários em Minha conta, privada por padrão, e opção "Perfil público" escolhida pela própria pessoa (DT-044);
- página Times organizada por categoria, com o elenco de cada time: foto, nome de exibição e posição de quem escolheu perfil público. O elenco começa oculto e abre ou fecha ao clicar no cartão do time;
- para atleta menor de 18 anos, a diretoria registra a autorização do responsável na ficha antes de ele aparecer no site; o nome sai abreviado;
- foto de perfil no cabeçalho do site e na ficha do atleta no painel; migração `20261025225214_foto_perfil_publico`.

### Celular e manutenção (2026-10-25)

#### Alterado

- todas as tabelas do painel, do carrinho e do resumo do pedido viram cartões abaixo de 768 px, com o rótulo de cada coluna (COR-006); Relatórios mantém a rolagem dentro do quadro.

#### Corrigido

- removido do banco local o registro de uma migração antiga que falhou e foi desfeita, que impedia `prisma migrate dev`.

### Planos de mensalidade e categorias (2026-10-25)

#### Adicionado

- tela de cada plano com quem paga e quem já saiu; adicionar vários atletas de uma vez (com data de início, valor individual e troca de plano) e tirar do plano (COR-021);
- edição completa do plano (nome, valor, dia de vencimento, descrição) e exclusão de plano sem atletas vigentes;
- alteração do vencimento de uma mensalidade em aberto, com motivo;
- edição e exclusão de categorias esportivas, da loja, de notícias, do fórum, financeiras e de centros de custo; a exclusão só vale sem uso e explica onde a categoria é usada (COR-022).

### Painel administrativo (2026-10-25)

#### Alterado

- equipes inativas: listas de criação mostram só ativas (mantendo a já usada, marcada); filtros mostram ativas primeiro e inativas com "(inativa)". O servidor recusa equipe inativa em partidas, comunicados e seletivas (COR-008);
- Atletas, Interessados e Mensalidades guardam os filtros no endereço, têm "Limpar filtros", contagem e carregamento com esqueleto; Interessados ganhou busca por nome, e-mail ou telefone (COR-015, COR-020);
- Equipes: edição de nome, tipo, categoria e descrição; confirmação ao inativar, com o efeito explicado; coluna "Vínculos atuais" (COR-017);
- ao inativar ou suspender um atleta, o diálogo mostra as pendências e permite cancelar mensalidades futuras sem pagamento, encerrar o plano e os vínculos (COR-018);
- vínculo fora da faixa etária da categoria pede confirmação (COR-019);
- tabelas de Atletas, Mensalidades e Equipes viram cartões no celular (COR-006);
- ícones no menu do painel, no cabeçalho do site, nos contatos e nas ações principais.

#### Adicionado

- `GET /athletes/:id/status-impact` e campos opcionais `cancelFutureFees`, `endPlan` e `endMemberships` em `PUT /athletes/:id/status`.

### Site público: loja, notícias, eventos e parceiros (2026-10-25)

#### Alterado

- loja: a pré-venda aparece como produto normal, com o selo "Pré-venda · até dd/mm" e filtro próprio; o bloco de remessas do topo foi retirado. As condições (data limite, quantidade mínima, previsão de chegada e reembolso) aparecem na página do produto antes do botão de compra (COR-012);
- produtos de parceiro mostram a logo do parceiro no canto superior esquerdo da imagem (COR-014);
- notícias e eventos em cartões com imagem 16:9, título em até 2 linhas e resumo em até 3; a primeira notícia fica em destaque; eventos mostram data, horário, local e competição (COR-010, COR-011);
- parceiros com capa grande e logo sobreposta, na lista e na página do parceiro (COR-013);
- sem imagem, ou se ela não carregar, aparece a logo do Fênix (COR-007);
- o site reflete alterações do painel no próximo carregamento, em vez de esperar até 1 minuto (COR-009);
- ícones do Bootstrap Icons 1.11.3 em ações e informações principais, sempre acompanhando texto.

#### Adicionado

- capa de evento e de parceiro (migração `20261025210000_capas_evento_parceiro`), com envio no painel; sem capa própria, o evento usa a da notícia vinculada;
- envio de imagem padronizado no painel, com pré-visualização, tamanho recomendado e limite de 10 MB conferido antes de enviar.

### Formulários padronizados (2026-10-25)

#### Alterado

- todos os campos de texto do site e do painel (cerca de 150) têm o mesmo limite de caracteres da API; campos a partir de 200 caracteres mostram contador (COR-002);
- formulário de atleta reorganizado em Identificação, Contato, Responsável, Emergência e Observações, com campo de CPF e celulares com máscara (COR-016);
- telefones de inscrição, interesse, cadastro, minha conta, carrinho, configurações, parceiros e profissionais usam máscara e validação ao sair do campo; documento de parceiro aceita CPF ou CNPJ com máscara (COR-003, COR-004);
- telefones exibidos no site e no painel aparecem formatados;
- a ficha do atleta avisa quando o documento gravado não é um CPF válido.

### Padronização de CPF, telefone e limites (2026-10-25)

#### Alterado

- documento de atleta aceita só CPF válido; RG e CPF com dígito errado são recusados. Parceiros aceitam CPF ou CNPJ válidos (DT-040);
- telefones de pessoa física exigem celular com DDD; emergência, parceiro, profissional e time aceitam também fixo. Todos são gravados só com dígitos;
- a ficha do atleta exibe o CPF como `***.982.247-**` e marca documentos antigos que não são CPF como "precisa de revisão".

#### Adicionado

- pacote compartilhado `@fenix/validation` com CPF, CNPJ, telefone e limites de caracteres, usado pela API e pelo site;
- migração `20261025200000_telefones_somente_digitos`, que remove máscara e `+55` dos telefones gravados sem apagar valores não convertíveis.

### Persistência e proteção dos dados (2026-10-25)

#### Corrigido

- a logo oficial e as configurações do time deixam de ser sobrescritas: os testes de integração gravavam no banco de desenvolvimento e apontavam a logo para um arquivo temporário (DT-038);
- `npm run db:demo` não sobrescreve mais descrição, história e contatos do time; só preenche campos vazios;
- arquivo removido do armazenamento responde 404 em vez de erro interno.

#### Adicionado

- testes de integração em banco exclusivo `<banco>_test`, recriado a cada execução, com recusa de usar o banco de desenvolvimento;
- `npm run db:clean-test-data`: exclusão lógica auditada dos cadastros criados por testes, restauração da logo enviada pelo responsável e remoção de contato e chave PIX de teste;
- `npm run backup`: dump do banco verificado, cópia dos arquivos, manifesto com SHA-256 e retenção de 30 cópias;
- imagens públicas otimizadas no envio: recusa de arquivo corrompido, correção de rotação, redução até 1920 px, conversão para WebP e remoção de metadados (DT-039).

#### Alterado

- `STORAGE_LOCAL_DIR` passa a apontar para fora da pasta do projeto; em produção, caminho absoluto obrigatório. A API confere na inicialização se a pasta aceita gravação;
- imagens públicas aceitas até 10 MB (antes 5 MB), já que são reduzidas antes de gravar.

### Documentação — correção de telas (2026-10-25)

#### Adicionado

- `docs/29-CORRECAO-DE-TELAS.md`: ciclo e classificação de correções, padrões de interface (limites de caracteres, CPF, telefone, textos longos, celular, imagens, selos, filtros) e registro de 20 correções (`COR-001` a `COR-020`);
- pendências `PEN-056` a `PEN-061` para as correções que dependem de decisão.

### Segurança — verificação em duas etapas (2026-10-25)

#### Adicionado

- verificação em duas etapas por aplicativo autenticador (TOTP), obrigatória para administrador e diretoria; sem ela, o painel fica bloqueado (DT-037);
- ativação em **Minha conta → Segurança** com QR code, 10 códigos de recuperação de uso único e geração de novos códigos;
- login em duas etapas, com limite de 5 tentativas por desafio e recusa de código já usado;
- redefinição pelo administrador em **Painel → Usuários** e comando de emergência `npm run mfa:reset`;
- migração `mfa_totp`, 21 testes novos (unitários e de integração).

### Segurança — sessão e endurecimento (2026-10-25)

#### Alterado

- sessões passam a expirar por inatividade (30 min para perfis administrativos, 7 dias para contas comuns) e por duração máxima desde o login (12 h e 30 dias); a renovação automática do site não conta mais como uso (DT-036);
- o site descarta a sessão sem interação dentro do limite e leva ao login com aviso;
- a API escuta somente em `127.0.0.1` por padrão (`API_HOST`).

#### Corrigido

- redirecionamento aberto no parâmetro `next` do login (`/\dominio-externo`);
- vulnerabilidades de negação de serviço com severidade alta em `multer`, `body-parser` e `zod`, e moderadas em `fast-uri`.

#### Adicionado

- Content-Security-Policy, Cross-Origin-Opener-Policy e HSTS (produção) no site;
- migração `sessao_inatividade_limite`, 7 testes unitários e 7 de integração de sessão, 8 testes do redirecionamento seguro.

### Fase 8 — Relatórios, auditoria e otimizações (2026-10-19)

#### Adicionado

- relatórios integrados: atletas, inscrições, mensalidades/inadimplência, Caixa por agrupamento, pendências de comprovante, vendas por produto e por parceiro, remessas (RF-021, RF-045);
- exportação CSV com permissão própria, cabeçalho de período e fuso, auditoria e proteção contra injeção de fórmulas;
- auditoria com filtros avançados e detalhe por requisição (RF-024);
- direitos do titular: cópia dos próprios dados, pedido de eliminação e anonimização auditada (`/minha-conta/privacidade`, `/admin/privacidade`);
- índices medidos, lista pública de parceiros sem N+1, teste de carga básico e runbook de backup/restauração validado;
- migration `fase8_privacidade_indices`, 5 testes unitários e 4 testes de integração (DT-035).

#### Alterado

- o CSV das remessas passa a neutralizar fórmulas de planilha.

### Fase 7 — Comunicação (2026-10-19)

#### Adicionado

- notícias com categorias, rascunho, publicação imediata ou agendada (UTC), slug estável, capa, destaque e canais página inicial/fórum sem duplicação (RF-041, RF-042, RCF-013);
- eventos e partidas com placar, públicos ou internos, ligados a notícias e seletivas (RCF-001);
- fórum com visibilidade pública, de membros e da diretoria; tópicos, respostas, edição e remoção pelo autor, reações idempotentes, denúncias e limites antiabuso (RF-040, RCF-012);
- moderação com motivo, histórico (`ForumModerationAction`), auditoria e aviso ao autor; fila de denúncias (RF-043);
- avisos manuais da diretoria a grupos, idempotentes (`notifications.send`);
- páginas `/noticias`, `/noticias/[slug]`, `/eventos`, `/forum` e destaques na página inicial; painel de notícias, eventos, fórum e avisos;
- permissão `forum.members.access`; 5 testes unitários e 6 testes de integração (DT-034).

### Fase 6 — Parceiros e profissionais (2026-10-19)

#### Adicionado

- parceiros com aprovação, vigência de contrato, comissão, logo, documentos confidenciais e documento cifrado (RF-031, RCF-010);
- publicação e venda somente de parceiro ativo dentro da vigência (loja, carrinho e páginas públicas `/parceiros`);
- snapshot da regra de comissão em cada item vendido, com sobreposição por produto (RF-032, PEN-035);
- repasses com rascunho, aprovação e pagamento que lança uma única saída no Caixa; relatório de vendas por parceiro separando receita do time e valor devido (RN-PAR-003);
- profissionais, serviços e disponibilidade sem sobreposição (RF-033, RCF-011);
- agendamento manual: solicitação em horário livre, confirmação, cancelamento, realizado e ausência, com notificações e e-mail ao profissional (RF-034);
- telas `/admin/parceiros`, `/admin/servicos`, `/admin/agendamentos`, `/admin/repasses`, `/minha-conta/agendamentos` e seletor de parceiro/comissão na ficha do produto;
- migration `fase6_parceiros`, 7 testes unitários e 6 testes de integração (DT-033).

#### Alterado

- pedido com item em repasse ainda não pago não pode ser estornado antes de cancelar o repasse.

### Documentação (2026-10-19)

- guia `docs/COMO-EXECUTAR.md` e guia de continuidade `CONTINUAR.md` para outro agente;
- o logo do site passa a usar, nesta ordem, o brasão enviado pelo painel, `public/brand/brasao-fenix.png` e o símbolo da fênix como reserva;

- relatórios de entrega das fases 1 a 5 (`docs/20` a `docs/24`) e registro do aceite na Fase 0;
- matriz de estado de implementação por requisito (`02-REQUISITOS-FUNCIONAIS.md`);
- arquitetura, modelo de dados, dicionário, perfis, UX, segurança/LGPD, testes, deploy, visão geral, README e CONTRIBUTING atualizados ao estado implementado;
- `npm run db:demo` com dados fictícios para demonstração local.

### Fase 5 — Remessas (2026-10-19)

#### Adicionado

- remessas/campanhas com janela de venda, mínimo/máximo, produtos e preço próprios (RF-035, RF-036, RCF-009);
- encerramento automático por prazo, reabertura com extensão, encomenda condicionada ao mínimo pago;
- relatório consolidado para a malharia e lista de retirada em CSV;
- etapas de produção e recebimento, aviso idempotente aos compradores e retirada rastreável (RF-044);
- cancelamento com estorno vinculado de todos os pedidos; pré-vendas destacadas na loja;
- 6 testes de integração da Fase 5 (DT-032).

### Fase 4 — Loja (2026-10-18)

#### Adicionado

- catálogo com categorias, produtos, variações (SKU, tamanho, cor, preço próprio), imagens, promoção, custo, limite por comprador e modos de venda (RF-015, RF-035, RCF-007/008);
- estoque por razão de movimentações com entrada, perda, ajuste auditado, reserva, liberação, saída e devolução (RF-016);
- carrinho no servidor para usuário e visitante, favoritos privados (RF-037, RF-038);
- checkout transacional com preço congelado, consulta segura de pedido de visitante, comprovante PIX, confirmação de pagamento com entrada no Caixa e estados do pedido (RF-017, RF-018, RF-029);
- cancelamento/reembolso com estorno vinculado e devolução ao estoque; expiração automática de reservas;
- área do cliente (pedidos, favoritos), painel de produtos e pedidos, indicador "Vendas do mês" (RF-019, RF-020);
- migration `fase4_loja_pedidos` e 9 testes de integração (incluindo concorrência de estoque).

#### Pendente de decisão

- `PEN-030` (política de devolução/reembolso da loja) segue aberta: o sistema suporta, mas os termos precisam ser publicados antes de vendas reais.

### Fase 3 — Mensalidades e Caixa Fênix (2026-10-18)

#### Adicionado

- planos de mensalidade, vínculo atleta–plano com valor individual (bolsa) e geração mensal idempotente (RF-011, RF-012);
- pagamentos manuais parciais, confirmação com entrada automática no Caixa, estorno com reembolso vinculado, desconto/isenção motivados e cancelamento (RF-013, RF-029, DT-027);
- consulta de mensalidades por mês, atleta, equipe e situação, com atraso derivado do vencimento (RF-014);
- área do atleta: mensalidades, chave PIX e envio de comprovante (RF-019);
- Caixa Fênix: contas, categorias, centros de custo, formas de pagamento, lançamentos manuais, confirmação, estorno, conciliação, comprovantes, transferências, saldo inicial, contas a pagar/receber e fechamento/reabertura (RF-025 a RF-030, RCF-002 a RCF-006);
- resumo financeiro por período, conta, categoria e origem (RF-045 inicial) e indicadores no painel;
- idempotência por cabeçalho `Idempotency-Key` e travas de linha para concorrência (DT-030);
- 13 testes de integração financeiros, incluindo concorrência e período fechado.

### Fase 2 — Atletas, equipes e inscrições (2026-10-18)

#### Adicionado

- equipes e categorias com páginas públicas e filtro por time (RF-002);
- interessados com consentimento versionado e conversão rastreável em atleta (RF-003, DT-028);
- seletivas com período, vagas e máquina de estados; inscrição pública com regras de menores (RF-004, DT-026);
- atletas: cadastro com documento cifrado e detecção de duplicidade, edição com histórico antes/depois, status com motivo, vínculo com conta e com equipes ao longo do tempo (RF-008 a RF-010);
- área do atleta e do usuário: dados próprios, inscrições e notificações (RF-019, RF-022, DT-029);
- indicadores do painel com definição e origem (RF-020);
- migration `fase2_menores_consentimento` (responsável, ciência e consentimento);
- testes de domínio e 12 testes de integração da Fase 2.

### Fase 1 — Autenticação, permissões e configurações (2026-10-18)

#### Decisões

- Fase 0 aceita; responsável único registrado e fases 1–8 autorizadas (`DT-021`); pendências resolvidas listadas em `PENDENCIAS.md` §12;
- paleta oficial derivada do brasão enviado: `#CD151D`, `#9E0F16`, `#0B0613` (`12-IDENTIDADE-VISUAL.md`);
- autenticação com scrypt, JWT de 15 min e refresh rotativo com detecção de reuso (`DT-022`); organização de módulos (`DT-023`); adaptadores locais de e-mail/arquivos (`DT-024`); paginação (`DT-025`); menores (`DT-026`); mensalidades (`DT-027`).

#### Adicionado

- migration base do schema Prisma e `npm run db:setup` (migrations + seed idempotente do catálogo de permissões, configurações e administrador inicial);
- API: cadastro, login, refresh, logout, recuperação e troca de senha, sessões próprias; administração de usuários, papéis e permissões; auditoria consultável; configurações públicas, financeiras (cifradas com AES-256-GCM) e logos; arquivos com validação de assinatura binária;
- guard global que nega por padrão, verifica permissões no servidor e audita acessos negados; erros em Problem Details; `X-Request-Id`; helmet; rate limiting;
- web: site institucional com identidade Fênix, páginas de autenticação, "Minha conta" e painel administrativo com navegação agrupada por permissão;
- testes unitários (domínio de autenticação, criptografia, componentes) e suíte de integração contra PostgreSQL executada também no CI.

#### Removido

- página técnica de validação da Fase 0 (substituída pelo site institucional).

### Segurança

- Next.js atualizado para 16.4.2 (aviso crítico), Nest para 11.2.7 e overrides de `multer`, `shell-quote`, `sharp`, `postcss`, `deepmerge-ts` e `js-yaml` para versões corrigidas; `npm audit --audit-level=high` sem achados (restam avisos moderados de ferramentas de desenvolvimento).

### Fase 0

#### Adicionado

- documentação consolidada da visão, escopo, requisitos, regras, fluxos, arquitetura, dados, API, UX, identidade, segurança, testes, infraestrutura, roadmap, decisões e viabilidade;
- instruções permanentes em `AGENTS.md`;
- registro explícito de pendências de produto, operação, segurança e LGPD;
- modelo lógico inicial em Prisma e diagramas Mermaid;
- esqueleto de monorepo com aplicações web e API e pacotes compartilhados;
- separação das dependências e configurações TypeScript de frontend e backend por workspace;
- PostgreSQL local por Docker Compose;
- configurações básicas de ambiente, qualidade, testes e build.

### Segurança

- dependências transitivas vulneráveis da toolchain foram substituídas por versões corrigidas e fixadas no lockfile; a decisão temporária está registrada em `DT-019`.

### Corrigido

- resolução de módulos do backend atualizada de `node10` legado para `Node16`, com teste de regressão da configuração TypeScript.
- inicialização do frontend no Windows corrigida ao substituir a expansão de `WEB_PORT` pela variável nativa `PORT` do Next.js.
- `.gitattributes` passa a fixar finais de linha LF; com `core.autocrlf=true` no Windows, o checkout em CRLF fazia `npm run format:check` (e, portanto, `npm run check`) falhar em todos os arquivos.


[Não publicado]: https://github.com/Willow0305/Fenix/commits/main
