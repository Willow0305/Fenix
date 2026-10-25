# 29 — Correção de telas

- **Versão:** 1.0
- **Data:** 2026-10-25
- **Origem:** revisão das telas feita pelo responsável do projeto em 2026-10-25, com diagnóstico no código do branch `dev` (commit `23fb30f`).
- **Situação:** registro aberto. Nenhuma correção deste documento foi implementada ainda.

Este documento tem duas partes:

1. **Padrão de correção** (seções 1 a 4): como toda correção de tela é registrada, classificada, feita e aceita, e quais regras de interface valem para o sistema inteiro.
2. **Registro de correções** (seções 5 a 7): cada problema encontrado, com evidência, correção proposta e critério de aceite.

Ele complementa [11-UX-UI](./11-UX-UI.md) e [12-IDENTIDADE-VISUAL](./12-IDENTIDADE-VISUAL.md). Em caso de conflito, prevalecem `AGENTS.md`, os requisitos (`02`) e as regras de negócio (`04`). Itens que mudam regra de negócio ou criam funcionalidade nova só são implementados depois da decisão registrada em [`PENDENCIAS.md`](../PENDENCIAS.md).

---

## 1. Ciclo de uma correção

Toda correção de tela segue estas etapas, nesta ordem.

| Etapa | O que fazer | Registro |
|---|---|---|
| 1. Registrar | Criar uma entrada `COR-NNN` na seção 6, com tela, problema observado e quem relatou. | este documento |
| 2. Diagnosticar | Encontrar a causa no código ou nos dados. Citar arquivo e linha. Separar sintoma de causa (ver `COR-001`: o sintoma era "time inativo no site"; a causa eram dados de teste). | este documento |
| 3. Classificar | Definir tipo e prioridade (seção 2). Se for regra de negócio ou funcionalidade nova, abrir `PEN-NNN`. | este documento + `PENDENCIAS.md` |
| 4. Aguardar decisão | Somente para os tipos *Regra de negócio* e *Nova funcionalidade*. A correção fica em "Aguardando decisão" até o responsável aprovar. | `PENDENCIAS.md` |
| 5. Corrigir | Implementar seguindo os padrões da seção 3. Regra no domínio/servidor, nunca só na tela. | código + testes |
| 6. Verificar | Passar pela lista de verificação da seção 4 e pelos comandos oficiais do `README.md` (lint, testes, build). | descrição do commit |
| 7. Encerrar | Mudar a situação para "Concluída", citar o commit e registrar no `CHANGELOG.md`. Mudança de arquitetura ou de regra também vai para `17-DECISOES-TECNICAS.md`. | este documento + `CHANGELOG.md` |

**Situações possíveis:** Aberta · Aguardando decisão · Em correção · Em verificação · Concluída · Recusada (com motivo).

## 2. Classificação

### 2.1 Tipo

| Tipo | Quando usar | Precisa de decisão? |
|---|---|---|
| Defeito | A tela faz algo diferente do que está especificado. | Não |
| Inconsistência | Duas telas tratam o mesmo dado de formas diferentes. | Não, se a regra já existe |
| Padronização | Aplicar um padrão da seção 3 a uma tela que ainda não o segue. | Não |
| Melhoria de usabilidade | O comportamento está correto, mas é difícil de usar ou entender. | Não |
| Regra de negócio | Muda o que o sistema aceita, calcula ou permite. | **Sim** |
| Nova funcionalidade | Exige campo, tabela, endpoint ou tela que não existe. | **Sim** |
| Dados/ambiente | O problema vem dos dados ou da configuração, não do código da tela. | Não |

### 2.2 Prioridade

| Prioridade | Critério |
|---|---|
| P0 | Expõe dado pessoal, gera valor financeiro errado ou impede uma operação essencial. Corrigir antes de qualquer outra coisa. |
| P1 | Leva o usuário a erro operacional, mostra informação enganosa ao público ou quebra a tela no celular. |
| P2 | Dificulta o uso, mas existe um caminho para fazer a tarefa. |
| P3 | Acabamento visual ou de texto. |

## 3. Padrões de interface

Estes padrões valem para **todas** as telas, do site e do painel. Uma tela nova ou corrigida só é aceita se cumprir todos eles.

### 3.1 Limites de caracteres

**Regra:** cada campo de texto tem um limite único, e o mesmo número aparece em três lugares: na coluna do banco (`@db.VarChar`), no DTO da API (`@MaxLength`) e no campo da tela (`maxLength`). Hoje o banco e a API já têm limites, mas só 10 arquivos da interface usam `maxLength`. O usuário só descobre o limite depois de enviar o formulário.

**Comportamento na tela:**

- o campo não deixa digitar além do limite (`maxLength`);
- campos com limite de 200 caracteres ou mais mostram um contador `123/500` abaixo do campo, que fica em destaque a partir de 90%;
- a mensagem de erro do servidor continua existindo, para o caso de chamadas diretas à API;
- o texto colado também é cortado no limite, e a tela avisa que o texto foi cortado.

**Limites padrão** (já usados no banco e nos DTOs; a coluna "Tela" é o que deve ser aplicado):

| Tipo de campo | Limite | Exemplos |
|---|---|---|
| Nome de pessoa | 160 | nome completo, responsável, contato de emergência, cliente do pedido, contato do parceiro |
| Apelido / nome curto | 120 | apelido do atleta, nome de equipe, plano, categoria, marca |
| Título | 160 ou 180 | seletiva e produto: 160 · notícia e evento: 180 |
| Razão social | 180 | parceiro |
| E-mail | 180 | todos |
| Posição | 80 | atleta, interessado, inscrição |
| Local | 180 | evento; seletiva aceita 220 |
| URL | 300 | site do parceiro |
| Resumo / chamada | 500 | resumo da notícia |
| Motivo | 1000 | mudança de status, cancelamento, estorno, recusa |
| Descrição | 2000 | equipe, plano, parceiro, evento, seletiva |
| Observações internas | 4000 | atleta, interessado, pedido |
| Conteúdo longo | 50 000 | corpo da notícia |
| CPF | 14 com máscara | ver 3.2 |
| Telefone | 15 com máscara | ver 3.3 |

Campos do tipo `Text` no banco sem `@MaxLength` no DTO devem receber o limite desta tabela.

**Implementação:** os limites devem ficar em um só lugar, no pacote compartilhado `packages/validation` (hoje quase vazio), e ser importados pela API e pela interface. O componente `TextField`/`TextArea` de `apps/web/components/ui.tsx` passa a aceitar `maxLength` e exibir o contador. Isso é mudança de arquitetura e precisa de registro em `17-DECISOES-TECNICAS.md`.

### 3.2 CPF

Decisão do responsável em 2026-10-25: o campo de documento de pessoa física passa a aceitar **somente CPF**. RG não é mais aceito.

| Item | Padrão |
|---|---|
| Rótulo | `CPF` (hoje é "Documento (RG/CPF)", em `apps/web/components/athlete-form.tsx:116`) |
| Máscara | `000.000.000-00`, aplicada enquanto a pessoa digita |
| Teclado no celular | numérico (`inputMode="numeric"`, `autoComplete="off"`) |
| Validação | 11 dígitos, dígitos verificadores corretos e recusa de sequências repetidas (`111.111.111-11`). A mesma função valida no navegador e na API. |
| Mensagem de erro | "CPF inválido. Confira os números." |
| Armazenamento | Só os 11 dígitos, cifrados como hoje (AES-256-GCM) e com hash para detectar duplicidade (`normalizeDocument` em `sports-rules.ts`). Pontos e traço não vão para o banco. |
| Exibição | Mascarada, como hoje (`documentNumberMasked`), por exemplo `***.456.789-**`. Nunca aparece completo em listas, logs ou exportações. |
| Obrigatoriedade | Continua opcional até decisão (`PEN-056`). |

Os registros já gravados com RG não podem ser apagados nem convertidos automaticamente. A correção inclui um levantamento de quantos documentos atuais não passam na validação de CPF; esses atletas ficam marcados para revisão pela diretoria. Ver `PEN-056`.

Para parceiros (CPF ou CNPJ), vale o mesmo princípio: CNPJ com máscara `00.000.000/0000-00` e validação dos dígitos.

### 3.3 Telefone

Decisão do responsável em 2026-10-25: o padrão é **`(00) 00000-0000`**.

| Item | Padrão |
|---|---|
| Máscara | `(00) 00000-0000`, aplicada enquanto a pessoa digita |
| Teclado no celular | telefone (`type="tel"`, `inputMode="tel"`, `autoComplete="tel-national"`) |
| Validação | DDD de 11 a 99, sem zero inicial; número de 9 dígitos começando por 9. A mesma regra na tela e na API (hoje a API aceita qualquer texto de 8 a 30 caracteres com números, espaço, `+`, `(`, `)` e `-`). |
| Mensagem de erro | "Telefone inválido. Use DDD + número, por exemplo (68) 99999-0000." |
| Armazenamento | Só os 11 dígitos. A máscara é aplicada na exibição. |
| Exibição | Sempre formatado, `(68) 99999-0000`. |

Onde aplicar: telefone, telefone do responsável e telefone de emergência do atleta; interessado; inscrição em seletiva; cadastro de conta; minha conta; pedido da loja; parceiro e profissional; contato do time em Configurações.

Telefones já gravados em outro formato devem ser normalizados por migração de dados, sem perder o valor original quando não for possível converter. Telefone fixo (10 dígitos) depende de `PEN-057`.

### 3.4 Textos longos

**Regra:** nenhum texto digitado por usuário pode alargar a página, sair do cartão ou empurrar botões para fora da tela. Teste sempre com uma palavra de 60 caracteres sem espaço e com um texto de tamanho máximo do campo.

Hoje o CSS global (`apps/web/app/globals.scss`) não define quebra de palavras, e o painel tem só um ponto de quebra de layout (900 px).

| Situação | Padrão |
|---|---|
| Qualquer texto vindo do usuário (nomes, títulos, descrições, e-mails, URLs) | `overflow-wrap: anywhere` no elemento. Regra global para `.card`, `.prose`, células de tabela e `h1`–`h3`. |
| Filhos de `flex` e `grid` que contêm texto | `min-width: 0`, para o texto quebrar em vez de esticar a coluna. Aplicar em `.row > *` e `.stack > *`. |
| Títulos em cartões e listas | Até 2 linhas com reticências (`line-clamp: 2`) e o texto completo no atributo `title`. Na página de detalhe, o título aparece inteiro. |
| Resumos em cartões | Até 3 linhas com reticências. |
| Selos (`badge`) | Não quebram linha (`white-space: nowrap`), mas têm largura máxima e reticências. |
| Tabelas | Sempre dentro de `.table-wrap` com rolagem horizontal própria. A página em si nunca rola para o lado. |
| E-mails e URLs longos | Quebram em qualquer ponto (`overflow-wrap: anywhere`). |
| Títulos de página | `text-wrap: balance`. |

### 3.5 Celular

O site e o painel serão usados no celular. Toda tela é verificada nas larguras da seção 4.

| Item | Padrão |
|---|---|
| Larguras de referência | 360 px (celular pequeno), 390 px (celular comum), 768 px (tablet), 1280 px (computador) |
| Rolagem horizontal | Proibida na página. Só tabelas e blocos de código rolam para o lado, dentro do próprio contêiner. |
| Margem lateral | Mínimo de 16 px em qualquer largura. |
| Área de toque | Botões, links de ação e caixas de seleção com no mínimo 44 × 44 px. |
| Tamanho da fonte em campos | Mínimo de 16 px, para o iPhone não aplicar zoom ao focar. |
| Formulários | Uma coluna abaixo de 768 px. Rótulo sempre acima do campo. |
| Botões de ação | Abaixo de 768 px, ocupam a largura toda e ficam no fim do formulário. Ação destrutiva nunca fica ao lado da ação principal sem espaço entre elas. |
| Filtros | Abaixo de 768 px, ficam recolhidos num botão "Filtros (n)", em que n é a quantidade de filtros ativos. |
| Tabelas do painel | Abaixo de 768 px, viram lista de cartões (nome em destaque, situação como selo e os demais dados em pares rótulo/valor). Tabelas financeiras com muitas colunas podem manter a rolagem horizontal, com a primeira coluna fixa. |
| Diálogos | Abaixo de 768 px, ocupam a tela toda, com o botão de confirmar visível sem rolar. |
| Imagens | `max-width: 100%` e proporção fixa (`aspect-ratio`), para a página não "pular" ao carregar. |

### 3.6 Imagens e imagem padrão

**Regra:** todo lugar que exibe imagem reserva o espaço dela, com proporção fixa. Quando não existe imagem, aparece a **imagem padrão do Fênix**: a logo oficial centralizada sobre um fundo da cor da marca. Nunca fica um espaço vazio, nem um texto solto como o "FÊNIX" usado hoje no cartão de produto.

| Onde | Proporção | Imagem padrão |
|---|---|---|
| Notícia (cartão e topo da página) | 16:9 | logo Fênix |
| Evento e partida | 16:9 | capa da notícia vinculada, se houver; senão, logo Fênix |
| Produto | 1:1 | logo Fênix |
| Capa do parceiro | 16:9 | logo do parceiro sobre fundo neutro; senão, logo Fênix |
| Logo do parceiro | 1:1, `object-fit: contain` | iniciais do parceiro em círculo |

- Um único componente (`MediaImage`, em `apps/web/components`) cuida da proporção, do carregamento tardio (`loading="lazy"`), do texto alternativo e da imagem padrão. Nenhuma tela monta `<img>` diretamente.
- A logo usada é a configurada em Configurações (`brandAssets.OFFICIAL`), com `apps/web/public/brand/logo-fenix.png` como reserva.
- Texto alternativo: imagem que só ilustra recebe `alt=""`; logo recebe "Logo de {nome}"; produto recebe o texto alternativo cadastrado ou o nome do produto.
- O envio de imagem segue as regras de upload do `AGENTS.md`: tamanho, tipo real do arquivo, extensão e permissão conferidos no servidor.

### 3.7 Selos sobre imagens

Para identificar produtos de parceiros e situações especiais, os selos sobre imagens têm lugar fixo:

| Canto | Conteúdo |
|---|---|
| Superior esquerdo | Logo pequena do parceiro (28 px no celular, 32 px no computador), em círculo branco com borda fina. Só em produtos de parceiro. |
| Superior direito | Situação que impede a compra ("Indisponível", "Esgotado"). |
| Inferior esquerdo | Tipo de venda ("Pré-venda", "Promoção"). |

Hoje o selo "Pré-venda" fica no canto superior esquerdo (`product-card.module.scss:39`) e precisa ir para o inferior esquerdo quando o selo do parceiro existir.

### 3.8 Filtros e buscas

| Item | Padrão |
|---|---|
| Limpar filtros | Botão "Limpar filtros" visível sempre que houver algum filtro ou busca ativa. Volta todos os campos ao padrão e à página 1. |
| Endereço da página | Os filtros ficam no endereço (`?status=ACTIVE&equipe=...`), para que o link possa ser compartilhado e o botão Voltar funcione. |
| Contagem | Mostrar "n resultados" acima da lista. |
| Lista vazia | Diferenciar "nenhum cadastro ainda" de "nenhum resultado para os filtros", com o botão "Limpar filtros" no segundo caso. |
| Aplicação | Seleções aplicam na hora; o campo de busca aplica ao enviar ou depois de 400 ms sem digitar. |

### 3.9 Registros ativos e inativos em listas de seleção

| Uso da lista | Padrão |
|---|---|
| Para **criar ou vincular** algo (vínculo de atleta, equipe da partida, público de comunicado, equipe da seletiva, plano do atleta) | Só registros ativos. O servidor também recusa registro inativo. |
| Para **filtrar ou consultar** (filtros de Atletas, Mensalidades, relatórios) | Ativos primeiro; inativos depois, com o sufixo "(inativa)" ou "(inativo)". |
| Ao **editar** um registro que já aponta para um item inativo | O item atual aparece, com o sufixo, para não ser apagado sem querer ao salvar. |

### 3.10 Ações que mudam situação

- Toda ação que inativa, cancela, suspende, recusa ou estorna pede confirmação num diálogo que diz o efeito em uma frase.
- Quando a ação afeta outras telas, o diálogo diz quais ("A equipe some do site e não recebe novos atletas. Os 12 vínculos atuais continuam.").
- O motivo é obrigatório quando a regra de negócio exige. A ação destrutiva usa o estilo de perigo.

## 4. Lista de verificação

Antes de mudar uma correção para "Concluída", conferir:

- [ ] A tela funciona em 360 px, 390 px, 768 px e 1280 px, sem rolagem horizontal da página.
- [ ] Um texto de tamanho máximo e uma palavra de 60 caracteres sem espaço não quebram o layout.
- [ ] Todos os campos têm `maxLength` igual ao do DTO e do banco.
- [ ] CPF e telefone usam máscara, teclado e validação dos padrões 3.2 e 3.3.
- [ ] Imagens têm proporção fixa e imagem padrão.
- [ ] A tela funciona só com teclado, e o foco fica visível.
- [ ] Botões que o perfil não pode usar não aparecem, e o servidor também recusa a ação.
- [ ] Mensagens de erro dizem o que aconteceu e como resolver.
- [ ] Testes automatizados cobrem a regra alterada (validação, permissão, transição de estado).
- [ ] Lint, testes e build passaram (`README.md`).
- [ ] `CHANGELOG.md` atualizado; `17-DECISOES-TECNICAS.md` atualizado se mudou arquitetura ou regra.

---

## 5. Resumo do registro

| ID | Tela | Problema | Tipo | Prioridade | Situação |
|---|---|---|---|---|---|
| COR-001 | Site e painel | Dados de testes automatizados aparecem como dados reais | Dados/ambiente | P1 | Aguardando decisão (`PEN-059`) |
| COR-002 | Todas | Campos sem limite de caracteres na tela | Padronização | P1 | Aberta |
| COR-003 | Formulários com documento | Aceita RG; sem máscara nem validação de CPF | Regra de negócio | P1 | Aguardando decisão (`PEN-056`) |
| COR-004 | Formulários com telefone | Telefone em texto livre, sem padrão | Padronização | P1 | Aguardando decisão (`PEN-057`) |
| COR-005 | Todas | Textos longos quebram o layout | Defeito | P1 | Aberta |
| COR-006 | Todas | Layout não preparado para celular | Padronização | P1 | Aberta |
| COR-007 | Site | Sem imagem padrão quando não há imagem | Padronização | P2 | Aberta |
| COR-008 | Painel | Equipes inativas em listas de seleção | Inconsistência | P1 | Aberta |
| COR-009 | Site · Times | Inativar equipe demora para refletir no site | Defeito | P3 | Aberta |
| COR-010 | Site · Notícias | Cartões sem imagem e sem padrão visual | Melhoria de usabilidade | P2 | Aberta |
| COR-011 | Site · Eventos | Eventos não têm imagem | Nova funcionalidade | P2 | Aguardando decisão (`PEN-058`) |
| COR-012 | Site · Loja | Pré-venda exibida como bloco fora do padrão | Melhoria de usabilidade | P1 | Aberta |
| COR-013 | Site · Parceiros | Parceiro sem imagem de capa; logo pequena e opcional | Nova funcionalidade | P2 | Aguardando decisão (`PEN-058`) |
| COR-014 | Site · Loja | Produto de parceiro sem logo do parceiro | Nova funcionalidade | P2 | Aguardando decisão (`PEN-058`) |
| COR-015 | Painel · Atletas | Sem "Limpar filtros"; filtros fora do endereço | Melhoria de usabilidade | P2 | Aberta |
| COR-016 | Painel · Novo atleta | Formulário sem limites, máscaras e CPF | Padronização | P1 | Depende de COR-002/003/004 |
| COR-017 | Painel · Equipes | Inativação sem confirmação; sem edição; contagem enganosa | Melhoria de usabilidade | P2 | Aberta |
| COR-018 | Painel · Detalhe do atleta | Inativar/suspender não trata mensalidades nem vínculos | Regra de negócio | P1 | Aguardando decisão (`PEN-060`) |
| COR-019 | Painel · Equipes | Faixa etária da categoria não é conferida | Regra de negócio | P3 | Aguardando decisão (`PEN-061`) |
| COR-020 | Painel · Interessados | Sem busca por nome | Melhoria de usabilidade | P3 | Aberta |

## 6. Registro detalhado

### COR-001 — Dados de testes automatizados aparecem como dados reais

- **Tela:** site (`/times`, `/loja`) e painel (Equipes, Produtos, Remessas e outras)
- **Relatado:** "times inativos continuam aparecendo em Times na área pública"; "Pré-venda: Remessa 50202 … Camisa jogo 93ef3"
- **Tipo / prioridade:** Dados/ambiente · P1
- **Diagnóstico:**
  - A página `/times` **não** mostra equipes inativas. Ela usa `/public/teams`, que filtra `isActive = true` (`apps/api/src/modules/sports/http/sports.controller.ts:85-88`). No banco local, as 6 equipes inativas não aparecem no site.
  - As equipes "Feminino 1792…" que aparecem no site estão **ativas**. São 10 equipes criadas pelo teste de integração `apps/api/test/phase2-sports.int-spec.ts:169` (`Feminino ${Date.now()}`).
  - "Remessa 50202" e "Camisa jogo 93ef3" também são dados de teste, criados por `apps/api/test/phase5-campaigns.int-spec.ts:42` e `:68`.
  - Causa: os testes de integração rodam contra o mesmo banco do ambiente de desenvolvimento (`DATABASE_URL`, `apps/api/jest.integration.config.cjs:3`) e não apagam o que criam. Cada execução deixa mais registros.
- **Correção proposta:**
  1. Testes de integração passam a usar um banco próprio (`DATABASE_URL_TEST`, banco `fenix_test`), recriado antes de cada execução. O teste se recusa a rodar se o banco de teste for o mesmo de desenvolvimento.
  2. Script único de limpeza do banco de desenvolvimento, que aplica exclusão lógica aos registros com padrão de teste. Registros financeiros confirmados não são apagados (`AGENTS.md`).
  3. Revisar a seção de execução do `README.md` e `docs/14-TESTES.md`.
- **Critério de aceite:** depois de rodar toda a suíte de testes, a quantidade de equipes, produtos e remessas no banco de desenvolvimento não muda.
- **Decisão necessária:** `PEN-059`.

### COR-002 — Campos sem limite de caracteres na tela

- **Tela:** todos os formulários
- **Tipo / prioridade:** Padronização · P1
- **Diagnóstico:** a API e o banco já têm limites (ex.: nome 160, e-mail 180, observações 4000), mas apenas 10 arquivos da interface usam `maxLength`. O usuário descobre o limite pelo erro do servidor, depois de preencher tudo.
- **Correção proposta:** aplicar o padrão 3.1. Limites centralizados em `packages/validation`; `TextField` e `TextArea` com `maxLength` e contador; revisão de todos os formulários do site e do painel; DTOs com `@MaxLength` em todos os campos `Text`.
- **Critério de aceite:** nenhum campo de texto aceita mais caracteres do que o DTO; teste automatizado compara os limites da interface com os do DTO.

### COR-003 — Documento aceita RG; sem máscara nem validação de CPF

- **Tela:** Novo atleta, Detalhe do atleta, Interessados (conversão), Detalhe da seletiva (criar atleta) — todos usam `AthleteForm`
- **Tipo / prioridade:** Regra de negócio · P1
- **Diagnóstico:** o campo se chama "Documento (RG/CPF)" (`apps/web/components/athlete-form.tsx:116`) e a API aceita qualquer texto de até 30 caracteres (`apps/api/src/modules/sports/http/sports.dto.ts:89-93`).
- **Correção proposta:** aplicar o padrão 3.2, com validação no domínio esportivo da API e na tela. Levantamento dos documentos atuais que não são CPF válido.
- **Critério de aceite:** a API recusa RG, CPF com dígito errado e sequência repetida; o CPF é gravado só com dígitos; a tela mostra a máscara; testes unitários da validação.
- **Registro obrigatório:** `CHANGELOG.md` e `17-DECISOES-TECNICAS.md`, porque muda o que o sistema aceita.
- **Decisão necessária:** `PEN-056`.

### COR-004 — Telefone em texto livre

- **Tela:** todos os formulários com telefone (lista no padrão 3.3)
- **Tipo / prioridade:** Padronização · P1
- **Diagnóstico:** a mesma expressão permissiva está repetida em três DTOs (`sports.dto.ts:32`, `partners.dto.ts:37`, `store.dto.ts:34`): aceita de 8 a 30 caracteres entre números, espaço, `+`, `(`, `)` e `-`. Não há máscara na tela.
- **Correção proposta:** aplicar o padrão 3.3. Uma só validação em `packages/validation`; migração para normalizar os telefones gravados.
- **Critério de aceite:** todos os formulários exibem `(00) 00000-0000`; a API recusa número sem DDD ou com DDD inválido; os telefones são gravados só com dígitos.
- **Decisão necessária:** `PEN-057` (telefone fixo).

### COR-005 — Textos longos quebram o layout

- **Tela:** todas, com mais risco em cartões (notícias, produtos, parceiros, interessados, inscrições) e tabelas do painel
- **Tipo / prioridade:** Defeito · P1
- **Diagnóstico:** `apps/web/app/globals.scss` não define `overflow-wrap` nem `min-width: 0` para filhos de `.row` e `.stack`. Um nome, e-mail ou título sem espaços estica o cartão e a página.
- **Correção proposta:** aplicar o padrão 3.4 no CSS global e conferir cada tela com os textos de teste.
- **Critério de aceite:** com uma palavra de 60 caracteres em nome, título, e-mail e descrição, nenhuma tela rola para o lado em 360 px.

### COR-006 — Layout não preparado para celular

- **Tela:** todas
- **Tipo / prioridade:** Padronização · P1
- **Diagnóstico:** existem só quatro pontos de quebra no projeto inteiro (página inicial 760 px, menu do painel 900 px, cabeçalho do site 1020 px e movimento reduzido). As tabelas do painel não têm versão para celular, e os formulários usam grade de várias colunas.
- **Correção proposta:** aplicar o padrão 3.5, começando pelas telas mais usadas no celular: site inteiro, Minha conta, Mensalidades (atleta), Atletas, Detalhe do atleta, Interessados, Seletivas.
- **Critério de aceite:** a lista de verificação da seção 4 passa nas quatro larguras para cada tela corrigida.

### COR-007 — Sem imagem padrão quando não há imagem

- **Tela:** Notícias, Eventos, Loja, Parceiros
- **Tipo / prioridade:** Padronização · P2
- **Diagnóstico:** notícia sem capa não mostra área de imagem (`apps/web/app/(site)/noticias/page.tsx:76-82`); produto sem foto mostra o texto "FÊNIX" (`apps/web/components/product-card.tsx:16-18`); parceiro sem logo não mostra nada (`apps/web/app/(site)/parceiros/page.tsx:33-41`).
- **Correção proposta:** criar o componente `MediaImage` (padrão 3.6) e usá-lo em todas as telas com imagem.
- **Critério de aceite:** cartões de uma mesma lista têm a mesma altura de imagem, com ou sem foto; sem foto aparece a logo do Fênix.

### COR-008 — Equipes inativas em listas de seleção

- **Tela:** Atletas (filtro), Eventos e partidas (equipe da partida), Notificações (comunicado por equipe), Seletivas (servidor)
- **Tipo / prioridade:** Inconsistência · P1
- **Diagnóstico:** a API do painel inclui equipes inativas por padrão (`sports.controller.ts:171-175`). Atletas, Eventos e Notificações pedem `/teams` sem filtro e mostram as inativas sem marcação. O servidor de eventos, comunicados e seletivas não confere se a equipe está ativa; só o vínculo de atleta confere (`athletes.service.ts:701-702`).
- **Correção proposta:** aplicar o padrão 3.9. Eventos, Notificações e Seletivas: só equipes ativas, com validação no servidor. Filtro de Atletas e de Mensalidades: ativas e inativas, com sufixo "(inativa)".
- **Critério de aceite:** a API recusa criar partida, comunicado ou seletiva com equipe inativa; os filtros identificam as inativas.

### COR-009 — Inativar equipe demora para refletir no site

- **Tela:** site · `/times`
- **Tipo / prioridade:** Defeito · P3
- **Diagnóstico:** as páginas públicas guardam a resposta da API por 60 segundos (`apps/web/lib/server-api.ts:9-13`). Logo depois de inativar, a equipe ainda pode aparecer por cerca de 1 a 2 minutos.
- **Correção proposta:** ao criar, alterar ou inativar equipe, notícia, evento, produto ou parceiro, avisar o site para atualizar aquela página na hora (revalidação por etiqueta). Até lá, informar na tela de Equipes: "O site pode levar até 1 minuto para atualizar."
- **Critério de aceite:** a equipe inativada some do site no próximo carregamento da página.

### COR-010 — Notícias: cartões sem imagem e sem padrão visual

- **Tela:** site · `/noticias` e `/noticias/[slug]`; página inicial
- **Tipo / prioridade:** Melhoria de usabilidade · P2
- **Diagnóstico:** o envio de capa já existe no painel (`apps/web/app/admin/noticias/[id]/page.tsx:102-110`, PNG, JPG ou WebP até 5 MB). Mas a lista só mostra a área de imagem quando há capa, e a página da notícia mostra a imagem sem proporção fixa.
- **Correção proposta:**
  - cartão com imagem 16:9 (capa ou imagem padrão), categoria e data, título em até 2 linhas e resumo em até 3;
  - primeira notícia da lista em destaque (imagem maior) no computador;
  - página da notícia com capa 16:9 no topo, título, data, categoria e texto com largura de leitura de cerca de 70 caracteres;
  - no painel, mostrar a proporção recomendada (1600 × 900 px) junto do campo de envio.
- **Critério de aceite:** todas as notícias têm imagem na lista; cartões com a mesma altura; padrão 3.4 nos títulos.

### COR-011 — Eventos não têm imagem

- **Tela:** site · `/eventos`; painel · Eventos e partidas
- **Tipo / prioridade:** Nova funcionalidade · P2
- **Diagnóstico:** o modelo `Event` não tem campo de imagem (`prisma/schema.prisma`, `model Event`). A página pública mostra só texto.
- **Correção proposta:**
  - **Sem mudar o banco (pode ser feito já):** cartão de evento no padrão visual das notícias, com a capa da notícia vinculada, se houver, ou a imagem padrão. Data em destaque (dia e mês), horário, local e, para partidas, "Fênix × Adversário" e placar.
  - **Com mudança no banco (depende de `PEN-058`):** campo de capa no evento (`coverMediaFileId`), com envio no painel nas mesmas regras da capa de notícia.
- **Critério de aceite:** todo evento aparece com imagem; partidas e eventos comuns se distinguem pelo cartão.

### COR-012 — Pré-venda exibida como bloco fora do padrão

- **Tela:** site · `/loja`
- **Relatado:** "a pré-venda deveria aparecer como um produto normal"
- **Tipo / prioridade:** Melhoria de usabilidade · P1
- **Diagnóstico:** a loja monta, acima da lista de produtos, um bloco por remessa com o título "Pré-venda: {nome}", a data limite e os produtos como botões de texto (`apps/web/app/(site)/loja/page.tsx:59-93`). Os mesmos produtos já aparecem na lista com o selo "Pré-venda" (`product-card.tsx:20`), então a informação aparece duas vezes. Os nomes do exemplo relatado são dados de teste (`COR-001`).
- **Correção proposta:**
  - retirar o bloco de remessas do topo da loja;
  - o produto em pré-venda aparece na lista como qualquer produto, com foto, nome e preço;
  - o selo fica no canto inferior esquerdo da imagem (padrão 3.7): "Pré-venda · até 20/10";
  - filtro "Pré-venda" junto das categorias, para quem quiser ver só esses produtos;
  - na página do produto, um quadro antes do botão de compra informa a data limite, a quantidade mínima de unidades pagas para a encomenda acontecer, o prazo de entrega previsto e a política de reembolso. Essas informações não podem sair da página do produto, porque a pessoa precisa conhecê-las antes de pagar.
- **Critério de aceite:** a loja não tem mais o bloco de remessas; o produto em pré-venda se distingue só pelo selo; as condições da pré-venda aparecem na página do produto antes do botão de compra.

### COR-013 — Parceiro sem imagem de capa; logo pequena e opcional

- **Tela:** site · `/parceiros` e `/parceiros/[id]`; painel · Parceiros
- **Relatado:** "parceiros deveriam ter uma imagem sua e sua logo, grande"
- **Tipo / prioridade:** Nova funcionalidade · P2
- **Diagnóstico:** o parceiro tem só a logo (`logoMediaFileId`), exibida a 96 × 96 px e só quando existe (`apps/web/app/(site)/parceiros/page.tsx:33-41`). Não existe imagem de capa.
- **Correção proposta:**
  - novo campo de capa do parceiro (16:9), enviado no painel;
  - cartão do parceiro com capa em cima e logo em círculo sobreposta à borda inferior da capa, nome, tipo e descrição em até 3 linhas;
  - página do parceiro com capa larga, logo grande, descrição, serviços e produtos do parceiro;
  - imagens padrão conforme o padrão 3.6.
- **Critério de aceite:** todos os parceiros aparecem com capa e logo (ou imagem padrão); cartões da mesma altura.
- **Decisão necessária:** `PEN-058`.

### COR-014 — Produto de parceiro sem logo do parceiro

- **Tela:** site · `/loja`, `/loja/[slug]`
- **Relatado:** "uma pequena nos produtos, tipo favicon, no canto superior esquerdo das imagens"
- **Tipo / prioridade:** Nova funcionalidade · P2
- **Diagnóstico:** o cartão mostra só o nome do parceiro em texto (`product-card.tsx:24-28`); a API não envia a logo do parceiro junto com o produto.
- **Correção proposta:** incluir a URL da logo do parceiro na resposta pública de produtos; exibir o selo no canto superior esquerdo (padrão 3.7), com o nome do parceiro no texto alternativo; mover o selo "Pré-venda" para o canto inferior esquerdo. O mesmo selo aparece nos serviços do parceiro.
- **Critério de aceite:** produtos de parceiro mostram a logo do parceiro sem cobrir o produto; produtos do Fênix não têm selo.
- **Decisão necessária:** `PEN-058`.

### COR-015 — Atletas: sem "Limpar filtros"

- **Tela:** painel · `/admin/atletas`
- **Tipo / prioridade:** Melhoria de usabilidade · P2
- **Diagnóstico:** há busca, status e equipe, mas não há como voltar tudo ao padrão de uma vez (`apps/web/app/admin/atletas/page.tsx:51-105`). Só o status é lido do endereço; busca, equipe e página se perdem ao voltar do detalhe do atleta.
- **Correção proposta:** aplicar o padrão 3.8 (botão "Limpar filtros", filtros no endereço, contagem de resultados, mensagem de lista vazia com botão). Aplicar o mesmo padrão em Mensalidades, Interessados, Seletivas, Pedidos, Caixa e Auditoria.
- **Critério de aceite:** voltar do detalhe do atleta mantém os filtros; "Limpar filtros" restaura a lista completa.

### COR-016 — Novo atleta: formulário sem limites, máscaras e CPF

- **Tela:** painel · `/admin/atletas/novo` (o mesmo formulário é usado na edição e nas conversões)
- **Tipo / prioridade:** Padronização · P1
- **Diagnóstico:** `apps/web/components/athlete-form.tsx` não usa `maxLength`, o documento aceita RG e os quatro campos de telefone não têm máscara.
- **Correção proposta:** aplicar COR-002, COR-003 e COR-004 neste formulário primeiro, por ser o de maior volume de dados pessoais. Organizar em blocos (Identificação, Contato, Responsável, Emergência, Observações); no celular, uma coluna; o bloco Responsável aparece em destaque quando a data de nascimento indica menor de 18 anos.
- **Critério de aceite:** lista de verificação da seção 4 completa para este formulário.

### COR-017 — Equipes: inativação sem confirmação, sem edição e contagem enganosa

- **Tela:** painel · `/admin/equipes`
- **Tipo / prioridade:** Melhoria de usabilidade · P2
- **Diagnóstico:**
  - "Inativar" muda na hora, sem confirmação e sem motivo (`apps/web/app/admin/equipes/page.tsx:61-64`);
  - não há como editar nome, tipo, categoria ou descrição pela tela, embora a API permita (`PATCH /teams/:id`);
  - a coluna "Atletas ativos" conta vínculos abertos, sem olhar o status do atleta: um atleta Inativo ou Suspenso entra na conta.
- **Correção proposta:** diálogo de confirmação com o efeito (padrão 3.10); botão "Editar" por equipe; renomear a coluna para "Vínculos atuais" ou contar só atletas com status Ativo (decidir na implementação e registrar).
- **Critério de aceite:** inativar pede confirmação e informa quantos vínculos continuam; a equipe pode ser editada pela tela; a coluna diz exatamente o que conta.

### COR-018 — Inativar ou suspender atleta não trata mensalidades nem vínculos

- **Tela:** painel · Detalhe do atleta
- **Tipo / prioridade:** Regra de negócio · P1
- **Diagnóstico:** mudar o status para Inativo ou Suspenso impede a geração de novas mensalidades, mas não cancela as que já estão em aberto, não encerra o plano e não encerra os vínculos com equipes (`athletes.service.ts:510-560`). A diretoria precisa fazer cada passo à mão, em telas diferentes.
- **Correção proposta:** depende de decisão. Recomendação: o diálogo de mudança de status mostra o que está pendente ("2 mensalidades em aberto, 1 plano vigente, 1 vínculo atual") e oferece, com caixas de seleção, cancelar as mensalidades futuras sem pagamento, encerrar o plano e encerrar os vínculos, tudo com o mesmo motivo e auditado.
- **Decisão necessária:** `PEN-060`.

### COR-019 — Faixa etária da categoria não é conferida

- **Tela:** painel · Equipes e Detalhe do atleta
- **Tipo / prioridade:** Regra de negócio · P3
- **Diagnóstico:** a categoria tem idade mínima e máxima, mas o vínculo de atleta não confere a idade.
- **Correção proposta:** recomendação de aviso, sem bloqueio: "Atleta com 19 anos fora da faixa da categoria Sub-17. Vincular mesmo assim?".
- **Decisão necessária:** `PEN-061`.

### COR-020 — Interessados: sem busca por nome

- **Tela:** painel · `/admin/interessados`
- **Tipo / prioridade:** Melhoria de usabilidade · P3
- **Diagnóstico:** só existe filtro de status (`apps/web/app/admin/interessados/page.tsx:46-62`).
- **Correção proposta:** busca por nome, e-mail ou telefone e padrão 3.8.
- **Critério de aceite:** é possível achar um interessado pelo nome.

## 7. Ordem recomendada de execução

1. **Base comum:** COR-001 (separar o banco de testes), COR-005 (CSS de textos longos) e o componente `MediaImage` de COR-007. Afetam todas as outras correções.
2. **Formulários:** COR-002, COR-003, COR-004 e COR-016, depois das decisões `PEN-056` e `PEN-057`.
3. **Site público:** COR-012 (loja), COR-010 (notícias), parte sem banco de COR-011 (eventos), COR-009.
4. **Painel:** COR-008, COR-015, COR-017, COR-020.
5. **Celular:** COR-006, tela por tela, na ordem de uso.
6. **Depois das decisões:** COR-011 (capa de evento), COR-013, COR-014, COR-018, COR-019.
