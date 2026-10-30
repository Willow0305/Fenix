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

### Onda 1 — Vender (G) · já iniciada

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

### Onda 4 — Fórum (M)

**Referências:** fóruns de comunidade (lista com última atividade e número de respostas, fixados no topo) e seções de comentários de portais esportivos (resposta rápida e reações).

**Pode ser feito já:**
- lista de tópicos com respostas, última atividade e fixados no topo (o dado de fixado já existe);
- tópico: iniciais ou foto do autor, número de respostas no lugar de "5 registros", caixa de resposta convidativa e convite para entrar em forma de cartão;
- estados vazios com ação ("Seja o primeiro a comentar").

**Depende de decisão:** selo "Diretoria" (**D7**).

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
