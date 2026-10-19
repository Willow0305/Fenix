# UX e UI

## Objetivo da experiência

A interface deve tornar simples o que é frequente — inscrição, consulta, pagamento manual, compra e atualização de status — sem esconder a complexidade necessária de finanças, permissões e auditoria. A experiência é mobile-first nas jornadas públicas e de consulta; áreas administrativas precisam continuar eficientes em telas maiores sem se tornarem inutilizáveis no celular.

## Princípios

1. **Próxima ação clara:** cada tela destaca uma ação principal e explica pré-condições.
2. **Estado sempre explícito:** pago, aberto, atrasado, pendente, cancelado e similares aparecem por texto/ícone, nunca só por cor.
3. **Prevenção antes da correção:** validação contextual, resumo antes de confirmar e bloqueio de estados inválidos.
4. **Divulgação progressiva:** detalhes financeiros, filtros e auditoria ficam acessíveis sem sobrecarregar a visão inicial.
5. **Consistência multicanal:** notícia/evento é fonte única para início, fórum, calendário e notificações.
6. **Privacidade visível:** formulários explicam finalidade; páginas próprias não revelam dados de terceiros.
7. **Acessibilidade por padrão:** HTML semântico, teclado, foco visível, rótulos, contraste e mensagens anunciáveis.
8. **Recuperação segura:** erro preserva entrada não sensível quando possível e informa como continuar.

## Arquitetura de navegação

### Área pública

`Início · Sobre · Times · Notícias · Eventos · Seletivas · Loja · Parceiros · Fórum · Contato · Entrar`

- No mobile, itens secundários entram em menu identificado e operável por teclado.
- Carrinho/favoritos permanecem no contexto da loja; o carrinho pode exibir indicador fora dela apenas quando tiver itens.
- Conteúdo administrativo nunca é entregue na navegação pública por simples ocultação visual.

### Área do usuário

`Visão geral · Perfil · Atleta · Mensalidades · Pagamentos · Pedidos · Favoritos · Agendamentos · Notificações · Fórum`

Somente módulos habilitados e autorizados aparecem. Acesso por URL continua sendo validado no servidor.

### Área administrativa

Agrupar a navegação reduz uma lista de 28 itens:

- **Pessoas:** atletas, interessados/inscrições, seletivas, equipes.
- **Financeiro:** mensalidades, Caixa, pagar/receber, conciliação, fechamento.
- **Loja:** produtos, estoque, remessas, pedidos.
- **Parceiros:** parceiros, profissionais, serviços, agendamentos, repasses.
- **Comunicação:** notícias, eventos, fórum, notificações.
- **Governança:** relatórios, usuários/permissões, configurações, arquivos, auditoria.

## Padrões comuns a todas as telas

| Situação | Comportamento obrigatório |
|---|---|
| Carregamento inicial | Esqueleto coerente com o layout; região com `aria-busy`; nenhuma ação destrutiva habilitada. |
| Carregamento de ação | Botão mantém rótulo contextual, mostra progresso e evita envio duplicado. |
| Estado vazio | Explica o que falta, distingue “sem dados” de “filtro sem resultado” e oferece CTA somente se autorizado. |
| Erro de campo | Mensagem junto ao campo e resumo no início; foco vai ao primeiro erro após envio. |
| Erro de serviço | Linguagem simples, opção de tentar novamente e ID de correlação quando útil; sem stack trace. |
| Sucesso | Confirma o que mudou e mostra próximo passo; não depende apenas de toast transitório. |
| Ação destrutiva/sensível | Confirma alvo e consequência; motivo obrigatório quando a regra exigir; nunca usa confirmação só por cor. |
| Tabela | Cabeçalho associado, ordenação anunciada, paginação/filtros persistentes; no mobile vira cartões ou rolagem com coluna-chave fixa. |
| Formulário | Rótulo visível, obrigatoriedade indicada, ajuda antes do erro, autocomplete apropriado e dados sensíveis sem pré-preenchimento indevido. |
| Data/hora/dinheiro | Exibe fuso/período quando relevante; data civil não desloca por fuso; moeda é explícita. |
| Permissão negada | Diferencia autenticação necessária de falta de permissão sem revelar existência de recurso alheio. |

Os catálogos abaixo herdam esses padrões. “Padrão” na coluna de estados significa carregamento, vazio, erro, sucesso, teclado e responsividade acima, além das particularidades citadas.

## Telas implementadas

| Área | Rota | Fase |
|---|---|---:|
| Público | `/`, `/sobre`, `/contato`, `/termos`, `/privacidade` | 1 |
| Público | `/times`, `/seletivas`, `/seletivas/[slug]`, `/interesse` | 2 |
| Público | `/loja`, `/loja/[slug]`, `/loja/carrinho`, `/loja/pedido` | 4–5 |
| Autenticação | `/entrar`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha` | 1 |
| Minha conta | `/minha-conta`, `/seguranca`, `/notificacoes`, `/inscricoes` | 1–2 |
| Minha conta | `/atleta`, `/mensalidades` (somente atleta vinculado) | 2–3 |
| Minha conta | `/pedidos`, `/pedidos/[id]`, `/favoritos` | 4 |
| Painel | `/admin` (indicadores e atalhos) | 2–4 |
| Painel — Pessoas | `/admin/atletas`, `/admin/atletas/novo`, `/admin/atletas/[id]`, `/admin/interessados`, `/admin/seletivas`, `/admin/seletivas/[id]`, `/admin/equipes` | 2 |
| Painel — Financeiro | `/admin/mensalidades`, `/admin/mensalidades/[id]`, `/admin/planos`, `/admin/caixa`, `/admin/caixa/obrigacoes`, `/admin/caixa/fechamentos`, `/admin/caixa/cadastros` | 3 |
| Painel — Loja | `/admin/produtos`, `/admin/produtos/[id]`, `/admin/pedidos`, `/admin/pedidos/[id]`, `/admin/remessas`, `/admin/remessas/[id]` | 4–5 |
| Painel — Governança | `/admin/usuarios`, `/admin/papeis`, `/admin/configuracoes`, `/admin/auditoria` | 1 |

Todas as telas seguem os padrões da seção anterior: rótulos visíveis, erros associados aos campos e resumo focável, estados de carregamento e vazio, ações sensíveis com confirmação e motivo, e navegação filtrada por permissão (sem substituir a autorização da API).

## Catálogo — área pública

| Tela | Objetivo e perfis | Componentes e campos | Ações e validações | Estados e responsividade |
|---|---|---|---|---|
| Página inicial | Apresentar o Fênix a todos | Cabeçalho, hero, times, notícias/eventos em destaque, seletivas, loja, parceiros, contato, rodapé | Ir para inscrição/loja/contato; publicar apenas conteúdo marcado público | Padrão; sem destaques mantém conteúdo institucional; mobile empilha CTAs e usa mídia otimizada |
| Sobre o Fênix | Expor história, missão, contatos e identidade a todos | Texto institucional, linha do tempo opcional, logos autorizados, contato/redes | Navegar para times/contato; links externos identificados | Padrão; texto em largura legível e mídia adaptativa |
| Notícias | Listar publicações públicas | Busca, categoria, cards com capa, resumo, data, autor/destaque | Filtrar e abrir; busca normalizada e paginação | Padrão; “nenhuma notícia” e “nenhum resultado” distintos; grid vira lista |
| Notícia/comunicado | Ler uma publicação pública | Título, resumo, conteúdo, capa autorizada, autor/categoria, data e evento relacionado | Compartilhar URL canônica e abrir relação publicada; não exibir rascunho/arquivado | Padrão; conteúdo sem capa mantém hierarquia; mídia e texto refluem no mobile |
| Eventos e partidas | Exibir agenda pública | Calendário/lista, filtros, data/hora/local, equipes, vínculo com notícia | Filtrar, abrir detalhe, adicionar ao calendário se aprovado | Padrão; fuso explícito; mobile usa lista cronológica, não calendário comprimido |
| Times masculino e feminino | Apresentar equipes/categorias ativas | Seletor/filtro, descrição, imagem/logo, notícias/eventos relacionados | Trocar categoria; slug/filtro deve referenciar categoria publicada | Padrão; categoria sem conteúdo tem estado institucional, não erro |
| Loja | Descobrir produtos | Busca, filtros de categoria/tamanho/modo/parceiro, grid, preço, status, favorito, carrinho | Buscar, filtrar, favoritar autenticado, adicionar disponível | Padrão; filtro em painel mobile; favorito exige login; produto indisponível não oferece compra |
| Produto | Avaliar e escolher item | Galeria, nome, descrição, preço/promoção, parceiro, variações, quantidade, estoque/campanha, retirada | Selecionar variação/quantidade, favoritar, adicionar; servidor revalida limites | Padrão; variação obrigatória tem erro contextual; galeria com texto alternativo |
| Carrinho | Revisar itens antes do pedido | Itens, variação, quantidade, preço, subtotal/total, avisos de campanha | Atualizar/remover, continuar compra, avançar; revalidar preço/disponibilidade | Vazio com CTA para loja; conflito destaca item; mobile fixa resumo sem encobrir conteúdo |
| Checkout | Coletar identificação e confirmar pedido; não implica gateway real nesta fase | Identificação, contato, retirada/entrega se aprovada, itens, total, método disponível, termos | Revisar e criar pedido; validar contato, consentimentos aplicáveis e disponibilidade no servidor | Padrão; etapa preserva dados não sensíveis; mobile usa fluxo linear; pagamento automático fica futuro |
| Seletivas | Mostrar seletivas aptas | Cards/lista, equipe, data, local, período, vagas se publicadas, status | Filtrar, abrir, inscrever; somente ativa/aberta habilita ação | Padrão; encerrada permanece informativa conforme política; datas locais claras |
| Inscrição em seletiva | Registrar inscrição | Seletiva, nome, contato, nascimento, posição, experiência/observações, privacidade | Enviar e revisar; validar período, formato e campos aprovados no servidor | Padrão; encerramento concorrente informa sem perder entrada; formulário em uma coluna no mobile |
| Interesse em participar | Cadastrar interessado sem criar atleta/conta automaticamente | Nome, contato, nascimento, posição, observações, aviso de privacidade | Enviar; validar finalidade e campos aprovados | Padrão; confirmação explica que envio não é aprovação |
| Parceiros | Exibir apenas parceiros aprovados | Busca/tipo, logo, descrição, produtos/serviços e contato público | Filtrar, abrir produtos/profissionais | Padrão; sem parceiros não expõe cadastros pendentes |
| Profissionais | Descobrir serviços publicados | Profissional, profissão, parceiro, serviços, valor, disponibilidade resumida | Filtrar, abrir agenda/solicitar | Padrão; nenhum dado de saúde ou contato privado; cards empilhados no mobile |
| Agendamento | Descobrir disponibilidade; solicitar como visitante somente se `PEN-028`/`PEN-037` aprovarem | Serviço, profissional, data/horário disponível e, na jornada autorizada, contato e observação operacional mínima | Consultar; solicitar/revisar apenas pelo ator aprovado; impedir horário inválido/ocupado; não coletar prontuário | Padrão; sem fluxo público aprovado solicita autenticação; conflito sugere voltar à agenda; calendário vira lista no mobile |
| Fórum público | Ler somente categorias/tópicos cuja visibilidade pública for aprovada em `PEN-039` | Categorias, tópicos, comunicados e estado de moderação permitido | Abrir conteúdo público; publicar, comentar, reagir ou denunciar exige autenticação e permissão | Padrão; sem política aprovada não existe rota pública; conteúdo restrito não aparece em contagem ou busca |
| Contato | Encontrar canais institucionais autorizados; pode ser página ou seção da página inicial | Endereço, e-mail, telefone, redes, horário e mapa somente quando aprovados para publicação | Abrir canal externo identificado; não usar dados pessoais internos | Padrão; ausência de um canal não quebra a página; definição página/seção permanece provisória |
| Login | Iniciar sessão | E-mail, senha, mostrar/ocultar senha, lembrar somente se política permitir | Entrar, recuperar, cadastrar; resposta genérica a credencial inválida, rate limit | Padrão; foco no e-mail; senha compatível com gerenciador |
| Cadastro | Criar conta comum | Nome, e-mail, senha/confirmação, aceite/avisos aplicáveis | Criar; validar força, igualdade, e-mail e unicidade sem autoatribuir papel | Padrão; requisitos de senha anunciados; fluxo de aprovação explicado |
| Recuperação de senha | Solicitar e concluir redefinição | E-mail; depois nova senha/confirmação e token fora da exibição | Solicitar/redefinir; resposta inicial não confirma existência da conta; token expira | Padrão; link inválido oferece nova solicitação; nenhum segredo fica na URL após uso quando evitável |

## Catálogo — área do usuário

| Tela | Objetivo e perfis | Componentes e campos | Ações e validações | Estados e responsividade |
|---|---|---|---|---|
| Dashboard | Resumir pendências do usuário/atleta | Cards de mensalidade, pedido, inscrição, agendamento e notificação; atalhos | Abrir item próprio; totais limitados ao usuário | Padrão; módulo sem acesso não aparece; mobile ordena pendências antes de histórico |
| Perfil | Manter dados da conta | Nome, e-mail, telefone, preferências e segurança | Editar campos permitidos, alterar senha, revogar sessões; reautenticar ação sensível | Padrão; e-mail pode exigir reverificação; ações de segurança separadas |
| Dados do atleta | Consultar dados esportivos próprios | Dados pessoais permitidos, posição, status, equipes e histórico | Solicitar/editar campos autorizados; regra de edição é provisória | Padrão; campos somente leitura distinguíveis sem baixo contraste |
| Mensalidades | Consultar cobranças | Lista, referência, vencimento, valor/moeda, status, filtros e detalhe | Filtrar, abrir pagamento/comprovante próprio; não editar cobrança | Padrão; atraso explicado por texto; cards no mobile |
| Pagamentos | Consultar histórico próprio | Método mascarado, valor, data, origem, status e comprovante permitido | Filtrar, abrir detalhe/baixar arquivo autorizado | Padrão; comprovante indisponível informa política, sem URL pública |
| Pedidos | Acompanhar compras | Número seguro, data, itens, total, campanha, status e linha do tempo | Filtrar, abrir detalhe; cancelamento apenas se regra permitir | Padrão; mobile prioriza status e próxima ação |
| Favoritos | Retomar produtos salvos | Grid/lista de produtos favoritados | Desfavoritar, abrir, adicionar disponível | Vazio com CTA para loja; indisponível continua identificável conforme política |
| Agendamentos | Acompanhar solicitações | Serviço, profissional, data, status, histórico | Abrir, cancelar/reagendar se autorizado | Padrão; solicitação e confirmação visualmente distintas |
| Notificações | Ler avisos próprios | Lista por tipo/data, não lidas, filtros e destino | Marcar como lida, abrir origem; ação em massa se aprovada | Padrão; falha ao abrir origem não revela recurso removido |
| Fórum | Participar conforme visibilidade | Categorias, tópicos, editor, comentários, reação e denúncia | Criar/comentar/reagir/denunciar segundo permissão; validar tamanho/conteúdo | Padrão; tópico fechado desabilita editor com explicação; mobile preserva hierarquia |

## Catálogo — área administrativa

| Tela | Objetivo e perfis | Componentes e campos | Ações e validações | Estados e responsividade |
|---|---|---|---|---|
| Dashboard administrativo | Priorizar operação da diretoria | Cards de atletas, mensalidades abertas, inscrições novas, vendas; alertas e período | Filtrar período/equipe, abrir origem; definições de indicador explícitas | Padrão; cards em grade/rolagem; sem permissão oculta dado e rota |
| Atletas | Pesquisar e manter atletas | Busca, filtros, tabela, status, equipe; formulário de dados/contato/posição | Criar, editar, mudar status, vincular equipe; validar duplicidade e permissão | Padrão; tabela vira cartões; ações sensíveis em menu rotulado |
| Inscrições | Analisar interessados/seletivas | Filtros, fila, dados mínimos, status, histórico | Abrir, mover estado, converter em atleta; motivo onde definido | Padrão; vazio por filtro; comparação sem expor dados excessivos |
| Seletivas | Planejar eventos de seleção | Título, equipe, descrição, local, datas, período, limite/status | Criar, publicar, encerrar/cancelar, ver inscritos; fim após início | Padrão; calendário móvel vira campos/lista |
| Mensalidades | Gerar e acompanhar cobranças | Período, equipe/atleta/plano, tabela, status e totais | Gerar, filtrar, abrir, registrar pagamento; prévia antes de lote | Padrão; lote mostra progresso e resultado parcial seguro; duplicidade bloqueada |
| Caixa Fênix | Ver posição financeira | Cards de saldo/entradas/saídas/pendências, conta/período/categoria/origem/status, tabela | Nova entrada/saída/transferência, anexar, exportar conforme permissão | Padrão; dinheiro alinhado e moeda visível; mobile usa resumo + cartões |
| Contas a pagar | Controlar obrigações | Favorecido, categoria/centro, competência, vencimento, valor, status, anexos | Criar, aprovar/confirmar conforme política, pagar, cancelar | Padrão; vencidas destacadas também por texto; campos financeiros revisados antes de confirmar |
| Contas a receber | Controlar recebíveis | Pagador/origem, categoria, competência, vencimento, valor, status | Criar, confirmar recebimento, cancelar/vincular origem | Padrão; duplicidade de origem bloqueada; mobile prioriza vencimento |
| Conciliação | Comparar registros e saldo | Conta, período, saldo esperado/contado, diferença, itens pendentes, observação | Marcar/conferir, registrar diferença, preparar fechamento | Padrão; diferença sempre com sinal/moeda; grandes listas paginadas |
| Fechamento de caixa | Fechar/reabrir período | Conta, período, totais, diferença, observação, responsável e histórico | Fechar; reabrir só com permissão/motivo | Padrão; confirmação resume consequências; mobile evita tabelas densas |
| Loja | Resumir operação comercial | Vendas, pedidos pendentes, estoque baixo, campanhas e atalhos | Navegar a produto/estoque/pedido/remessa; filtrar período | Padrão; indicadores têm origem/período |
| Produtos | Manter catálogo | Nome, descrição, mídia, categoria, marca/parceiro, preços, custo, modo, variações, SKU, limites, retirada | Criar, editar, ativar/inativar, pré-visualizar; validar Decimal e campos por modo | Padrão; formulário por seções; rascunho antes de publicar |
| Estoque | Controlar movimentos | Produto/variação, saldo derivado, mínimo, entradas/saídas/reservas/ajustes | Registrar ajuste com motivo, filtrar/exportar autorizado | Padrão; saldo negativo proibido conforme regra; mobile mostra uma variação por cartão |
| Remessas | Operar campanhas | Produto, período, mínimo/máximo, previsões, status, consolidação e retiradas | Abrir/encerrar, gerar relatório, registrar produção/chegada/retirada, cancelar | Padrão; linha do tempo; cada transição confirma pré-condições |
| Pedidos | Operar vendas | Busca/filtros, cliente mínimo, itens, total, pagamento, campanha e status | Abrir, mudar estado, registrar pagamento/cancelamento/reembolso autorizado | Padrão; mudança concorrente pede recarga; dados privados minimizados |
| Parceiros | Gerir relação comercial | Dados, tipo, período, contrato/documentos, logo, status, comissão/repasse | Criar, aprovar/inativar, vincular oferta, ver relatório; validar acesso documental | Padrão; documentos nunca em link público; mobile separa dados e finanças |
| Profissionais | Gerir profissionais/serviços | Parceiro, profissão, registro se aplicável, contatos, serviços, preço/duração/status | Criar/editar/publicar, manter disponibilidade | Padrão; não oferece campo de prontuário; contato público explicitamente selecionado |
| Agendamentos | Operar solicitações | Filtros, solicitante mínimo, serviço, horário, status e histórico | Confirmar, propor horário, cancelar/concluir; impedir conflito | Padrão; agenda em lista no mobile; diferença de fuso explícita |
| Fórum e moderação | Manter comunidade segura | Filas de denúncia, categorias, tópicos, comentários, visibilidade, histórico | Ocultar/remover logicamente, fechar/fixar, decidir denúncia; motivo/auditoria | Padrão; conteúdo potencialmente ofensivo pode iniciar recolhido; atalhos acessíveis |
| Notícias | Manter conteúdo editorial | Título, resumo, conteúdo, capa, autor/categoria, slug, canais, destaque, publicação | Salvar rascunho, pré-visualizar, publicar/agendar, ocultar/arquivar | Padrão; valida slug/data/mídia; preview responsivo |
| Eventos | Manter eventos/partidas | Tipo, título/equipes, data/hora/local, descrição, notícia/canais | Criar/editar/publicar/cancelar, relacionar notícia | Padrão; data civil/hora/fuso claros; evita duplicação |
| Relatórios | Analisar/exportar dados autorizados | Tipo, período, filtros, colunas, totais, geração e formato | Visualizar, exportar com permissão própria; validar volume/minimização | Padrão; geração longa assíncrona se necessário; mobile foca filtros/resumo |
| Usuários e permissões | Administrar acesso | Busca, status, papéis, permissões, sessões e histórico | Criar/convidar, bloquear, atribuir/revogar, revogar sessão; impedir autoelevação indevida | Padrão; mudanças exibem diferença antes/depois; reautenticação para alto risco |
| Configurações do time | Manter dados institucionais/operacionais | Seções de identidade, contatos, redes, financeiro, termos, regras e notificações | Editar, pré-visualizar, publicar sem deploy; visibilidade por campo | Padrão; alterações não salvas avisadas; dados financeiros separados dos públicos |
| Logos e arquivos | Gerir mídia por contexto | Upload, tipo/contexto, alt text, dimensões/metadados, status e uso | Enviar, validar, pré-visualizar, ativar/inativar; sem modificar fonte original | Padrão; progresso acessível; rejeição explica tipo/tamanho, não detalhe interno |
| Auditoria | Investigar ações sensíveis | Período, ator, ação, entidade, ID, motivo, valores permitidos e correlação | Filtrar, abrir detalhe, exportar restrito; sem editar/apagar | Padrão; dados sensíveis redigidos; mobile usa resumo e detalhe progressivo |

## Wireframes textuais

### WF-01 — Página inicial

```text
[Logo Fênix] [Início] [Times] [Notícias] [Seletivas] [Loja] [Parceiros] [Fórum] [Entrar]
--------------------------------------------------------------------------------------
| HERO: imagem/capa + "Fênix Vôlei" + mensagem institucional                         |
| [Inscreva-se em uma seletiva]  [Conheça a loja]                                    |
--------------------------------------------------------------------------------------
| Próximo evento        | Seletivas abertas       | Produto em destaque              |
--------------------------------------------------------------------------------------
| Notícias e comunicados (cards)                                                      |
--------------------------------------------------------------------------------------
| Times/categorias | Parceiros aprovados | Contato e redes                           |
--------------------------------------------------------------------------------------
[Rodapé: endereço, política de privacidade, termos, acessibilidade]
```

No mobile, menu vira botão com nome acessível; CTAs e cards ficam em uma coluna, e o evento mais próximo vem antes de conteúdo promocional.

### WF-02 — Loja e carrinho

```text
[Logo] Loja  [Busca________________] [Filtros] [Favoritos] [Carrinho 2]
----------------------------------------------------------------------
| Filtros              | [Produto] [Produto] [Produto]                |
| categoria            | imagem    imagem    imagem                   |
| tamanho/cor          | preço     preço     preço                    |
| estoque/remessa      | status    campanha  parceiro                 |
| parceiro             | [♡] [+]   [♡] [+]   [♡] [+]                 |
----------------------------------------------------------------------
| Carrinho (painel/página): itens, variações, quantidades, subtotal    |
| [Continuar comprando]                         [Revisar pedido]        |
```

No mobile, filtros abrem em painel modal com foco contido; carrinho é uma página ou painel completo, não uma faixa estreita.

### WF-03 — Inscrição em seletiva

```text
[Voltar às seletivas]
Seletiva Feminina — data, horário, local e prazo
[Aviso de finalidade e privacidade]

Nome completo*          [________________________]
Data de nascimento*     [____/____/________]
Telefone*               [________________________]
E-mail                  [________________________]
Posição                 [selecionar]
Experiência/observações [________________________]

[Revisar dados]  ->  Resumo + aceite aplicável  ->  [Enviar inscrição]
```

O envio confirma recebimento, não aprovação. Se o período encerrar durante o preenchimento, a entrada é preservada localmente quando seguro e o motivo é informado.

### WF-04 — Área do atleta

```text
[Menu] Minha área                                     [Notificações] [Perfil]
----------------------------------------------------------------------------
| Próxima pendência | Mensalidade atual | Último pedido | Inscrição         |
----------------------------------------------------------------------------
| Atalhos: Dados do atleta · Mensalidades · Pagamentos · Pedidos            |
----------------------------------------------------------------------------
| Linha do tempo de atualizações próprias                                   |
```

No mobile, pendências acionáveis aparecem antes do histórico.

### WF-05 — Dashboard administrativo

```text
[Sidebar por grupos] Dashboard                  [Período] [Equipe] [Conta]
----------------------------------------------------------------------------
| Atletas ativos | Mensalidades abertas | Inscrições novas | Vendas do mês |
----------------------------------------------------------------------------
| Pendências prioritárias: pagamentos, estoque, remessas, moderação         |
----------------------------------------------------------------------------
| Gráficos/tabelas com link "Ver origem"                                    |
----------------------------------------------------------------------------
| Atividade sensível recente (somente com permissão)                        |
```

Cada indicador exibe definição, período e atualização. Cards não substituem relatórios conciliáveis.

### WF-06 — Caixa Fênix

```text
[Financeiro > Caixa Fênix]
[Conta] [Período] [Categoria] [Origem] [Status]              [Aplicar]
----------------------------------------------------------------------------
| Saldo derivado | Entradas | Saídas | Pendências | Diferença não conciliada |
----------------------------------------------------------------------------
[Nova entrada] [Nova saída] [Transferir] [Conciliar] [Fechar] [Exportar]
----------------------------------------------------------------------------
Data | Tipo | Categoria | Descrição | Origem | Valor/Moeda | Anexo | Estado
----------------------------------------------------------------------------
```

Confirmação financeira mostra conta, valor, moeda, origem e período. Cancelar/estornar nunca usa a mesma ação visual de editar um rascunho.

### WF-07 — Remessa

```text
[Loja > Remessas > Uniforme 2026]                         [Estado: ENCERRADA]
Vendas: início → encerramento | mínimo/máximo | previsão | fornecedor
----------------------------------------------------------------------------
Rascunho -- Aberta -- Encerrada -- Encomendada -- Produção -- Recebida -- Final
----------------------------------------------------------------------------
| Consolidação: tamanho/cor/quantidade | pedidos | pagamentos | divergências |
----------------------------------------------------------------------------
[Gerar relatório] [Registrar envio] [Registrar chegada] [Notificar] [Retirada]
```

Ações habilitam somente com pré-condições satisfeitas e exibem o impacto em compradores/reembolsos.

### WF-08 — Fórum e notícias

```text
[Comunicação] [Notícias] [Eventos] [Fórum]
---------------------------------------------------------------
| Destaque oficial: título, data/local, resumo, abrir           |
---------------------------------------------------------------
Categorias | Tópicos recentes | Fixados | Comunicados
---------------------------------------------------------------
Tópico: título | autor | categoria | respostas | estado
[Criar tópico, se permitido]
```

Comunicado oficial e conteúdo da comunidade recebem rótulos distintos. Denunciar não publica a denúncia.

### WF-09 — Parceiros e agendamento

```text
[Parceiros] > [Profissional]
Nome · profissão · parceiro aprovado · serviços publicados
------------------------------------------------------------
Serviço      Duração      Valor      [Ver disponibilidade]
------------------------------------------------------------
Datas disponíveis -> horários -> resumo -> [Solicitar]
Estado após envio: SOLICITADO (ainda não confirmado)
```

Não existe campo de sintomas, diagnóstico ou prontuário.

### WF-10 — Configurações e logos

```text
[Configurações]
[Institucional] [Contatos] [Identidade] [Financeiro] [Termos] [Notificações]
----------------------------------------------------------------------------
Campos da seção                          | Pré-visualização
                                        | Cabeçalho
Logo: oficial/masc./fem./diretoria       | Card de notícia
Cores/tokens (quando aprovados)          | Produto/rodapé
----------------------------------------------------------------------------
[Descartar] [Salvar rascunho, se houver] [Publicar alteração]
```

Campos públicos e privados são separados e rotulados; uma alteração de PIX/dados bancários nunca é publicada por herança do bloco institucional.

## Acessibilidade verificável

- ordem de foco segue a ordem visual e não fica presa fora de diálogos;
- “pular para conteúdo” e regiões semânticas em páginas longas;
- alvos de toque adequados e sem ações dependentes de hover;
- zoom/reflow sem perda de conteúdo ou ação;
- texto alternativo descreve a função da imagem; logos têm nome da marca/contexto;
- gráficos possuem tabela/resumo equivalente;
- erros e atualizações de status são anunciados por tecnologia assistiva;
- vídeos futuros têm legenda e controles;
- preferência de redução de movimento é respeitada;
- contraste é validado após a decisão final da paleta.

## Decisões de UX provisórias

- número máximo de etapas e campos por jornada;
- comportamento exato do carrinho de visitante e sua expiração;
- checkout, retirada/entrega e métodos de pagamento;
- edição direta de dados pelo atleta versus solicitação à diretoria;
- visualização do responsável por menor;
- calendário versus lista como padrão;
- notificações por canal e preferências;
- política de rascunho/aprovação editorial;
- rota própria ou seção para contato e política de leitura pública do fórum;
- densidade das tabelas e valores-alvo de breakpoints;
- paleta e tipografia canônicas.

Essas decisões devem ser testadas em protótipo antes do layout final.
