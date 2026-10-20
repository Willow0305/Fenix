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

**O que o sistema já faz (`DT-026`):**

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

- **(a) Recomendada:** piloto só com adultos.
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

**O que decidir:**

- o texto que aparece antes da compra explicando o que acontece se a remessa for cancelada (devolução integral? em quantos dias? quem paga taxas?).

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
