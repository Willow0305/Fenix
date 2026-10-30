# Plano de experiência e conversão

Plano para revisar o sistema inteiro com cinco skills de design, tela por tela, com foco nos objetivos do clube. Escrito em 2026-10-29 a pedido do responsável do projeto.

## 1. Objetivos e como medir

| Objetivo do clube | Área | Sinal de sucesso |
|---|---|---|
| Vender mais | Loja, produto, carrinho, finalização, afiliação | carrinhos que viram pedido; pedidos por semana; afiliações vendidas |
| Facilitar a administração | Painel da diretoria | tempo para publicar uma notícia, confirmar um pagamento ou fechar um pedido; menos erros de cadastro |
| Aproximar o público | Fórum | tópicos e respostas por semana; pessoas diferentes participando |
| Ser um meio de notícias | Notícias | leituras e compartilhamentos por notícia; frequência de publicação |
| Informar o vôlei do Acre e de Rio Branco | Eventos | visitas à agenda; "adicionar à agenda" e compartilhamentos |

Hoje o sistema não mede visitas, leituras nem compartilhamentos. Medir exige uma decisão de privacidade (decisão **D5**). Até lá, o que já existe no banco (pedidos, afiliações, tópicos, respostas e notícias publicadas) serve de referência.

## 2. As cinco skills e o papel de cada uma

| Skill | Papel no plano | Onde entra |
|---|---|---|
| **emil-design-eng** (Emil Kowalski) | acabamento de interface e animação: resposta ao toque, curvas, durações e o que **não** deve animar | todas as ondas; já aplicada no acabamento visual (`DT-080`) |
| **web-design-engineer** (Garden) | referências: leitura do contexto, direção declarada antes do código e crítica em 5 dimensões | início de cada onda (referências e direção) e autoavaliação no fim |
| **landing-page-design** (AI Design) | conversão: uma ação principal por tela, risco reduzido ao lado do botão, objeções respondidas e textos com verbo e resultado | loja, produto, carrinho, finalização, afiliação e convites para seletivas |
| **build-awwwards-quality-sites** (mengto) | experiência visual de vitrine: primeira tela marcante, fotos reais, coreografia de entrada e versão estática completa | páginas de vitrine: início, sobre, times e página de venda da afiliação |
| **interface-review** + **better-\*** (Jakub Krehel) | revisão final: procura o que cada mudança piorou em acessibilidade, layout, textos, tipografia, cor e acabamento | ao fim de cada etapa, antes do commit, e numa auditoria geral na última onda |

Apoio: **break-ui** (casos extremos: nome enorme, carrinho vazio, 50 itens), **mobile-native** (celular), **find-animation-opportunities** e **remove-animations** (onde animar ou tirar animação).

### Quando as skills discordam

As skills foram escritas para projetos genéricos. No Fênix, **a identidade aprovada (`docs/12`) e as regras do projeto (`AGENTS.md`) prevalecem**.

| Conflito | Regra da skill | Como fica no Fênix |
|---|---|---|
| Fonte | landing-page-design proíbe Inter; web-design-engineer considera Inter clichê em **título** | Barlow Condensed nos títulos e Inter no texto (`DT-080`, confirmar em `PEN-068`) |
| Degradês e faixas | landing-page-design proíbe degradê de fundo | a faixa diagonal de camisa é grafismo da marca e fica; degradês suaves "de IA" continuam proibidos |
| Ícones | landing-page-design e awwwards pedem Phosphor/Solar | Bootstrap Icons continua (`docs/29 §3.11`); trocar só com decisão técnica |
| Animação | awwwards pede GSAP e rolagem suave; emil prefere CSS e nenhuma animação em ações repetidas | GSAP só nas páginas de vitrine, se aprovado (**D1**); painel, carrinho e finalização sem animação decorativa |
| Avatares | awwwards exige foto em todo avatar | vale para depoimentos de vitrine; no fórum e no painel, iniciais quando a pessoa não enviou foto (`DT-044`) |
| Seção de frase animada | landing-page-design torna obrigatória | só onde tiver papel (página de afiliação, início); não é obrigatória |
| Confirmação antes do código | web-design-engineer pede confirmar a direção antes de construir | vira o **portão 2** de cada onda (seção 4) |

## 3. Decisões que dependem do responsável

Nada desta lista é implementado sem aprovação registrada (`AGENTS.md`: não inventar regra nem antecipar fase).

| # | Decisão | Recomendação | Impacto se não decidir |
|---|---|---|---|
| **D1** | Usar GSAP nas páginas de vitrine (início, sobre, times, afiliação)? E rolagem suave (Lenis)? | **GSAP sim, só na vitrine; rolagem suave não**: ela atrapalha no celular, no leitor de tela e no desempenho. Isso diverge da skill awwwards, que pede uma rolagem suave. | vitrine fica com animações em CSS, mais simples |
| **D2** | Fotos reais do clube (time, jogos, torcida, produtos) com autorização de uso de imagem | prioridade máxima: "foto real > qualquer efeito". Menores só com autorização do responsável | vitrine e produtos continuam com a logo de reserva; o padrão "awwwards" não é alcançável sem fotos |
| **D3** | Agenda do vôlei acreano: publicar jogos e campeonatos **de outros clubes e da federação**? | sim, com tipo "Evento externo", organizador, link oficial e local; destaque separado do que é do Fênix | Eventos continua só com o calendário do Fênix |
| **D4** | Botões "Compartilhar" (WhatsApp e copiar link) e "Adicionar à agenda" (arquivo de calendário) | aprovar: não coletam dado e são o principal meio de alcance no Acre | menos alcance de notícias e eventos |
| **D5** | Medir visitas e leituras | ferramenta própria, sem cookies de terceiros e sem dado pessoal (contagem agregada), registrada em `docs/13` | sem como saber o que funciona |
| **D6** | Conta local de teste com verificação em duas etapas, para revisar o painel com capturas | criar só no ambiente local, nunca em produção | o painel é revisado só pelo código (como hoje) |
| **D7** | No fórum, selo "Diretoria" e "Atleta" ao lado do nome | aprovar só "Diretoria" (é papel público); "Atleta" exige avaliação de LGPD por envolver menores | respostas oficiais se misturam às demais |
| **D8** | Notícias: assuntos/tags, "mais lidas" e galeria de fotos | tags e galeria primeiro; "mais lidas" depende de D5 | notícias seguem só com categoria |
| **D9** | Loja: "avise-me quando chegar" e avaliações de produto | "avise-me" primeiro (usa a notificação existente); avaliações depois, com moderação | — |

Decisões aprovadas viram `DT` em `docs/17` e entrada no `CHANGELOG.md`; dúvidas ficam em `PENDENCIAS.md`.

### Respostas do responsável (2026-10-29, `DT-081`)

| # | Decisão |
|---|---|
| D1 | **Só CSS, sem GSAP** e sem rolagem suave. A vitrine usa as animações em CSS do projeto (`DT-080`); a skill awwwards vale pelo padrão visual, não pela biblioteca. |
| D2 | **Fotos reais fornecidas pelo responsável, com autorização de imagem**, em `referencias/fotos/` (originais). |
| D3 | **Eventos externos aprovados:** organizador, link oficial, times que jogam e placar, preço ou "entrada gratuita" e cidade **livre** (qualquer lugar). Notícias cobrem o vôlei do mundo todo. |
| D4 | **Compartilhar** (WhatsApp e copiar link) em notícias e eventos e **adicionar à agenda** nos eventos. |
| D5 | **Contagem própria**, agregada, sem dado pessoal e sem cookies de terceiros. |
| D6 | **Conta de teste local** com verificação em duas etapas, só para capturas e revisão; nunca em produção. |
| D7 | Selo **"Diretoria"** no fórum; "Atleta" não. |
| D8 | Notícias: **assuntos (lista controlada pela diretoria)**, **galeria** e **"mais lidas"**. |
| D9 | Loja: **"avise-me quando chegar"** (só com conta) e **avaliações com estrelas de 1 a 5** e comentário, só de quem comprou e recebeu, uma por produto, aprovadas pela diretoria antes de aparecer e com o primeiro nome. |
| Cores | **Paleta mantida: vermelho, preto e branco.** O verde aparece só nas fotos do uniforme. |
| Grafismo | **Listras verticais da camisa** no lugar da faixa diagonal (`DT-080` atualizada). |

## 4. Método: cinco portões por tela

Cada tela passa pelos mesmos portões, nesta ordem. Uma tela só fecha quando passa pelos cinco.

1. **Referência (web-design-engineer):** capturas "antes" (computador 1366 px e celular 390 px), duas ou três referências nomeadas e o que se aproveita de cada uma (padrões, nunca cópia de marca ou texto).
2. **Direção (web-design-engineer):** em poucas linhas: ação principal da tela, público, o que muda e o que fica. **Pausa para o responsável confirmar** quando houver mudança de layout ou de fluxo.
3. **Construção (emil + landing-page-design ou awwwards):** dentro da identidade e das regras do projeto; regra de negócio continua no servidor.
4. **Casos extremos (break-ui + mobile-native):** nomes longos, listas vazias, valores altos, tela pequena, toque, teclado e movimento reduzido.
5. **Revisão (interface-review + better-\*):** sobre a mudança, antes do commit. Achados "introduzidos" ou "regressão" são corrigidos na hora; os "pré-existentes" entram na lista da onda 7.

Fechamento de cada etapa: `npm run check` aprovado, capturas "depois", `CHANGELOG.md`, e um commit por etapa verificada na `dev`.

## 5. Ondas de trabalho

Tamanhos relativos: **P** (pequeno), **M** (médio) e **G** (grande). Cada onda separa o que pode ser feito já (melhoria de experiência sem regra nova) do que depende de decisão da seção 3.

### Onda 0 — Base de revisão (P)

- inventário das telas: ~40 do site e ~40 do painel, com a ação principal de cada uma;
- script de capturas versionado (hoje ele fica fora do repositório), para comparar antes e depois em toda onda;
- auditoria geral com **better-interface** (escopo: repositório) para ter a linha de base;
- conta de teste do painel (**D6**).

### Onda 1 — Vender (G) · concluída em 2026-10-30

**Entregue:** correção dos 5 achados altos e dos médios da auditoria de base; produto (desconto, garantias, parcelas, ações depois de adicionar, "Mais em", avise-me, avaliações); carrinho em duas colunas com "Desfazer"; finalização na ordem natural; pedido realizado com o pagamento primeiro; destaque da pré-venda na loja; página de venda da afiliação (`/afiliacao`); mensagens da API com plural por extenso; fila de avaliações no painel. Pendência aberta: `PEN-070`.

**Revisão final da onda:** rodar `/interface-review` sobre os commits da Onda 1 (a skill só roda chamada pelo responsável).

**Referências:** lojas oficiais de clubes brasileiros (vitrine por categoria, pré-venda em destaque), páginas de produto de marcas esportivas (galeria grande, tamanho em botões, garantia ao lado do botão) e finalizações de grandes varejistas brasileiras (resumo fixo, poucos campos, PIX em destaque).

**Já feito, sem commit (passa pelos portões 4 e 5 antes de fechar):**
- produto: coluna de informações corrigida (selo esticado e espaço vazio), selo de desconto, garantias ao lado do botão, "Finalizar compra" e "Continuar comprando" depois de adicionar, e "Mais em [categoria]";
- carrinho: duas colunas no computador, com o resumo fixo; plural corrigido; "Remover" discreto.

**Pode ser feito já:**
- finalização na ordem natural: dados → entrega → pagamento → confirmar, com erro ao lado do campo;
- "em até 12x no cartão" no produto **quando** o cartão estiver ligado (o dado já existe na configuração pública);
- pedido realizado: próximo passo único e claro (QR do PIX em destaque, prazo de 30 minutos visível, o que acontece depois);
- vitrine da loja: pré-venda e destaques em faixa no topo, filtros como botões, busca vazia com sugestões;
- **página de venda da afiliação** ("seja afiliado"), seguindo a estrutura da landing-page-design: benefício principal, parceiros reais com desconto real, como funciona em três passos, perguntas frequentes e um único botão repetido no fim.

**Depende de decisão:** fotos reais de produto (**D2**), "avise-me quando chegar" e avaliações (**D9**).

### Ondas 2 e 3 — Notícias e eventos · concluídas em 2026-10-30

**Entregue:** capa de notícias em formato de portal (manchete, secundárias, lista, chapéu e data relativa); página de leitura (18 px, linha fina, "Leia também", `NewsArticle`); compartilhar (WhatsApp e copiar link, D4); assuntos em lista da diretoria (D8); galeria com legenda (D8); "Mais lidas da semana" com contagem própria e agregada (D5, regra em `docs/13`); prévia do cartão e lista do que falta no painel; agenda por "Hoje", "Nos próximos 7 dias" e "Mais para frente", filtros por lugar ("Acre" e "Outros lugares"), tipo e organização; página do evento com data grande, "Adicionar à agenda" (`.ics`, D4) e `SportsEvent`; eventos externos com organizador, link oficial, cidade e UF, entrada e jogo entre times de fora (D3); "Próximo jogo" no Início.

**Revisão final das ondas:** rodar `/interface-review` sobre os commits das Ondas 2 e 3 (a skill só roda chamada pelo responsável).

**Para a Onda 7:** cabeçalhos da tabela do painel de notícias quebram no meio da palavra em 1366 px ("PUBLICAÇÃ O", "CAN AIS") — pré-existente, entra no padrão único de tabela da Onda 5.

### Onda 2 — Notícias (M)

**Referências:** portais esportivos brasileiros (manchete com foto grande e linha fina, chapéu de categoria, data relativa) e cadernos de esporte de jornais (leitura confortável, uma coluna).

**Pode ser feito já:**
- capa de notícias em formato de portal: manchete, duas secundárias e lista; categorias como botões;
- página de leitura: texto em 18 px com até ~70 caracteres por linha, linha fina destacada, data relativa ("há 2 horas") e "Leia também" no fim;
- dados estruturados de notícia (`NewsArticle`) e imagem de compartilhamento, para aparecer melhor no Google e no WhatsApp;
- painel: prévia de como a notícia vai aparecer (cartão e página) e lista do que falta antes de publicar (capa, resumo, categoria); agendamento (já existe) mais visível.

**Depende de decisão:** compartilhar (**D4**), tags, galeria e "mais lidas" (**D8**, **D5**).

### Onda 3 — Eventos (M)

**Referências:** páginas de calendário de ligas e federações de vôlei (lista por data, jogo com escudos e placar) e plataformas de eventos brasileiras (data grande, local com mapa, "adicionar à agenda").

**Pode ser feito já:**
- agenda agrupada por "Hoje", "Esta semana" e "Próximos", com filtro por tipo;
- próximo jogo do Fênix em destaque no início, com a data grande;
- página do evento: data e local em destaque, mapa (link já existe), placar depois do jogo (o dado já existe);
- dados estruturados de evento esportivo (`SportsEvent`).

**Depende de decisão:** agenda do vôlei acreano com eventos de terceiros (**D3**); "adicionar à agenda" e compartilhar (**D4**).

### Onda 4 — Fórum · concluída em 2026-10-30

**Entregue:** selo "Diretoria" (D7); lista de tópicos com autor, fixados, respostas e última atividade; categorias com a última conversa; tópico com caixa de resposta convidativa; cartão "Participe da conversa" para quem não entrou; estados vazios com ação; paginação com o nome do que conta. Revisão: rodar `/interface-review` sobre os commits da Onda 4.

### Onda 4 — Fórum (M)

**Referências:** fóruns de comunidade (lista com última atividade e número de respostas, fixados no topo) e seções de comentários de portais esportivos (resposta rápida e reações).

**Pode ser feito já:**
- lista de tópicos com respostas, última atividade e fixados no topo (o dado de fixado já existe);
- tópico: iniciais ou foto do autor, número de respostas no lugar de "5 registros", caixa de resposta convidativa e convite para entrar em forma de cartão;
- estados vazios com ação ("Seja o primeiro a comentar").

**Depende de decisão:** selo "Diretoria" (**D7**).

### Onda 5 — Painel da diretoria · concluída em 2026-10-30

**Entregue:** "Para fazer agora" no início do painel (pendências do menu em ordem de urgência); valores em reais com separador de milhar (formatados a partir do decimal) e plural por extenso nas mensagens; padrão de tabela sem palavras partidas e com cartão compacto no celular; paginação com o nome do que conta; botão de salvar fixo em formulário longo; campos que não esticam; Caixa com saldo por conta compacto. Revisão no celular: nenhuma das 43 telas passa da largura de 390 px; as mais altas são listas paginadas. A revisão com `/interface-review` fica para o fim de todas as ondas.

### Onda 5 — Painel da diretoria (G)

**Referências:** painéis administrativos de lojas virtuais e de gestão esportiva (tela inicial com "o que fazer hoje", tabelas com ação no fim da linha, formulários em seções).

**Pode ser feito já** (com **D6** para revisar com capturas):
- início do painel como lista de tarefas: pendências que já existem nos contadores do menu, em ordem de urgência;
- padrão único de tabela (filtro, busca, ação no fim e versão em cartão no celular) e de formulário longo (seções, botão fixo de salvar);
- aviso de "salvo" consistente, erros ao lado do campo e confirmação só em ação irreversível;
- revisão completa no celular, onde a diretoria mais usa.

### Onda 6 — Vitrine (M a G)

Com a skill **build-awwwards-quality-sites**: início, sobre, times e seletivas.

- primeira tela com foto ou vídeo real do time (**D2**), mensagem e botão legíveis antes de qualquer animação;
- sequência de entrada no herói e revelação de títulos por palavra (**D1**), sempre com versão estática completa e sem animação no modo "reduzir movimento";
- "Próximo jogo" e "Últimas notícias" vivos na primeira dobra;
- elenco com fotos autorizadas e história em linha do tempo;
- só números e fatos reais do clube; nada de depoimento, parceiro ou estatística inventada.

### Onda 7 — Revisão final (M)

- **better-interface** sobre o sistema inteiro e correção de tudo que for "alto";
- **break-ui** nas telas de venda e de conteúdo;
- teclado, leitor de tela, zoom de 200% e movimento reduzido;
- desempenho no celular (tempo de carregamento e estabilidade do layout) nas páginas de vitrine e da loja;
- testes ponta a ponta atualizados.

## 6. Ordem recomendada

1. Onda 0 e fechamento do que já está feito na Onda 1.
2. Onda 1 (vender), porque é o objetivo com retorno direto.
3. Ondas 2 e 3 (notícias e eventos), juntas: compartilham componentes (compartilhar, data relativa, dados estruturados).
4. Onda 4 (fórum).
5. Onda 5 (painel).
6. Onda 6 (vitrine), assim que houver fotos (**D2**).
7. Onda 7 (revisão final).

As decisões **D2**, **D3** e **D4** são as que mais destravam resultado; vale decidi-las antes da Onda 2.

## 7. Riscos

| Risco | Cuidado |
|---|---|
| Animação pesada deixar o site lento no celular | GSAP só na vitrine; medir antes e depois; versão estática completa |
| Mudança visual quebrar fluxo de venda | testes ponta a ponta da compra rodam em toda etapa da Onda 1 |
| Foto de atleta menor sem autorização | só com autorização registrada (`DT-044`, `docs/13`) |
| Skill genérica contrariar a identidade | tabela de conflitos da seção 2; `docs/12` prevalece |
| Escopo crescer sem aprovação | itens "depende de decisão" ficam parados até virar `DT` |

## Anexo A — Inventário de telas (Onda 0)

96 páginas em 2026-10-29. Ação principal = o que a tela existe para fazer a pessoa realizar.

| Área | Páginas | Ação principal | Onda |
|---|---|---|---|
| Vitrine | `/`, `/sobre`, `/times`, `/seletivas`, `/seletivas/[slug]`, `/interesse`, `/contato` | conhecer o clube; inscrever-se na seletiva; deixar contato | 6 |
| Venda | `/loja`, `/loja/[slug]`, `/loja/carrinho`, `/loja/pedido` | comprar; finalizar o pedido; consultar o pedido | 1 |
| Afiliação e parceiros | `/parceiros`, `/parceiros/[id]`, `/parceiros/servicos/[id]`, `/validar/[token]`, `/imprimir/carteirinha/[id]` | ser afiliado; usar o desconto; agendar serviço | 1 e 6 |
| Notícias | `/noticias`, `/noticias/[slug]` | ler; compartilhar | 2 |
| Eventos | `/eventos`, `/eventos/[slug]` | saber quando e onde; adicionar à agenda; compartilhar | 3 |
| Fórum | `/forum`, `/forum/[slug]`, `/forum/topicos/[id]` | participar (abrir tópico, responder, reagir) | 4 |
| Conta | `/entrar`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha`, `/minha-conta` e 12 subpáginas | entrar; acompanhar pedidos, mensalidades e carteirinhas | 1 (pedidos) e 7 |
| Entrega | `/entrega/[token]` | entregador confirmar a entrega com o código | 1 |
| Painel: pessoas | `/admin/atletas` (+ novo e detalhe), `/admin/interessados`, `/admin/seletivas` (+ detalhe), `/admin/equipes`, `/admin/usuarios`, `/admin/papeis` | cadastrar e manter atletas e acessos | 5 |
| Painel: financeiro | `/admin/mensalidades` (+ detalhe), `/admin/planos` (+ detalhe), `/admin/caixa` e 4 subpáginas, `/admin/pix`, `/admin/repasses` (+ detalhe), `/admin/relatorios` | receber, conferir e fechar o caixa | 5 |
| Painel: loja | `/admin/produtos` (+ detalhe), `/admin/pedidos` (+ detalhe), `/admin/entrega`, `/admin/devolucoes`, `/admin/remessas` (+ detalhe), `/admin/cupons` | cadastrar produto; despachar pedido | 1 (lado do painel) e 5 |
| Painel: afiliação e parceiros | `/admin/afiliacao` e 4 subpáginas, `/admin/carteirinhas` (+ benefícios), `/admin/parceiros` (+ detalhe), `/admin/servicos`, `/admin/agendamentos` | manter planos, benefícios e parceiros | 5 |
| Painel: comunicação | `/admin/noticias` (+ detalhe), `/admin/eventos`, `/admin/forum`, `/admin/notificacoes` | publicar; moderar; avisar | 2, 3 e 4 (lado do painel) |
| Painel: governança | `/admin`, `/admin/configuracoes`, `/admin/auditoria`, `/admin/privacidade` | ver pendências; configurar; auditar | 5 |
| Sistema | `/offline`, páginas de erro e 404 | voltar a um caminho útil | 7 |

### Ferramentas da Onda 0

- `npm run capturas:conta`: cria ou recria a conta local `capturas@fenix.example` (administrador), com senha nova a cada execução, guardada em `var/capturas-conta.json` (fora do git). Recusa produção e endereço público.
- `npm run capturas -- <rótulo> [filtro]`: captura todas as páginas (as com parâmetro usam o primeiro item real da API) em computador (1366 px) e celular (390 px), em `var/capturas/<rótulo>/`. Na primeira execução depois de criar a conta, ativa a segunda etapa dela pela API.

## Anexo B — Auditoria de base (Onda 0, better-interface)

Feita em 2026-10-29, com as seis skills `better-*` carregadas.

### Escopo e cobertura

- **Escopo:** a base compartilhada, que atinge todas as telas (`apps/web/app/globals.scss`, `components/ui.tsx`, `site-header`, `admin-shell`), e o fluxo de compra (`/loja`, `/loja/[slug]`, `/loja/carrinho`). As demais telas ficam para a auditoria de cada onda. Este relatório não as cobre.
- **Stack:** Next.js 16, React 19, SCSS global com módulos, tokens CSS em `:root`, Bootstrap Icons. Telas em computador (1366 px) e celular (390 px e 320 px).
- **Convenções lidas:** `AGENTS.md`, `CONTRIBUTING.md`, `docs/11-UX-UI.md`, `docs/12-IDENTIDADE-VISUAL.md`, `docs/29-CORRECAO-DE-TELAS.md`, `DT-080` e `DT-081`.

| Domínio | Evidência inspecionada | Resultado |
|---|---|---|
| Acessibilidade | foco global, seletores de opção do produto, gráficos, busca, menus do site e do painel, avisos dinâmicos | 5 achados |
| Layout | produto e carrinho a 320 px (sem rolagem lateral), cabeçalho fixo, linha de compra | 2 achados |
| Textos | erros da API, página de erro, estados vazios da loja, ações do carrinho | 3 achados |
| Tipografia | escala, pesos carregados, algarismos de preço, campos a 16 px, reticências | 1 achado |
| Cores | 16 pares de tokens medidos pela fórmula WCAG | 2 achados |
| Acabamento (UI) | transições, hover, escala ao pressionar, rolagem em sobreposições | 3 achados |

### Achados

| Gravidade | Domínio | Local | Antes | Depois | Por quê |
|---|---|---|---|---|---|
| ALTA | Acessibilidade | `app/(site)/loja/[slug]/product-purchase.tsx:118` | rádio de opção com `visually-hidden` dentro de um `label.btn`; o foco cai no rádio invisível | `label:has(input:focus-visible)` com o mesmo contorno de `:focus-visible` (`globals.scss:176`) | controle alcançável por teclado sem indicador de foco visível (2.4.7) |
| ALTA | Acessibilidade | `app/globals.scss:2099` (`.chart-hit`), `app/globals.scss:1938` (`.search-box input`) | `outline: none`, com só 4% de preenchimento ou nada no lugar | apagar o `outline: none`; nos gráficos, `stroke: var(--color-focus); stroke-width: 2` em `:focus-visible`; na busca, `.search-box:focus-within { box-shadow: inset 0 -2px 0 var(--color-focus) }` | foco removido sem substituto verificado (2.4.7) |
| ALTA | Acessibilidade | `components/variant-attributes.tsx:87`; `app/(site)/loja/[slug]/product-purchase.tsx:105` | opção sem estoque indicada só por `opacity: 0.5` | texto "esgotado" no nome acessível (`aria-label` ou texto visível) e o mesmo sinal visual nos dois seletores | estado comunicado só pela aparência (1.4.1) |
| ALTA | Layout | `app/globals.scss:2484` (`.buy-row`) | `flex-wrap: nowrap`: a 320 px o seletor de quantidade encolhe e o botão "+" fica cortado | `flex-wrap: wrap`, quantidade com `flex: none`, botão com `flex: 1 1 12rem` | controle cortado a 320 px (1.4.10) |
| ALTA | Cores | `app/globals.scss:364`, `:459`, `:552` (`--color-border` em campos) | `#d4d4d8` sobre `#ffffff` mede **1,48:1** | token próprio para contorno de campo (ex.: `--color-border-control`) com 3:1 medido; bordas decorativas seguem com `--color-border` | contorno de controle abaixo de 3:1 (1.4.11), em todos os formulários; `docs/12` deixava a borda "a validar" |
| MÉDIA | Acessibilidade | `components/admin-shell.tsx:258`, `components/site-header.tsx:66` | menus do celular abrem sem levar o foco, sem fechar com Esc e com o fundo ainda ativo | ao abrir, foco no primeiro link; Esc fecha e devolve o foco ao botão; `inert` no conteúdo atrás | ordem de foco (2.4.3) e teclado (2.1.1) |
| MÉDIA | Acessibilidade | `app/(site)/loja/[slug]/product-purchase.tsx:180` | região `role="status"` montada junto com o texto "Adicionado ao carrinho" | região vazia sempre presente, com o texto preenchido depois | anúncio pouco confiável em leitor de tela (4.1.3) |
| MÉDIA | Layout | `components/site-header.module.scss:2` (cabeçalho fixo) | sem `scroll-padding-block-start` | `html { scroll-padding-block-start: 84px; }` | foco e âncoras podem ficar sob o cabeçalho (2.4.11) |
| MÉDIA | Textos | `app/(site)/loja/carrinho/page.tsx:270` | "Remover" apaga a linha na hora, sem desfazer; item personalizado perde o que foi digitado | aviso "Item removido. Desfazer" com a linha guardada por alguns segundos | ação destrutiva sem desfazer; perde dado digitado |
| MÉDIA | Textos | `app/(site)/loja/page.tsx:130` | "Nenhum produto encontrado para o filtro." | "Nenhum produto para “{busca}”." + link "Ver todos os produtos" | estado vazio filtrado sem nomear a busca nem oferecer saída |
| MÉDIA | Cores | `app/globals.scss:394` (`.field-error`) e tokens de `--color-danger` | vermelho de erro a menos de 15° do vermelho da marca, só com texto | ícone de alerta em toda mensagem de erro de campo | erro e destaque da marca confundíveis (uma cor, um significado) |
| MÉDIA | Acabamento | `app/globals.scss:692`, `:1717`, `:1740`, `:2415`, `:2604`, `:2616` | `:hover` fora de `@media (hover: hover)` | mover para dentro da consulta, como nos botões | o estado de hover "gruda" depois do toque no celular |
| MÉDIA | Acabamento | `app/globals.scss:795` (`dialog`), `:1944` (`.search-results`) | `overflow-y: auto` sem `overscroll-behavior` | `overscroll-behavior: contain` | rolar até o fim da janela rola a página atrás |
| BAIXA | Acabamento | `app/globals.scss:258`, `:810`, `:1530`; `components/site-header.module.scss:47`; `components/product-card.module.scss:22` | escala ao pressionar em 0,94, 0,96, 0,97 e 0,99 | um valor só para botões (0,97, `DT-080`) e outro para cartões (0,99), documentados | o mesmo detalhe feito de várias formas |
| BAIXA | Textos | `lib/api-client.ts:48` | "Não foi possível concluir a operação." | dizer o próximo passo ("Confira os dados e tente de novo; se continuar, fale com a diretoria.") | erro sem caminho de recuperação (raro: só sem resposta padronizada da API) |

Fora do limite de 15 achados ficaram dois de tipografia, baixos: `user-select: none` em todo `.btn` (`globals.scss:249`, melhor só em `(pointer: coarse)`) e a falta de `-moz-osx-font-smoothing` ao lado de `-webkit-font-smoothing` (`globals.scss:79`).

### Verificação

- **Passou:** produto e carrinho a 320 px sem rolagem lateral (`scrollWidth = innerWidth = 320`); 14 de 16 pares de cor acima do mínimo (texto secundário 5,75:1; branco no botão 5,64:1; foco azul 4,70:1 na página e 3,87:1 no cabeçalho); campos em 16 px; preços com algarismos tabulares; movimento reduzido mantém só esmaecimento e cor (`globals.scss`, `DT-080`).
- **Não verificado:** leitor de tela real (NVDA ou VoiceOver); zoom de 200%; teclado percorrendo o fluxo de compra inteiro; modo de alto contraste do Windows.

### Veredito

**Block.** Há 5 achados ALTOS. Eles são corrigidos no início da Onda 1, antes de qualquer outra mudança na loja.
