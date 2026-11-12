# Changelog

Todas as mudanças relevantes deste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adotará versionamento semântico a partir do primeiro release.

## [Não publicado]

### Melhorias da análise do sistema (2026-11-11)

#### Adicionado

- repasses a parceiros: ao gerar um repasse, as vendas que o parceiro já recebeu mas cujo pedido foi estornado ou cancelado depois aparecem marcadas para desconto; cada venda é descontada uma única vez, o motivo do ajuste é escrito pelo sistema e o detalhe do repasse lista o que foi descontado. Antes isso era um ajuste manual sem ligação com a venda (PEN-052, DT-111; migração `20261111110000_recuperacao_repasse_estornado`).

#### Segurança

- arquivos restritos: a rota genérica `/api/v1/media/:id` passa a exigir, além de `files.read.restricted`, a permissão do domínio em que o arquivo é usado (documento de parceiro ou de atleta, anexo do Caixa, comprovante e prova de entrega), as mesmas das rotas dedicadas; antes, quem tivesse só `files.read.restricted` abria documentos confidenciais de parceiros (PEN-054, DT-110). Sem mudança para administrador e diretoria, que têm todas.
- freio de tentativas de login por conta: depois de 5 falhas seguidas no mesmo e-mail, novas tentativas ficam bloqueadas por 1 minuto, dobrando a cada nova falha até 15 minutos; o titular recebe um aviso por e-mail na primeira vez; a resposta é igual para e-mail sem cadastro, e o login certo ou a redefinição de senha liberam (PEN-053, DT-109; migração `20261111100000_freio_login_por_conta`).

#### Alterado

- serviços grandes da API divididos por assunto, sem mudança de regra (PEN-077, DT-114): pedidos da loja em leitura, checkout, pagamentos, situação e pedido sem conta; mensalidades em leitura, planos, cobranças e pagamentos; catálogo em leitura, categorias, campos de personalização, produtos e fotos; a classe original continua com os mesmos métodos.
- módulos da API renomeados para não confundir: `card` (pagamento com cartão) virou `card-payment` e `cards` (carteirinhas) virou `member-cards`, com as classes `CardPaymentModule` e `MemberCardsModule`. As rotas da API não mudam (DT-113).
- cinco índices novos no banco para chaves estrangeiras usadas em consultas: vendas por produto, notícias por assunto, lançamentos de um fechamento de caixa e avaliações e reações por pessoa (cópia dos dados e anonimização) (DT-112; migração `20261111120000_indices_chaves_estrangeiras`).
- o CI passa a rodar também em push na branch `dev`, onde o desenvolvimento acontece; antes um erro só aparecia no pull request ou no merge com a `main`. Os ponta a ponta no CI ficam como `PEN-076`.

#### Corrigido

- testes de integração não estouram mais a memória: rodam um de cada vez num processo auxiliar que o Jest troca ao passar de 1,5 GB, em vez de todos no mesmo processo (DT-114).
- teste ponta a ponta da entrega em casa (celular): o aviso "A entrega foi registrada" aparece também na região lida pelo leitor de tela (DT-106) e o teste achava dois textos; agora confere só o aviso visível.
- `npm run e2e` não deixa mais o `apps/web/next-env.d.ts` alterado: o build do site para os testes reescrevia o arquivo apontando para `.next-e2e`; agora o original é restaurado ao fim do build.
- `CONTINUAR.md` atualizado: branch `dev`, contagem atual de testes e banco de testes isolado (`DT-038`); `PEN-066` (Etapa 9) movida para as resolvidas.

### Fórum: advertência, suspensão e regras (2026-11-10)

#### Adicionado

- a diretoria adverte ou suspende do fórum por 7 dias, 30 dias ou até liberar, com a regra quebrada e o motivo, a partir da denúncia ou da mensagem; a pessoa recebe o aviso no site e por e-mail, continua lendo e não publica, responde, edita nem reage durante a suspensão; página "Regras do fórum" com texto editável no painel (DT-108; migração `20261110110000_forum_advertencias`).

### Carteirinha da diretoria na conta (2026-11-10)

#### Adicionado

- teste ponta a ponta: quem é da diretoria vê a carteirinha válida com o QR em Minha conta › Carteirinhas.

### Elenco lotado (2026-11-10)

#### Adicionado

- a diretoria e o administrador podem fechar os contatos de "Quero jogar no Fênix" em Painel → Interessados: o convite, o botão do Início e o link do rodapé somem, o formulário avisa que o elenco está completo e seletivas abertas continuam aceitando inscrição (DT-107).

### Revisão de interface (2026-11-10)

#### Alterado

- a pausa da fênix animada virou um interruptor no canto superior direito, nas cores da fênix, com dica do que faz ao passar o mouse (DT-105).

#### Corrigido

- mensagens de sucesso e erro do site e do painel lidas pelo leitor de tela quando aparecem depois de uma ação; botões de enviar sempre ativos, com o navegador apontando o campo que falta (DT-106).
- carrossel de pré-vendas e seletivas e a fênix animada do Início e do Entrar com botão de pausar; prestação de contas sem rolagem animada ao corrigir e com o foco no formulário e no aviso de emitida; foco na mensagem que aparece depois de "Trazer para minha conta" e "Reenviar o link"; botões de enviar ativos, com o navegador apontando o campo que falta; nomes claros para "Abrir" e "Esquecer" dos pedidos lembrados e aviso quando "Copiar link" falha (DT-105).

### Botão "Quero jogar no Fênix" sem seletiva aberta (2026-11-09)

#### Alterado

- sem seletiva aberta, o botão "Quero jogar no Fênix" do Início leva ao convite "Quer jogar com a gente?" da página Times, para deixar o contato; com seletiva aberta, continua levando às inscrições em Eventos (DT-104).

### Prestação de contas (2026-11-09)

#### Adicionado

- prestação de contas em Financeiro: escolha do período (com atalhos), prévia com entradas por categoria e saídas detalhadas (quem recebeu só quando a diretoria marca), assinaturas com o cargo, emissão congelada com número e código de conferência, correção como nova versão, PDF para imprimir e compartilhar no WhatsApp e conferência do código (DT-103).

### Cargo na diretoria (2026-11-09)

#### Adicionado

- cargo na diretoria (Presidente, Tesoureiro(a)…) definido pelo administrador em Usuários, mostrado na carteirinha da diretoria; quem é atleta e da diretoria continua pagando a mensalidade, agora garantido por teste (DT-102).

### Carteirinha de atleta e mensalidade atrasada (2026-11-09)

#### Alterado

- a carteirinha de atleta fica suspensa quando a mensalidade passa do prazo de tolerância (padrão 10 dias, ajustável pela diretoria) e volta a valer sozinha quando é paga; o atleta é avisado e a mudança fica na auditoria (DT-101).

### Cartão pelo site só com conta (2026-11-09)

#### Alterado

- pagar com cartão pelo site agora exige conta com e-mail confirmado; sem conta, PIX ou com a diretoria. A diretoria vê o nome e o CPF mascarado do titular do cartão no pedido, com aviso quando o nome não bate com o de quem comprou (DT-100).

### Seletivas em Eventos (2026-11-09)

#### Alterado

- as seletivas saíram do menu e do Início e aparecem em destaque no topo de Eventos, só enquanto aceitam inscrição (aberta, dentro do período e com vaga); com mais de uma, em carrossel como a pré-venda; o cartão some quando o prazo acaba; `/seletivas` leva para Eventos (DT-099).

### Fênix animada (2026-11-02)

#### Adicionado

- a fênix da tela inicial e da tela de login ganhou vida (vídeo em loop); no login, o brasão completo animado fica à direita do formulário; em conexão lenta, aparelho fraco, movimento reduzido ou Safari/iPhone fica a logo parada (DT-098).

### Auditoria em português (2026-11-01)

#### Alterado

- a auditoria mostra as ações e as entidades em português ("Pedido criado", "Senha redefinida"…), e o filtro de ação virou uma lista com esses textos (DT-097).

### Pedidos sem conta: trazer para a conta e confirmação de e-mail (2026-11-01)

#### Adicionado

- confirmação do e-mail da conta por link (no cadastro e em Minha conta); ao confirmar, as compras feitas sem conta com o mesmo e-mail passam para a conta; logado, a consulta de pedido oferece "Trazer para minha conta" (DT-096).

### Pedidos sem conta: "Esqueci o código" (2026-11-01)

#### Adicionado

- na consulta de pedido, "Esqueci o código ou perdi o link" reenvia para o e-mail da compra o acesso de cada pedido sem conta, sem revelar se o e-mail comprou na loja (DT-096).

### Pedidos sem conta: avisos por e-mail e WhatsApp (2026-11-01)

#### Adicionado

- quem compra sem conta recebe por e-mail (e por WhatsApp, se escolher no checkout) cada novidade do pedido: recebido, pago, pronto para retirada, saiu para entrega, entregue, cancelado e respostas da diretoria, sempre com o link fixo; a página do pedido liga e desliga o WhatsApp e lembra de olhar a caixa de spam (DT-096).

### Pedidos sem conta: código fácil, link fixo e lembrar no aparelho (2026-11-01)

#### Alterado

- o código do pedido de quem compra sem conta ficou mais fácil (`K7QH-3MXP`, aceita minúsculas e sem traço); o pedido tem um link fixo que abre direto; a consulta lembra os pedidos neste aparelho por 90 dias, com opção de esquecer (DT-096).

### Personalizados: diretoria pode recusar a desistência (2026-11-01)

#### Alterado

- a desistência de item personalizado volta a poder ser recusada pela diretoria, com o motivo registrado; o site avisa antes da compra; item comum continua com a desistência garantida e defeito sempre coberto (DT-095, substitui DT-093).

### Fênix do carrossel (2026-11-01)

#### Alterado

- a pré-venda troca de remessa a cada 4 segundos com o deslize padrão de carrossel, sem a fênix (DT-090).

### Responsável e canais (2026-11-01)

#### Documentação

- respostas do responsável registradas em `docs/35`: sem CNPJ por enquanto (responde a presidente), recomendação de abrir a loja só depois do CNPJ e duas contas de e-mail gratuitas do time (contato e privacidade/segurança).

### Novo aceite dos termos (2026-11-01)

#### Adicionado

- quando os termos de uso ou a política de privacidade mudam, quem já tem conta lê e aceita a versão nova ao entrar (ou sai da conta); o aceite fica registrado por versão (DT-094).

### Desistência de personalizados (2026-11-01)

#### Alterado

- itens personalizados também têm a desistência de 7 dias depois de receber; a diretoria confere o prazo e o item devolvido e faz o estorno integral, sem poder negar dentro do prazo; a ciência no checkout passa a avisar que o item é feito sob medida (DT-093).

### Conta de atleta menor (2026-11-01)

#### Adicionado

- a diretoria cria a conta do atleta menor do time com a declaração assinada pelo responsável, com modelo para imprimir; a conta não participa do fórum e o perfil fica privado até os 18 anos (DT-092).

### Convite para jogar (2026-11-01)

#### Adicionado

- a diretoria pode desligar o convite "Quer jogar com a gente?" em Configurações; com seletiva aberta ele aparece mesmo desligado (DT-091).

### Pré-vendas em carrossel (2026-11-01)

#### Alterado

- o destaque da loja mostra todas as pré-vendas abertas, alternando sozinho; a fênix da logo atravessa o cartão em chamas revelando a próxima, e volta pelo lado oposto; setas e bolinhas para navegar; para com o mouse, o toque ou o foco, e não se move com "reduzir movimento" (DT-090).

### Contas de adultos, versões dos termos e análise jurídica (2026-11-01)

#### Adicionado

- versões dos termos de uso e da política de privacidade: cada texto salvo vira uma versão imutável com hash; o cadastro guarda qual versão a pessoa aceitou e pede nova leitura se o texto mudou; as páginas mostram a versão em vigor (DT-089; migração `20261101090000_versoes_dos_termos`);
- análise jurídica dos rascunhos, decisões e perguntas abertas (`docs/35-ANALISE-JURIDICA.md`).

#### Alterado

- conta própria só para maiores de 18 anos, e conta não é vinculada a atleta menor ou sem data de nascimento (DT-088, ECA Digital);
- pré-venda: a página do produto informa que, sem o mínimo, a remessa é cancelada com devolução de 100% do valor pago (PEN-032).

### Logs, métricas e carrinho (2026-11-01)

#### Adicionado

- testes de unidade dos logs em JSON, das métricas e do registro de acesso, e teste da rota `/api/v1/metrics` com e sem token; `LOG_FORMAT`, `ACCESS_LOG` e `METRICS_TOKEN` no `.env.example`; decisão técnica de E2E e observabilidade (DT-086);
- os testes de ponta a ponta guardam o log da API em `var/e2e-logs/api.log` (PEN-070).

#### Corrigido

- carrinho: duas leituras simultâneas logo depois de entrar na conta juntavam o carrinho de visitante duas vezes e dobravam as quantidades; agora só uma junta (PEN-070).

#### Alterado

- 165 dos 247 estilos inline das telas trocados por classes utilitárias, sem mudança visual (R-09, DT-087).

### Revisão de interface das ondas (2026-10-30)

#### Corrigido

- avaliação de produto: enviar sem nota leva o foco às estrelas, marcadas como inválidas e ligadas à mensagem "Escolha de 1 a 5 estrelas.";
- carrinho: ao remover um item, o foco vai para "Desfazer" em vez de voltar ao topo da página;
- fotos no painel: no limite, o motivo de não poder enviar nem recortar fica escrito na tela (antes só aparecia ao passar o mouse sobre o botão desativado); lixeira com área de toque de 32 px;
- compartilhar pelo WhatsApp avisa o leitor de tela que abre em nova aba, como o rodapé e o Google Agenda.

### Várias posições na ficha do atleta (2026-10-30)

#### Alterado

- a ficha do atleta aceita mais de uma posição, com as mesmas caixas da inscrição; o elenco em Times mostra todas quando o vínculo com o time não define uma posição própria; Minha conta e a lista de atletas mostram todas (DT-085; migração `20261030110000_posicoes_do_atleta`).

### Várias posições desejadas (2026-10-30)

#### Alterado

- "Quero jogar no Fênix" e a inscrição em seletiva aceitam mais de uma posição desejada (levantador, ponteiro, oposto…), em caixas de marcar; o painel mostra todas, e a ficha do atleta criada a partir da inscrição vem com a primeira (DT-085; migração `20261030100000_varias_posicoes`).

### Celular único e elenco com todos os atletas (2026-10-30)

#### Alterado

- celular passa a ser único entre as contas, como o e-mail, com ou sem máscara: cadastro, edição do perfil e criação de conta pela diretoria recusam número de outra conta (DT-084). Migração `20261030090000_celular_unico`: números repetidos ficam com a conta mais antiga e saem das outras, com registro na auditoria;
- elenco em Times mostra todo atleta ativo do time com nome e posição; a foto só aparece com perfil público, e sem ela entra a logo do Fênix. Menores continuam só com a autorização do responsável (DT-084, revisa DT-044).

### Agenda pelo Google e bolinha do sino (2026-10-30)

#### Alterado

- "Adicionar à agenda" virou "Adicionar ao Google Agenda": abre o Google Agenda com o evento preenchido, sem baixar arquivo; o arquivo `.ics` foi removido (DT-083, revisa D4);
- avisos de pedido entregue, cancelado e reembolsado continuam na lista de notificações, mas não acendem mais a bolinha do sino; os demais avisos de pedido seguem contando (DT-083).

### Onda 7: revisão final de acessibilidade, casos extremos e desempenho (2026-10-30)

#### Adicionado

- teste ponta a ponta de acessibilidade (`e2e/tests/accessibility.spec.ts`, DT-082): axe com WCAG 2.2 A e AA em 16 páginas de vitrine, venda e conteúdo, sem rolagem lateral em 320 px, nada se mexendo com "reduzir movimento" e foco visível pelo teclado;
- dados de demonstração de pior caso na loja e em Times (`npm run db:demo`): produto com nome no limite, variação longa, preço de quatro dígitos, uma unidade em estoque e time com nome comprido.

#### Alterado

- fotos e logos do site no tamanho em que aparecem, pelo otimizador de imagens do Next (DT-082): no celular, o maior conteúdo da tela aparece em até 2,4 s (antes até 6,9 s no Sobre) e a página inicial pesa metade;
- carrossel do Sobre baixa só a foto atual e as vizinhas; primeira foto de Times e imagem principal do produto carregam sem esperar a rolagem.

#### Corrigido

- carrinho: nome de opção longo empurrava o seletor para fora do cartão, espremia o rótulo "Opção" e, no computador, fazia o nome do produto passar por baixo do preço;
- página do evento no celular: a data fica em cima, e local e endereço usam a largura toda;
- Times: nome do atleta não é mais cortado em duas linhas (é a única identificação no cartão); aviso de elenco vazio volta a ter o recuo do cartão;
- painel do Caixa: gráfico de receita e despesa lido pelo leitor de tela mês a mês (antes era uma imagem só, com as colunas focáveis escondidas) e notas dos indicadores em HTML válido.

### Documentação jurídica e privacidade (2026-10-30)

#### Adicionado

- rascunhos de Termos de Uso e Política de Privacidade, identificando expressamente dados e decisões ainda pendentes de aprovação;
- resumo da aplicação para orientar revisões futuras por IA, com inventário funcional, evidências técnicas e fontes oficiais;
- pendência `PEN-071` para revisão jurídica do arrependimento em itens personalizados/afiliação e para versionamento do aceite dos documentos.

### Desenvolvimento: abrir no celular pela mesma rede (2026-10-30)

#### Alterado

- `npm run dev` libera os IPs de rede do computador para abrir o site no celular (`http://IP:3000`), só em desenvolvimento: o Next aceita esses endereços e a API passa a aceitá-los na proteção de origem (CSRF) e no CORS; em produção, só `WEB_ORIGIN`. Outros nomes em `DEV_ALLOWED_ORIGINS`; passo a passo em `COMO-EXECUTAR.md`;
- identificadores de aba e de pagamento funcionam fora de conexão segura (`crypto.randomUUID` só existe em HTTPS ou localhost; sem ele, o login pelo IP de rede falhava);
- fotos do clube na página Sobre um pouco mais baixas no computador (proporção 2:1).

### Identidade: fundo original de volta no início (2026-10-30)

#### Alterado

- herói da página inicial e convites "Afiliações abertas" e "Quer jogar com a gente?" voltam ao fundo original, com brilho vermelho suave atrás da logo (anterior à faixa diagonal de `DT-080`), a pedido do responsável; o mesmo brilho vale em todas as superfícies escuras (imagem sem foto, afiliação, fórum, pré-venda), no lugar das listras (DT-081 revisto);
- fotos do clube na página Sobre, passando sozinhas a cada 6 segundos, com legenda, anterior, próxima e Pausar; param com o mouse ou o foco em cima e não trocam sozinhas em "reduzir movimento". A diretoria envia e ordena em Configurações › Fotos do clube (até 20; migração `20261030070000_fotos_do_clube`); o herói da página inicial continua com a logo;
- recortar fotos no painel (fotos do clube, de produto e da galeria da notícia): enviar uma foto por vez abre o ajuste antes de subir, e "Recortar" troca uma foto já enviada pela versão cortada na mesma posição; formatos original, 3:2, 16:9, 4:3 e 1:1.
- foto de cada time (D2, DT-081): enviada em Equipes, já com recorte em 3:2; aparece no topo dos cartões "Nossos times" do Início e ao lado do nome na página Times; sem foto, fica só a logo (migração `20261030080000_foto_do_time`).
- modelo "Faixa" da carteirinha volta à faixa diagonal.

### Plano de experiência: Onda 5, painel da diretoria (2026-10-30)

#### Alterado

- início do painel com "Para fazer agora": as pendências das bolinhas do menu em ordem de urgência (PIX, pedidos, mensalidades, LGPD, devoluções, inscrições, interessados, agendamentos, fórum, avaliações), cada uma com link para resolver.
- tabelas do painel: cabeçalhos não quebram mais no meio da palavra ("PUBLICAÇÃ O") e garantem a largura mínima da coluna; no celular, cada linha vira cartão com o rótulo à esquerda e o conteúdo junto (nome com selo, botões e situação compactos), em vez de empilhar cada pedaço numa linha;
- paginação diz o que conta em todas as listas ("187 pedidos", "12 atletas", "3 denúncias") no lugar de "registros".
- formulários longos do painel mantêm o botão de salvar visível no rodapé enquanto se rola.
- Caixa Fênix: saldo por conta numa tabela compacta (recolhida quando há mais de 6 contas), no lugar de um cartão por conta.

#### Corrigido

- valores em reais sem separador de milhar ("R$ 19086,80") nos indicadores do painel e nas mensagens de pedido, mensalidade e conta; agora "R$ 19.086,80", formatado a partir do decimal, sem ponto flutuante;
- "pedido(s) pago(s)" e "dia(s) útil(eis)" com plural por extenso.
- campos de formulário esticavam de altura quando o vizinho da mesma linha tinha texto de ajuda.

### Plano de experiência: Onda 4, fórum (2026-10-30)

#### Alterado

- selo "Diretoria" ao lado do nome de quem tem esse papel, nas mensagens e na lista de tópicos (D7, DT-081);
- lista de tópicos com iniciais do autor, fixados destacados no topo, número de respostas e "última de [nome], há 2 horas"; lista vazia com "Seja o primeiro a abrir um tópico";
- categorias mostram a última conversa; comunicados da diretoria com data relativa;
- tópico com "Aberto por", número de respostas e caixa de resposta convidativa ("Sua resposta", "Publicar resposta");
- quem não entrou vê um cartão "Participe da conversa" com Entrar e Criar conta, no lugar da frase solta;
- paginação diz o que conta ("2 tópicos", "5 mensagens") em vez de "registros".

#### Corrigido

- script de capturas não encontrava o primeiro tópico do fórum e ganhou a tela de edição da notícia.

### Plano de experiência: Ondas 2 e 3, notícias e eventos (2026-10-30)

#### Alterado

- capa de notícias em formato de portal: manchete com foto grande, duas secundárias e lista com capa pequena; categorias como botões; chapéu da categoria e data relativa ("há 2 horas");
- página da notícia para leitura: uma coluna, texto em 18 px, linha fina destacada, autor e data, "Compartilhar" (WhatsApp e copiar link, D4) e "Leia também" da mesma categoria;
- dados estruturados de notícia (`NewsArticle`) e cartão de compartilhamento do tipo artigo.
- agenda de eventos agrupada em "Hoje", "Nos próximos 7 dias" e "Mais para frente", no fuso de Rio Branco, com filtro por tipo (`/eventos?tipo=MATCH`; a API pública aceita `type`);
- página do evento com a data grande, quando e onde no mesmo bloco, "Adicionar à agenda" (arquivo `.ics`, D4) até o fim do evento, "Compartilhar" e dados estruturados (`SportsEvent`).
- eventos externos na agenda (D3, DT-081): organizador, página oficial, cidade livre com UF, entrada gratuita ou com preço e jogo entre times de fora com placar; filtro "Acre / Outros lugares" e "Do Fênix / De outros organizadores"; formulário do painel com a seção "Organização, lugar e entrada" (migração `20261030030000_eventos_externos`).
- assuntos de notícias em lista controlada pela diretoria (D8, DT-081): até 5 por notícia, mostrados no fim do texto e com página própria (`/noticias?assunto=`); cadastro em Painel › Notícias › Assuntos de notícias (migração `20261030040000_assuntos_noticias`).
- galeria de fotos na notícia (D8, DT-081): até 30 fotos com legenda, ordenadas no painel e abertas no site na janela escura da loja, com anterior, próxima e setas do teclado (migração `20261030050000_galeria_noticias`).
- "Mais lidas da semana" na capa de notícias (D5, D8, DT-081), com contagem própria e agregada: só notícia, dia e total, sem cookie nem dado de quem leu (migração `20261030060000_leituras_noticias`).
- painel da notícia: prévia do cartão como aparece no site e lista do que falta (capa, resumo, categoria ativa e assunto), como aviso, sem travar a publicação.
- Início: "Próximo jogo" do Fênix em destaque, com a data grande, "Ver o jogo" e "Adicionar à agenda"; a lista de próximos eventos não repete esse jogo.

### Plano de experiência: Onda 1, produto e carrinho (2026-10-29)

#### Alterado

- página do produto: informações sem espaços vazios, selo de desconto ("-11%"), garantias ao lado do botão (PIX, 7 dias para desistir, 90 dias contra defeito), "Finalizar compra" e "Continuar comprando" depois de adicionar e "Mais em [categoria]";
- carrinho em duas colunas no computador, com resumo fixo; "Remover" discreto com "Desfazer";
- busca sem resultado na loja diz o que foi buscado e leva a todos os produtos.
- finalização na ordem de quem compra: dados, entrega, pagamento, garantias e confirmar;
- "ou em até 12x no cartão" no produto quando o cartão pelo site está ligado.
- pedido realizado: título com o número do pedido e pagamento antes do resumo.
- loja: destaque da pré-venda aberta no topo, com prazo ("faltam N dias") e o mínimo de unidades pagas para a encomenda acontecer.
- página de venda da afiliação (`/afiliacao`): descontos reais dos parceiros, como funciona, perguntas frequentes e um único botão; o convite do Início leva para ela.
- "Avise-me quando chegar" em opção esgotada (só com conta): a pessoa recebe o aviso quando a variação volta ao estoque, e o pedido é apagado em seguida (DT-081).
- avaliações com estrelas na página do produto: média, total e as aprovadas, com o primeiro nome; quem comprou e recebeu avalia; a diretoria aprova em Painel › Loja › Avaliações, com contador no menu (DT-081).
- listas vazias do painel não repetem "0 registros".

#### Corrigido

- auditoria de base (docs/31, Anexo B): foco visível em seletores de opção, gráficos e busca; opção esgotada anunciada; contorno de campo com contraste 3:1; menus do celular fecham com Esc; quantidade e botão de compra cabem em 320 px.

### Plano de experiência: Onda 0 (2026-10-29)

#### Adicionado

- plano de experiência e conversão em `docs/31`, com as decisões do responsável (DT-081), o inventário das 96 telas e a auditoria de base (5 achados altos, corrigidos na Onda 1);
- `npm run capturas:conta`: conta local de capturas do painel, recusada em produção e com endereço público;
- `npm run capturas -- <rótulo> [filtro]`: capturas de tela de todas as páginas, do site e do painel, em computador e celular.

### Acabamento visual com a cara do Fênix (2026-10-29)

#### Alterado

- títulos na fonte condensada Barlow Condensed e texto em Inter, servidas pelo próprio site (DT-080; fonte dos títulos a confirmar em PEN-068);
- faixa diagonal de camisa como grafismo da marca no herói, nos convites escuros e na reserva de imagem, no lugar dos brilhos vermelhos genéricos; a fênix nunca fica sobre vermelho;
- página inicial: cartões de time com logo, texto curto e seta; dois botões no herói; logo menor no celular para o convite caber na primeira tela;
- botões e cartões respondem ao toque; efeitos de mouse não "grudam" no celular; janelas, avisos e menus entram com animação curta; "reduzir movimento" mantém só esmaecimentos;
- celular: área segura do notch, menu do site com o item atual marcado, menu do painel desliza e fecha ao tocar fora;
- rodapé sempre no fim da tela; botões do cabeçalho vazados sobre o fundo escuro;
- textos: cabeçalhos do painel dizem para que a tela serve; plurais por extenso ("2 tópicos" em vez de "tópico(s)"); "Olá, Nome" no painel; setas de texto trocadas por ícones.

#### Corrigido

- seletiva aberta no cadastro, mas fora do período ou sem vagas, aparecia no site com o selo "Inscrições abertas" e o texto "foram encerradas"; agora o selo diz "Inscrições fechadas";
- a página Times contava toda seletiva publicada (inclusive agendada ou encerrada) como "aberta"; agora conta só as que aceitam inscrição.

### Cartão pelo site (2026-10-28)

#### Adicionado

- "Cartão pelo site" no checkout: crédito em até 12x (juros do parcelado pagos pelo comprador) ou débito, no formulário seguro do Mercado Pago, com o PIX como alternativa (DT-079);
- "Cartão: sem juros até N" no cadastro do produto; no carrinho vale a menor regra; códigos de "preço diferenciado" do Mercado Pago em Painel → PIX e cartão (PEN-067);
- baixa automática no Caixa como cartão de crédito ou débito; estorno do pedido enviado ao Mercado Pago pela fila, com aviso se falhar;
- modo de teste com "Simular cartão aprovado" e "Simular recusado".

### Papéis e permissões (2026-10-28)

#### Adicionado

- Painel → Papéis e permissões: criar papéis para cada trabalho (financeiro, atendimento, cadastro…), copiar permissões de outro papel, editar, excluir e marcar permissões por área (DT-078).

### Carteirinha da diretoria (2026-10-28)

#### Adicionado

- carteirinha gratuita e automática para a diretoria, válida enquanto a pessoa tiver o papel (DT-077);
- benefícios marcados por público: diretoria, atletas e afiliados, juntos ou separados; os atuais de atletas passaram a valer também para a diretoria.

### Forma de pagamento e cancelamento (2026-10-28)

#### Adicionado

- "Como pagar" no checkout: PIX (pague em até 30 minutos) ou cartão ou dinheiro combinado com a diretoria (pedido reservado por 72 horas, com aviso à diretoria e botão "Falar com a diretoria no WhatsApp") (DT-076);
- "Cancelar pedido" para o comprador enquanto não pagou, em Meus pedidos, na consulta de visitante e logo depois da compra.

#### Alterado

- o QR do PIX estende a reserva até a validade dele (mínimo de 30 minutos do intermediário); pedidos vencidos são cancelados a cada 2 minutos.

### Ajustes de loja e site (2026-10-28)

#### Alterado

- troca de entrega para retirada não devolve a taxa: ela é paga uma vez por pedido (DT-075);
- carrinho no topo do site igual ao sino: só o ícone e a quantidade.

#### Adicionado

- página de cada evento para ler por inteiro (data, local, mapa, placar, texto, seletiva e notícias), aberta pelo cartão e pela notícia relacionada.

### Entrega em casa — etapa 2: comprovante de entrega (2026-10-28)

#### Adicionado

- quadro "Entrega" no pedido do painel: registrar a saída com entregador cadastrado ou digitado (tipo, nome, telefone, veículo, placa e observação), link do entregador com "Copiar mensagem" e "Enviar pelo WhatsApp", código informado pelo motoboy, foto com quem recebeu, "Não deu certo", troca para retirada com a taxa devolvida e histórico de saídas (DT-075);
- código de 4 dígitos para o comprador (Meus pedidos, consulta de visitante e aviso), com o primeiro nome, o veículo e a placa de quem leva;
- página do entregador, sem login, com endereço, mapa, ligar, código e foto;
- "Não recebi" em até 3 dias quando a entrega só foi marcada, com bolinha em Pedidos e três desfechos; sem aviso, a entrega se confirma sozinha;
- Painel → Entrega em casa → Entregadores.

#### Corrigido

- E2E: a preparação apaga o build anterior do site; o cache de dados guardava produtos do banco recriado e o primeiro "Adicionar ao carrinho" falhava.

### Entrega em casa — etapa 1: entrega no pedido (2026-10-28)

#### Adicionado

- checkout com "Retirar com o Fênix" ou "Receber em casa": bairro da lista, CEP que preenche a rua, taxa e prazo da região, aviso de quanto falta para o frete grátis e total com a entrega (DT-075);
- Minha conta → Endereços: guardar, escolher o padrão e apagar; também dá para guardar no checkout;
- Painel → Loja → Entrega em casa: ligar/desligar, cidade, frete grátis e regiões com taxa, prazo e bairros;
- estado "Saiu para entrega" (com volta para separação em nova tentativa) e aviso ao comprador;
- taxa lançada no Caixa como "Entregas"; desistência de todo o pedido devolve também a entrega.

### Entrega em casa — regra aprovada (2026-10-27)

#### Decidido

- retirada grátis ou entrega em Rio Branco com taxa por região e frete grátis opcional (DT-075, RN-ENT-001 a 007);
- comprovante de entrega: dados opcionais do entregador, código de 4 dígitos, link sem login para motoboy de fora, foto, "Recebi" e "Não recebi" em 3 dias.

### Aba Afiliação no painel (2026-10-27)

#### Adicionado

- Painel → Afiliação, com Visão geral, Planos de afiliação, Benefícios, Carteirinhas e Visual da carteirinha num lugar só (DT-072);
- planos criados e editados à parte dos produtos: preço, validade, período de venda, fotos, publicar, pausar e avisar;
- carteirinhas filtradas por plano e números da afiliação na visão geral.
- benefício de loja sem cadastro no site (combinado no boca a boca): só nome e, se quiser, onde fica ou contato (DT-074);
- descrição no cadastro de produto novo e em destaque, com título, na página do produto.
- visão geral da Afiliação mostra os dois tipos de carteirinha (atleta gratuita e afiliado paga) com os benefícios de cada um e atalho para configurá-los.

#### Corrigido

- barra superior do painel no celular: botões viram só ícone e a página não rola mais para o lado;
- "Você não tem permissão" na aba Afiliação: permissões novas agora são liberadas sozinhas quando a API inicia (DT-073).

### PIX automático (2026-10-27)

#### Adicionado

- "Pagar com PIX" em pedidos (com conta ou visitante) e mensalidades: QR e copia e cola do Mercado Pago, tela que confirma sozinha e baixa com lançamento no Caixa sem conferência manual (DT-071);
- modo de teste com "Simular pagamento"; o PIX com comprovante continua como alternativa;
- Painel → PIX automático: intermediário em uso, conta que recebe e PIX recebidos fora do esperado para revisar (com bolinha e aviso);
- passo a passo de configuração do Mercado Pago em `docs/COMO-EXECUTAR.md`.

### Entrega comprovada, desistência e defeito (2026-10-27)

#### Adicionado

- entrega comprovada: foto anexada pela diretoria ou "Recebi" do comprador; os prazos contam daí (DT-070);
- "Desistir da compra" em até 7 dias da entrega (itens não personalizados; afiliação, da ativação) e "Problema com o produto" em até 90 dias, em Meus pedidos e na consulta de visitante;
- painel Trocas e devoluções com bolinha: desistência não pode ser negada (estorno integral pelo Caixa, item volta ao estoque, afiliação cancelada); defeito resolvido com troca, conserto ou estorno, ou recusado com resposta;
- estorno parcial de pagamento, vinculado ao recebimento original; cancelar o pedido depois devolve o restante;
- direitos de quem compra no checkout e em Termos.

### Produtos personalizados (2026-10-27)

#### Adicionado

- campos de personalização por produto (ex.: nome na camisa, número), obrigatórios ou opcionais, com acréscimo de preço, cadastrados na tela do produto (DT-069);
- página do produto com seletores de tamanho, modelo e cor, guia de medidas e campos de personalização; o preço já mostra o acréscimo;
- no carrinho, cada personalização é uma linha própria e pode ser editada até fechar o pedido; item personalizado exige ciência de que não há troca por arrependimento;
- a personalização fica travada no pedido e aparece no painel e em Meus pedidos;
- remessa: planilha da malharia com tamanho, modelo e cor, e planilha de produção peça a peça com nome e número.

### Afiliação vendida pela loja (2026-10-27)

#### Adicionado

- produto do tipo Afiliação, com validade em meses; no carrinho, um beneficiário por unidade (nome completo e e-mail opcional; o comprador vem como beneficiário 1) ou a renovação de uma carteirinha existente (DT-068);
- pagamento confirmado cria uma carteirinha de afiliado por beneficiário (pedido só de afiliação fica entregue); renovar soma ao período; cancelar ou estornar o pedido cancela as carteirinhas ou volta a data da renovação;
- carteirinha comprada para quem não tem conta aparece para quem comprou e passa para o beneficiário quando ele confirmar o e-mail;
- aviso 15 dias antes de a afiliação vencer; bloco "Afiliações abertas" no Início; botão "Avisar todos" no produto (uma vez só).

### Carteirinha digital e benefícios de parceiros (2026-10-27)

#### Adicionado

- carteirinha de atleta (automática para atletas ativos) em Minha conta → Carteirinhas, com QR que muda a cada minuto, benefícios e impressão em tamanho de cartão (DT-068);
- conferência em `/validar/…`: lojas parceiras, sem login, veem válida/inválida, nome curto, foto (menores só com autorização) e os benefícios; a diretoria logada vê os detalhes;
- painel: Carteirinhas (busca, filtros, suspender, reativar, cancelar, reemitir, estender, corrigir nome, histórico de conferências e visual com três modelos e fundo personalizado) e Benefícios (cadastro completo de descontos por parceiro);
- benefícios aparecem na página de Parceiros e de cada parceiro;
- permissões novas: Conferir carteirinhas, Gerenciar carteirinhas e Gerenciar benefícios de parceiros.

### Planos, contas, seletivas e avisos de conteúdo (2026-10-27)

#### Adicionado

- avisos de notícias, eventos e novos tópicos do fórum por e-mail ou WhatsApp, que qualquer pessoa liga em Minha conta → Notificações (desligados por padrão) (DT-067);
- ao inativar um plano, a tela mostra o impacto e permite cancelar as mensalidades futuras sem pagamento e encerrar o vínculo dos atletas; excluir faz isso sempre (DT-066);
- `npm run db:fees-ended-plans` corrige planos excluídos antes da regra.

#### Alterado

- conta financeira com histórico pode ser excluída quando inativa, sem pendências e com saldo zero; o histórico continua nos relatórios; contas inativas ficam recolhidas (DT-065).

#### Corrigido

- a bolinha de Seletivas contava inscrições de seletivas apagadas ou encerradas.

### Convite para jogar em destaque (2026-10-26)

#### Alterado

- em Times, "Quer jogar com a gente?" virou um bloco em destaque logo abaixo dos filtros, com quantas seletivas estão abertas (do tipo filtrado) e os botões "Ver seletivas abertas" e "Deixar meu contato"; sem seletiva aberta, o convite é deixar o contato.

### Exemplos de conteúdo e ajustes visuais (2026-10-26)

#### Adicionado

- `npm run db:demo` cria 2 notícias, 2 eventos (um próximo e um realizado, com placar) e um fórum com 2 tópicos, com textos longos e palavras gigantes para teste visual.

#### Corrigido

- logo quebrada quando a imagem falhava antes de a página terminar de carregar (ex.: página "não encontrada"): agora cai para o símbolo da fênix;
- notícia sem capa não mostra mais um bloco escuro vazio acima do texto.
- rodar `npm run check` (ou `npm run db:demo`) com `npm run dev` aberto derrubava a API de desenvolvimento, porque os dois usavam a pasta `dist`; o modo dev agora compila em `apps/api/dist-dev`.

### Logos dos times no site (2026-10-26)

#### Adicionado

- cada time tem a própria logo, enviada em Painel → Equipes, na edição do time; aparece em Times e nos cartões do Início (sem logo, o brasão). Configurações → Marca fica com brasão, diretoria e capa; as logos antigas de masculino/feminino foram copiadas para os times desse tipo (DT-064);
- logo da diretoria no painel; imagem de capa no Sobre e ao compartilhar links (DT-063).

### Excluir contas financeiras e remessas (2026-10-26)

#### Adicionado

- excluir conta financeira que nunca foi movimentada; com lançamentos, o sistema explica e sugere inativar, preservando o histórico (DT-062);
- editar e excluir remessa: exclusão só sem pedidos (rascunho, agendada ou cancelada); com pedidos, só cancelar.

#### Corrigido

- o ajuste de estoque voltou a aceitar quantidade negativa (ex.: -2).

### Listas que não crescem sem fim (2026-10-26)

#### Alterado

- Interessados abre só nos casos em aberto (novo, contatado, qualificado); convertidos e arquivados ficam em "Encerrados";
- Seletivas separadas em "Em andamento" e "Encerradas", com paginação;
- paginação em Fechamentos, Avisos enviados e Vendas por parceiro (Agendamentos já tinha).

### Pendências no menu e avisos flutuantes (2026-10-26)

#### Adicionado

- bolinhas no menu do painel com o que espera ação (comprovantes, pedidos a separar, interessados, inscrições, agendamentos, denúncias, pedidos de titulares) (DT-061);
- avisos que surgem e somem no canto da tela quando chega algo novo; a diretoria passa a ser avisada de pedido novo, comprovante enviado, interessado e inscrição;
- em Notificações, apagar uma notificação ou todas as lidas; preferências de aviso recolhidas no fim da página; foto de perfil no topo de Minha conta.

### App instalável (2026-10-26)

#### Adicionado

- o site pode ser instalado no celular e no computador como aplicativo, com página de aviso quando não há internet; nada da conta fica guardado no aparelho (DT-059).

### Busca global e painel financeiro (2026-10-26)

#### Adicionado

- busca no painel (botão "Buscar" ou Ctrl+K) em atletas, pedidos, produtos, parceiros, usuários, interessados, seletivas e notícias, sem diferenciar acentos (DT-057);
- Caixa → Painel financeiro: receita, despesa e resultado do mês, inadimplência e previsto a receber, com gráficos dos últimos 6, 12 ou 24 meses e tabela (DT-058).

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
