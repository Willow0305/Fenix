# Decisões pendentes do responsável

Este documento reúne o que **só o responsável do projeto pode decidir**, guardado para quando o sistema estiver sendo finalizado. Nada aqui bloqueia o desenvolvimento do protótipo. A maior parte precisa estar resolvida **antes de usar dados reais** de atletas, compradores e finanças.

Cada item traz o que precisa ser decidido, o que o sistema já faz hoje, a recomendação técnica e o código da pendência correspondente em `PENDENCIAS.md`. Ao decidir, basta informar a escolha ao desenvolvedor ou agente: a decisão é registrada em `PENDENCIAS.md` (seção "Resolvidas") e aplicada ao sistema.

**Decidido até agora:** MFA obrigatório para administrador e diretoria (`PEN-013`); backup diário de madrugada com até 1 dia fora do ar (`PEN-044`); hospedagem adiada (`PEN-042`).

## Índice

| # | Tema | Prioridade | Pendência |
|---:|---|---|---|
| 1 | Menores de idade (LGPD e ECA Digital) | antes de dados reais | `PEN-010` |
| 2 | Bases legais, retenção e direitos do titular | antes de dados reais | `PEN-011` |
| 3 | Canal de segurança e resposta a incidente | antes de dados reais | `PEN-014` |
| 4 | Política de cancelamento e reembolso da loja | antes de vender | `PEN-030` |
| 5 | Remessa que não atinge o mínimo | antes de vender | `PEN-032` |
| 6 | Contrato e regras dos parceiros | antes de ativar parceiros | `PEN-034`, `PEN-052` |
| 7 | Regras de convivência e moderação do fórum | antes de abrir o fórum | `PEN-039` |
| 8 | Conteúdo institucional, logos e textos legais | antes de publicar o site | `PEN-005`, `PEN-006` |
| 9 | Hospedagem, e-mail e arquivos | antes da homologação | `PEN-042`, `PEN-041`, `PEN-045` |
| 10 | Orçamento mensal | antes da homologação | `PEN-048` |
| 11 | Dados existentes (planilhas) | antes de começar a usar | `PEN-003` |
| 12 | Plano de contas do Caixa | antes de lançar dados reais | `PEN-020` |
| 13 | Ajustes de funcionamento | pode esperar | vários |

---

## 1. Menores de idade (LGPD e ECA Digital) — `PEN-010`

**O que diz a lei (orientação geral, não é parecer jurídico):**

- **LGPD, art. 14:**
  - todo tratamento de dados de crianças (até 12 anos incompletos) e adolescentes (12 a 17) deve atender ao melhor interesse deles;
  - para crianças, a regra clássica é o consentimento específico e destacado de pelo menos um dos pais ou responsável, com esforço razoável para confirmar que é mesmo o responsável. A ANPD (Enunciado 1/2023) admite outras bases legais, como contrato ou obrigação legal, desde que no melhor interesse;
  - não se pode exigir mais dados do que o necessário para a participação;
  - as informações devem ser claras e em linguagem acessível.
- **ECA Digital (Lei 15.211/2025, vigente desde março de 2026):**
  - alcança serviços digitais com acesso provável de crianças e adolescentes. Um site de clube com fórum, loja e área do atleta provavelmente entra;
  - exige proteção desde o desenho e configurações mais protetivas por padrão, mecanismos de verificação de idade e ferramentas de supervisão pelos pais;
  - restringe perfilamento e publicidade direcionada a menores.
  - **Os detalhes e o Decreto 12.880/2026 precisam ser conferidos por advogado.**

**Decidido em 01/11/2026 (`DT-088`, revê `DT-026`):** conta própria só para maiores de 18 anos
(opção A). O atleta menor continua cadastrado pela diretoria, e o responsável usa a conta dele;
sem conta, menor não participa do fórum. Conta não pode ser vinculada a atleta menor ou sem data
de nascimento. As perguntas ao advogado abaixo continuam valendo para os dados que a diretoria
cadastra. Análise em `35-ANALISE-JURIDICA.md`.

**O que o sistema fazia antes (`DT-026`):**

- conta própria só a partir de 12 anos, com declaração de idade;
- atleta menor de 18 exige nome e telefone do responsável;
- menor de 12 só é cadastrado pela diretoria, com registro de ciência do responsável;
- nenhum dado de saúde e nenhuma publicidade direcionada.

**Perguntas para o advogado:**

1. Qual base legal usar para cada dado de atleta menor (cadastro, mensalidade, equipe, fotos)?
2. Basta registrar a ciência do responsável, ou é preciso confirmar a identidade dele?
3. Menores podem participar do fórum? Com que restrições?
4. É obrigatório um painel para os pais acompanharem a conta do filho?
5. Por quanto tempo guardar dados de ex-atletas menores?

**Opções até ter o parecer:**

- **(a) Recomendada e escolhida em 01/11/2026:** contas só de adultos.
- **(b)** Manter a regra atual, assumindo o risco até o parecer.

## 2. Bases legais, retenção e direitos do titular — `PEN-011`

**O que decidir:**

- para cada finalidade (cadastro, mensalidade, loja, seletiva, fórum, parceiros), a base legal e por quanto tempo guardar os dados;
- como atender quem pede seus dados sem ter conta (e-mail, formulário) e o prazo de resposta.

**O que o sistema já faz:**

- o titular com conta baixa os próprios dados e pede exclusão em Minha conta;
- a exclusão anonimiza a conta e mantém pedidos, pagamentos e auditoria.

**Recomendação de prazos (confirmar com contador e advogado):**

| Dado | Prazo sugerido |
|---|---|
| Registros financeiros | 5 anos (prazo fiscal usual) |
| Interessados não convertidos | 12 meses |
| Inscrições de seletiva recusadas | 12 meses |
| Ex-atletas | dados mínimos por 5 anos |
| Logs técnicos | 6 meses |

## 3. Canal de segurança e resposta a incidente — `PEN-014`

**O que decidir:**

- um e-mail para receber alertas de segurança (ex.: `seguranca@dominio`);
- quem responde a um vazamento de dados;
- quem comunica a ANPD e os titulares, se necessário. A orientação vigente da ANPD fala em até 3 dias úteis para incidentes com risco relevante.

**Recomendação:** um e-mail dedicado e um responsável e um substituto nomeados. O passo a passo já está em `13-SEGURANCA-E-LGPD.md`.

**Decidido em 01/11/2026 — instruções para criar os e-mails** (sem custo, sem domínio próprio por enquanto):

1. Criar **duas contas gratuitas** (por exemplo, no Gmail), usadas **só pelo time**, nunca uma conta pessoal:
   - **contato do time** (ex.: `fenixvolei.contato@gmail.com`, se o nome estiver livre): atendimento, loja e e-mail público do site;
   - **privacidade e segurança** (ex.: `fenixvolei.privacidade@gmail.com`, se o nome estiver livre): pedidos de dados pessoais (LGPD) e avisos de incidente de segurança.
2. Em cada conta, **ligar a verificação em duas etapas** e cadastrar um telefone de recuperação do time.
3. Dar acesso à **presidente** e a **um substituto da diretoria**; até haver encarregado, a presidente responde pelo canal de privacidade.
4. **Ao trocar a presidência:** trocar a senha, revisar quem tem acesso e o telefone de recuperação.
5. Depois de criar, **informar os endereços** para configurar:
   - o de contato em **Configurações → E-mail público**;
   - o de privacidade na Política de Privacidade, no lugar de "[PREENCHER CANAL OFICIAL DE PRIVACIDADE]".
6. Quando houver CNPJ e orçamento, avaliar e-mail com domínio próprio (ex.: `privacidade@dominiodotime`).

## 4. Política de cancelamento e reembolso da loja — `PEN-030`

**O que decidir:**

- prazo para desistir da compra. Em compras online, o Código de Defesa do Consumidor garante 7 dias de arrependimento;
- o que fazer com produtos personalizados (nome e número na camisa);
- pedido pago e não retirado: prazo e destino;
- forma de devolução do dinheiro (PIX) e prazo.

**O que o sistema já faz:**

- cancela e estorna com registro vinculado no Caixa;
- devolve o produto ao estoque.

Falta só o **texto da política**, para publicar em Termos e no checkout.

## 5. Remessa que não atinge o mínimo — `PEN-032`

**Decidido em 01/11/2026:** devolução de **100% do valor pago**, sem opção de crédito na loja. A
página do produto em pré-venda já informa isso; em cada remessa, a diretoria informa só a forma e
o prazo da devolução.

**O que decidir:**

- forma e prazo da devolução em cada remessa (ex.: PIX em até 7 dias).

**O que o sistema já faz:**

- cobra antes da encomenda;
- se a remessa for cancelada, estorna todos os pedidos;
- exibe o campo "política" na página da pré-venda.

## 6. Contrato e regras dos parceiros — `PEN-034`, `PEN-052`

**O que decidir:**

- modelo de contrato (vigência, responsabilidade pela entrega e pelo atendimento, nota fiscal, proteção de dados);
- prazo de repasse (semanal, mensal);
- quando uma venda de parceiro já repassada é estornada, como o parceiro devolve o valor. Hoje é por ajuste manual no próximo repasse;
- regras de agendamento: antecedência mínima, cancelamento em cima da hora, falta, se haverá avaliações (`PEN-037`).

**O que o sistema já faz:**

- aprovação com vigência e comissão por item;
- repasse com aprovação e saída no Caixa;
- agenda sem conflito.

## 7. Regras de convivência e moderação do fórum — `PEN-039`

**O que decidir:**

- texto das regras (o que é proibido, consequências);
- prazo para analisar denúncias (sugestão: 48 h);
- se haverá recurso contra moderação;
- quem pode moderar além da diretoria.

**O que o sistema já faz:**

- três níveis de visibilidade e denúncias;
- moderação com motivo e histórico;
- limites contra spam.

## 8. Conteúdo institucional, logos e textos legais — `PEN-005`, `PEN-006`

**O que fornecer:**

- nome oficial, CNPJ (se houver), endereço, contatos e redes sociais;
- história aprovada do clube;
- logos oficiais (masculino, feminino, diretoria), de preferência em PNG com fundo transparente ou SVG;
- termos de uso, política de privacidade e instruções de retirada;
- chave PIX oficial.

Tudo isso é preenchido pelo próprio painel (Configurações), sem programação.

**Decidido em 01/11/2026 — instruções enquanto não houver CNPJ:**

1. **Quem responde pelo time:** a **presidente em exercício**, como pessoa física. Ela é a responsável (controladora) pelos dados pessoais enquanto não houver pessoa jurídica.
2. **A cada mudança de presidência** (eleição): atualizar o nome do responsável nos termos de uso e na política de privacidade (que gera uma versão nova para todos aceitarem) e transferir o acesso aos e-mails do time.
3. **Loja:** para vender pela internet, o Decreto 7.962/2013 exige mostrar em destaque nome, CPF ou CNPJ e endereço. Sem CNPJ, seriam o CPF e o endereço pessoais da presidente. **Recomendação: só abrir a loja ao público depois do CNPJ.**
4. **Contador:** confirmar com o contador como ficam as vendas e os recebimentos (PIX, cartão) feitos antes do CNPJ.
5. **LGPD:** o canal de privacidade é obrigatório desde já, com ou sem CNPJ (ver seção 3). O enquadramento como agente de pequeno porte deve ser confirmado pelo advogado quando houver pessoa jurídica.
6. **Quando o CNPJ sair:** informar nome oficial, CNPJ e endereço para preencher em Configurações e nos documentos, e trocar o responsável nos termos e na política.

Detalhes e fontes em `35-ANALISE-JURIDICA.md` §3.

## 9. Hospedagem, e-mail e arquivos — `PEN-042`, `PEN-041`, `PEN-045`

Adiado por decisão do responsável até a homologação. Quando chegar a hora, decidir:

- onde hospedar (serviços gerenciados, VPS ou nuvem grande);
- provedor de e-mail transacional;
- armazenamento de arquivos com antivírus;
- onde ficam os logs e por quanto tempo.

A recomendação técnica é usar serviços gerenciados com backup automático.

## 10. Orçamento mensal — `PEN-048`

Faixa de gasto mensal aceitável com:

- domínio;
- hospedagem e banco de dados;
- e-mail;
- armazenamento de arquivos;
- backup;
- monitoramento.

Ajuda a escolher os provedores do item 9.

## 11. Dados existentes (planilhas) — `PEN-003`

**O que decidir:**

- se há atletas, mensalidades, produtos ou movimentações do caixa em planilhas ou outro sistema;
- se devem ser importados, e a partir de qual data;
- qual o saldo inicial de cada conta (dinheiro e banco) na data de corte.

## 12. Plano de contas do Caixa — `PEN-020`

O sistema veio com categorias provisórias (mensalidades, vendas, uniformes, aluguel de quadra, arbitragem etc.). **O que decidir:** validar ou ajustar essas categorias, de preferência com quem cuida da contabilidade do clube. Também se pode ajustar pelo painel.

## 13. Ajustes de funcionamento (podem esperar)

| Pergunta | Hoje | Pendência |
|---|---|---|
| Verificar o e-mail antes de liberar o login? | não exige | `PEN-008` |
| Quais campos são obrigatórios no cadastro de atleta e na inscrição? | mínimo adotado | `PEN-009` |
| O fuso oficial do clube é mesmo o de Rio Branco (Acre)? | `America/Rio_Branco` | `PEN-046` |
| Quais navegadores e celulares precisam funcionar? | duas versões recentes dos principais | `PEN-047` |
| Metas de velocidade e disponibilidade do site? | linha de base medida | `PEN-050` |
| Antecedência mínima e avaliações em agendamentos? | não implementado | `PEN-037` |
| Produto digital na loja? | fora do escopo | `PEN-033` |
| Algum dado de saúde (atestado, lesão) será necessário? | proibido | `PEN-012` |
