# Identidade visual

## Diretriz central

A interface deve representar a identidade própria do Fênix por vermelho, preto e branco. A identidade verde/amarela da parceria Floresta é contextual e temporária: não pode ser usada como marca permanente, paleta principal ou substituta do Fênix.

## Ativo analisado

Arquivo disponível: `referencias/logos/logo_fenix.png`.

| Propriedade observada | Resultado |
|---|---|
| Formato | PNG |
| Dimensões | 640 × 640 px |
| Canal | 32 bits ARGB, com transparência |
| Composição | Símbolo estilizado de uma fênix/chama vermelha, com linhas internas brancas |
| Palavra/marca textual | Não há wordmark no arquivo observado |
| Alteração realizada | Nenhuma |

A inspeção é técnica/visual e não substitui um manual de marca. Não se deve recortar, redesenhar, recolorir, deformar ou sobrescrever o arquivo original.

## Contextos de logo previstos

| Contexto | Uso | Estado do ativo |
|---|---|---|
| Oficial/principal | Cabeçalho, página inicial, documentos institucionais | Há um símbolo de referência; aprovação de uso e versão final ainda necessária |
| Masculino | Página/equipe masculina | Contexto exigido; arquivo específico não localizado nesta análise |
| Feminino | Página/equipe feminina | Contexto exigido; arquivo específico não localizado nesta análise |
| Diretoria | Painel/documentos administrativos | Contexto exigido; arquivo específico não localizado nesta análise |
| Favicon | Navegador/atalho | Deve ser derivado apenas após aprovação de variante; não gerar nesta fase |
| Capa | Hero/notícia/área institucional | Imagem configurável, distinta de logo |
| Parceria Floresta | Conteúdo da parceria | Somente em contexto identificado, nunca como identidade principal |

## Regras de aplicação do logo

- preservar proporção e transparência;
- não aplicar sombra, contorno, gradiente ou rotação sem manual aprovado;
- não colocar sobre fundo que apague as linhas brancas ou o contorno vermelho;
- oferecer variante adequada ao fundo quando um ativo oficial correspondente existir;
- manter área de respiro; a medida exata depende de manual/aprovação e não deve ser inventada;
- definir tamanho mínimo após testes reais de legibilidade;
- usar texto alternativo funcional, por exemplo “Fênix Vôlei”, sem descrever decoração redundante;
- não usar logo como único texto de link se o nome acessível não estiver disponível;
- manter histórico e contexto ao trocar o ativo no painel.

## Divergência de paleta

As fontes apresentam duas paletas. Nenhuma deve ser descartada silenciosamente.

### Conjunto A — documento-base

| Token original | Valor | Uso indicado |
|---|---:|---|
| `--color-primary-red` | `#B80012` | Ações principais e destaques |
| `--color-dark-red` | `#7A000A` | Hover/variação escura |
| `--color-black` | `#121212` | Texto/sidebar/rodapé |
| `--color-white` | `#FFFFFF` | Fundo e texto em contraste |
| `--color-gray-bg` | `#F7F7F7` | Fundo administrativo |
| `--color-gray-line` | `#D9D9D9` | Bordas/divisórias |
| `--color-success` | `#16A34A` | Sucesso/pago/ativo |
| `--color-warning` | `#F2C94C` | Pendente/atenção |
| `--color-danger` | `#DC2626` | Erro/atraso/ação destrutiva |
| `--color-info` | `#2563EB` | Informação/consulta |
| `--color-muted` | `#6B7280` | Conteúdo secundário |
| `--color-accent-gold` | `#F2C94C` | Destaque opcional |

### Conjunto B — briefing

| Papel | Valor |
|---|---:|
| Vermelho Fênix | `#C8102E` |
| Vermelho escuro | `#8F001A` |
| Preto | `#111111` |
| Branco | `#FFFFFF` |
| Cinza claro | `#F4F4F5` |
| Cinza médio | `#71717A` |
| Cinza escuro | `#27272A` |
| Dourado opcional | `#D4AF37` |

### Tratamento provisório

O briefing é posterior e solicita explicitamente o conjunto B; por isso ele é a **recomendação provisória para protótipos**, enquanto o conjunto A permanece a referência original. Layout final e tokens de produção exigem aprovação expressa. Contraste deve ser testado para cada combinação, não inferido apenas pelo valor hexadecimal.

## Tokens semânticos provisórios

Os nomes abaixo são estáveis como contrato semântico; os valores primários continuam provisórios:

| Token | Valor provisório | Uso |
|---|---:|---|
| `--color-primary` | `#C8102E` | Ação/destaque principal |
| `--color-primary-dark` | `#8F001A` | Estado forte/hover quando o contraste permitir |
| `--color-background` | `#F4F4F5` | Fundo geral |
| `--color-surface` | `#FFFFFF` | Superfícies/cards |
| `--color-text` | `#111111` | Texto principal |
| `--color-text-subtle` | `#27272A` | Texto secundário de alto contraste |
| `--color-text-muted` | `#71717A` | Texto auxiliar, somente em tamanho/fundo aprovados |
| `--color-border` | A validar entre `#D9D9D9` e derivação acessível | Bordas/divisórias |
| `--color-success` | `#16A34A` | Sucesso |
| `--color-warning` | `#F2C94C` | Atenção |
| `--color-danger` | `#DC2626` | Erro/perigo |
| `--color-info` | `#2563EB` | Informação |
| `--color-accent` | `#D4AF37` | Destaque opcional, não texto pequeno sem contraste testado |
| `--color-focus` | A definir por contraste | Indicador de foco |

Não usar o mesmo token vermelho para “marca” e “erro” sem distinção semântica. Em componentes, consumir tokens pelo papel (`primary`, `danger`) e não por nomes físicos como `red-500`.

## Tipografia

O documento-base sugere Inter, Montserrat ou Arial. Até aprovação:

- **recomendação provisória:** Inter para interface e texto;
- Montserrat pode ser avaliada em títulos institucionais;
- Arial/sans-serif é fallback, não segunda identidade;
- uma única família variável reduz carga se licenciamento e suporte forem validados.

Regras:

- corpo com tamanho/altura de linha legíveis e zoom sem quebra;
- hierarquia por escala e peso, não apenas caixa alta/cor;
- evitar texto longo todo em maiúsculas;
- números financeiros com alinhamento consistente e moeda explícita;
- não bloquear renderização se a fonte externa falhar.

Escala, pesos e licenciamento ainda são provisórios.

## Componentes visuais

| Componente | Padrão |
|---|---|
| Botão primário | Fundo primário, texto de contraste validado, foco visível, rótulo de ação |
| Botão secundário | Superfície com borda/texto primário, sem depender de borda fina para foco |
| Botão perigoso | Token `danger`, confirmação contextual e ícone/texto; não reutilizar primário |
| Card | Superfície branca/cinza, borda ou sombra leve; hierarquia previsível |
| Tabela administrativa | Cabeçalho contrastante, linhas legíveis, ação no fim, alternativa em cartões mobile |
| Campo | Rótulo sempre visível, ajuda/erro associado e estados de foco/erro/desabilitado |
| Status | Texto + ícone/forma + cor; mesma categoria mantém semântica em todo o sistema |
| Alerta | Título, mensagem e ação; região anunciável conforme urgência |
| Link | Aparência distinguível sem depender exclusivamente de cor |

## Estados interativos

Todo componente acionável precisa de:

- repouso;
- hover, quando houver apontador;
- foco por teclado, sempre visível;
- ativo/pressionado;
- carregando, com prevenção de duplicidade;
- desabilitado com motivo acessível quando necessário;
- sucesso, aviso e erro quando aplicáveis.

Hover não pode revelar a única forma de acessar conteúdo. Foco não deve ser removido por CSS.

## Iconografia e imagens

- usar um conjunto consistente e licenciado;
- ícone sem texto precisa de nome acessível;
- ícones de status acompanham rótulo;
- fotos de atletas, menores ou público exigem finalidade, autorização/base legal e retenção avaliadas;
- mídia de produto/notícia precisa de texto alternativo ou marcação decorativa correta;
- servir dimensões adequadas ao viewport e evitar deslocamento de layout;
- não embutir dado privado em nome público de arquivo, metadados ou texto alternativo.

## Acessibilidade e contraste

- validar contraste de texto, ícone, borda essencial e foco em todas as combinações;
- não colocar branco/vermelho, dourado/branco ou cinza/fundo em produção sem medição;
- manter legibilidade em alto contraste, zoom e preferência de redução de movimento;
- status nunca depende apenas de verde/amarelo/vermelho;
- gráficos usam padrões/rótulos e alternativa tabular;
- testar modo claro primeiro; modo escuro não é requisito vigente.

## Governança da marca

1. Ativos entram por upload protegido e ficam associados a contexto.
2. A troca não sobrescreve o arquivo anterior sem histórico.
3. Pré-visualização cobre cabeçalho, produto, notícia e rodapé.
4. Publicação exige permissão `logos.manage` ou equivalente.
5. Auditoria registra autor, instante e contexto.
6. O sistema não altera o bitmap original.

## Critérios de aceite visual

- paleta e tipografia receberam aprovação registrada;
- contraste foi medido nos componentes reais;
- logo não está distorcido, recortado ou sobre fundo inadequado;
- páginas são consistentes nos viewports suportados;
- todos os estados interativos existem;
- status possui rótulo não cromático;
- navegação por teclado/foco funciona;
- nenhuma identidade de parceria substitui a marca Fênix;
- tokens, e não valores dispersos, controlam a aparência.

## Pendências provisórias

- escolha formal entre as duas paletas;
- arquivos oficiais de logo masculino, feminino e diretoria;
- variantes para fundo claro/escuro e monocromia;
- área de respiro e tamanho mínimo;
- família, pesos e escala tipográfica;
- token de foco e borda após teste;
- política de uso de fotografias e direito de imagem;
- necessidade futura de modo escuro.

