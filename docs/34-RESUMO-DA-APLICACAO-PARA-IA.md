# Fênix Vôlei — Resumo do sistema para análise por outra IA

> **Objetivo:** fornecer contexto verificável para que outra IA ou profissional revise e
> melhore os [Termos de Uso](./32-TERMOS-DE-USO.md) e a [Política de Privacidade](./33-POLITICA-DE-PRIVACIDADE.md).
> Este resumo não é fonte jurídica, não substitui leitura do código nem autorização do
> responsável do projeto.

**Atualizado em:** 30/10/2026  
**Estado dos documentos jurídicos:** rascunhos internos, ainda não aprovados nem publicados.

## 1. Instruções para a próxima IA/revisora

1. Leia este resumo, os dois rascunhos, [`AGENTS.md`](../AGENTS.md), os documentos
   pertinentes em `docs/` e a pendência correspondente antes de propor redação.
2. Use o PDF original como origem do escopo, a documentação consolidada e decisões aprovadas
   como especificação do produto, e o código/configuração como evidência do que está
   implementado. Se houver divergência, não a resolva em silêncio: registre-a em
   [`PENDENCIAS.md`](../PENDENCIAS.md).
3. Use a legislação e a regulamentação oficial vigentes no momento da revisão. Não trate
   textos técnicos antigos, modelos de outros clubes ou recomendações da IA como parecer.
   Não copie cláusulas de outra instituição.
4. Não invente controlador, CNPJ, endereço, contato, base legal, prazo de retenção,
   fornecedor em produção, política de cancelamento, regra de menor ou garantia.
5. Não reduza direitos legais de titulares ou consumidores. Quando uma regra implementada
   parecer incompatível com a legislação, registre a divergência e proponha revisão jurídica
   e do produto; não simplesmente a repita no documento.
6. Diferencie o que está implementado, o que está apenas configurável e o que depende de
   credenciais/provedor/decisão. Não presuma que documentação antiga descreve o estado atual.
7. Recomende alterações com rastreabilidade: seção do documento, requisito, decisão,
   código/tela correspondente, dúvida aberta e impacto. Preserve versões anteriores de
   termos aceitos quando o sistema oferecer versionamento.

## 2. Visão do produto

O Fênix Vôlei é uma aplicação web responsiva para um time/organização de vôlei. Combina
site institucional, área autenticada de atleta/cliente, painel administrativo, gestão de
inscrições e equipes, mensalidades e caixa, loja, afiliações, parceiros, agendamentos,
notícias, eventos, fórum, notificações, relatórios e pedidos de titulares.

Públicos e perfis observados: visitantes e interessados; compradores com ou sem conta;
usuários e atletas; responsáveis por atletas; diretoria; administrador; parceiros e
profissionais. O acesso administrativo é granular, autenticado e validado no servidor.
Responsáveis não têm portal/perfil de acesso próprio aprovado; parceiros não recebem
acesso administrativo por padrão.

O projeto está em `C:\Users\William\Desktop\Fenix`, monorepo com Next.js/React no site,
NestJS/TypeScript na API e PostgreSQL/Prisma no banco. A Fase 8 está relatada como concluída
e funções da Fase 9 foram implementadas em decisões incrementais. Não confundir o escopo
original do PDF com toda a evolução posterior.

## 3. Recursos relevantes aos termos

- Cadastro de conta, autenticação, recuperação de senha, sessões, autenticação em duas
  etapas, perfil, notificações e encerramento de sessões.
- Páginas públicas institucionais, equipes, fotos autorizadas, notícias, eventos e
  conteúdo externo, seletivas e formulários de interesse.
- Cadastro esportivo de atletas, equipes, categorias, vínculos e status; mensalidades,
  pagamentos manuais/PIX, Caixa Fênix, comprovantes, auditoria, conciliação e relatórios.
- Loja com produtos, variações, estoque, personalizações, cupons, carrinho, favoritos,
  pedidos de visitantes ou de contas, pagamentos PIX e cartão, entrega/retirada,
  cancelamentos, pedidos de devolução e campanhas/remessas.
- Afiliação vendida como produto da loja, beneficiários, carteirinhas digitais, benefícios
  de parceiros e validade.
- Parceiros aprovados, profissionais, serviços, agenda, agendamentos, comissões e repasses.
- Fórum com níveis de visibilidade, tópicos, respostas, reações, denúncias e moderação;
  avaliações de produto são feitas por compradores elegíveis e aprovadas pela diretoria.
- Notificações internas; opções por finalidade/canal para e-mail e WhatsApp, com opt-in
  destacado e revogável para WhatsApp.
- Exportação dos próprios dados e solicitações de privacidade pela área autenticada;
  fila administrativa e anonimização com preservação de registros necessários.

Os detalhes de disponibilidade, meios de pagamento, frete, política de produto e
benefícios podem depender de configuração e devem ser apresentados ao consumidor na oferta
ou checkout. O provedor real e os serviços externos ativos precisam ser verificados no
ambiente de produção.

## 4. Mapa resumido de dados pessoais

| Grupo de pessoas | Exemplos de dados técnicos | Finalidades funcionais |
|---|---|---|
| Conta/usuário | nome, e-mail, telefone opcional, hash de senha, MFA, sessões, foto, preferências e notificações | autenticação, segurança, perfil e comunicações |
| Interessado/inscrito | nome, contato, nascimento, posição, respostas, dados de responsável, estado e prova de aviso/consentimento | contato e avaliação de seletiva |
| Atleta | dados cadastrais/esportivos, nascimento, CPF opcional cifrado, contato/emergência, responsável, vínculos, cobranças e foto | gerir cadastro, esporte, comunicação e mensalidades |
| Comprador | nome, contato, endereço, itens, variações, personalização, cupom, pagamento e entrega | realizar e acompanhar compra e suporte |
| Visitante de loja | identificação mínima, número do pedido e segredo de consulta protegido | concluir compra sem conta e consultar pedido |
| Afiliado/beneficiário | nome, e-mail opcional, validade e benefícios da carteirinha | emissão e validação de afiliação |
| Parceiro/profissional | contato, CPF/CNPJ/registro cifrado, documentos, contrato, comissão, disponibilidade e serviços | operar oferta, agenda e repasses |
| Participante do fórum/avaliador | publicação, reação, denúncia, moderação, comentário de produto e primeiro nome público após aprovação | comunidade e avaliação de produto |
| Terceiros de entrega | dados de entregador, endereço, código/token, tentativas e foto/prova de entrega | completar e comprovar entrega |
| Operadores/segurança | IP tratado de forma limitada/hash em controles, navegador/hash, request ID, eventos e logs | proteção, rate limit, investigação e observabilidade |

O modelo exclui prontuário médico e dados de saúde. Não confundir gênero ou registro de
emergência com “dado sensível” sem classificação jurídica; a classificação e a necessidade
de cada campo ainda devem ser verificadas.

## 5. Fluxos, cookies, fornecedores e visibilidade

- Cookies essenciais sustentam renovação de sessão (`fenix_rt`), navegador lembrado (`fenix_dv`)
  e carrinho anônimo (`fenix_cart`). A autenticação usa cookies `HttpOnly` e `SameSite=Strict`,
  com `Secure` em produção.
- O carrinho de visitante usa token protegido; consulta de pedido exige número e código
  secreto. O token de entregador e o código de entrega têm proteções próprias. Não expor
  esses valores em URL, logs ou documentos públicos.
- A leitura de notícias é agregada por notícia/dia, sem usuário, IP, navegador ou cookie;
  a proteção contra repetição por aba fica em `sessionStorage`.
- Uma consulta de CEP é intermediada pela API. Não presuma que isso equivale a ausência
  total de compartilhamento com o fornecedor externo.
- O checkout de cartão usa integração no navegador com formulário do Mercado Pago quando
  ativada; a documentação do produto afirma que o número do cartão não passa pelo servidor
  do Fênix e que não são armazenados número completo nem código de segurança. O código
  guarda somente bandeira, quatro últimos dígitos, parcelas e situação.
- PIX pode usar provedor configurado ou comprovante manual. E-mail/WhatsApp e armazenamento
  de arquivos dependem de configuração. Em desenvolvimento, e-mail é simulado em arquivo;
  não presumir entrega real. Verificar chaves, contratos, região e operadores antes de
  afirmar fornecedores ativos.
- Fotos de perfil são privadas por padrão; publicação depende de escolha do titular e,
  para menores ou pessoas sem data de nascimento, de autorização registrada. Fotos de
  notícia, time e produto são conteúdo público quando publicadas.
- Avaliação aprovada exibe primeiro nome. Não afirmar anonimato de conteúdo de comunidade.
- Nenhum acesso de parceiro a painel/dados é concedido por padrão. O compartilhamento
  estritamente necessário para um produto/serviço parceiro deve ser especificado antes da
  operação.

## 6. Salvaguardas implementadas (conforme documentação/código consultados)

- Hash adaptativo `scrypt`; refresh tokens opacos armazenados como hash e rotacionados.
- MFA em perfis privilegiados, sessões revogáveis, autenticação segura e recuperação de
  senha sem enumeração de conta.
- Guard global com negação por padrão, permissões granulares por rota e validação de
  titularidade no servidor.
- Dados bancários e alguns documentos cifrados; senhas e segredos não devem ir a logs.
- Upload validado por tipo/tamanho/assinatura, com controles de acesso por classificação;
  há requisitos ainda pendentes de provedor de objeto e antivírus.
- Auditoria para operações sensíveis, financeiras e de moderação.
- Transações e idempotência para pagamento, estoque e caixa.
- Exportação de dados sem senhas, tokens ou dados de terceiros; pedido de eliminação
  processado por anonimização auditada.
- Preferências de canal conferidas no envio; WhatsApp exige opt-in e pode ser revogado.

Esta lista não equivale a certificação de segurança, conformidade ou configuração de
produção.

## 7. Telas públicas e comportamento atual

O código de site consultado em `apps/web/app/(site)/termos/page.tsx` exibe o conteúdo
`team.termsOfUse` configurado no sistema; quando vazio, mostra que os termos estão em
elaboração. A rota `apps/web/app/(site)/privacidade/page.tsx` exibe `team.privacyPolicy`
ou um texto curto provisório.

A tela de cadastro contém checkboxes para aceitar termos e política, e declara idade mínima
de 12 anos. A API exige esses booleanos e registra `termsAccepted: true` e
`minimumAgeDeclared: 12` em evento de auditoria, mas **não vincula o aceite à versão/hash
dos documentos**. Antes de lançamento, garantir que o texto realmente publicado seja o
aprovado e que a prova de aceite identifique a versão correta.

Pessoas autenticadas exportam seus dados e podem abrir pedidos de privacidade. Há fila
administrativa e anonimização, mas não há canal de autosserviço para quem não tem conta.
O fluxo de anonimização preserva parte dos registros financeiros, pedidos e auditoria e
mantém dados esportivos enquanto a retenção não for decidida. Não declarar que a conta
remove automaticamente todo dado ou backup.

## 8. Pendências jurídicas e divergências identificadas

As seguintes pendências constam na documentação do projeto; a outra IA não deve marcá-las
como resolvidas por redigir uma minuta:

- `PEN-002`: nomeação de responsáveis, encarregado/canal de privacidade e segurança.
- `PEN-006`: identidade oficial, dados de contato, textos legais e conteúdo institucional.
- `PEN-010`: tratamento de menores, melhor interesse, idade, supervisão e ECA Digital.
- `PEN-011`: bases legais por finalidade, retenção, anonimização, canal do titular sem conta
  e prazos de resposta.
- `PEN-014`: canal de segurança e resposta a incidente.
- `PEN-030` e `PEN-032`: política de cancelamento/devolução e remessas.
- `PEN-034` e `PEN-037`: contratos/responsabilidade de parceiros e regras de agendamento.
- `PEN-039`: convivência, moderação, prazo e recurso no fórum.
- `PEN-041`, `PEN-042` e `PEN-045`: antivírus, fornecedores de arquivos/e-mail e retenção de
  logs/observabilidade.
- `PEN-071` (adicionada junto dos rascunhos): a interface afirma exclusão geral de
  arrependimento para produtos personalizados e define marco temporal para compras/
  afiliações que requer revisão jurídica; além disso, o aceite de conta não registra
  versão do documento.

As decisões no checkout e no componente `apps/web/components/consumer-rights.tsx` devem ser
verificadas na versão atual do código antes de alterar os termos. Em particular, não
reproduzir a exceção de itens personalizados nem o termo inicial do prazo de arrependimento
como regra definitiva sem validação jurídica.

## 9. Fontes de trabalho recomendadas

Começar pelas fontes locais:

- [`AGENTS.md`](../AGENTS.md): regras permanentes do repositório, LGPD e governança.
- [`docs/00-VISAO-GERAL.md`](./00-VISAO-GERAL.md), [`docs/01-OBJETIVOS-E-ESCOPO.md`](./01-OBJETIVOS-E-ESCOPO.md),
  [`docs/02-REQUISITOS-FUNCIONAIS.md`](./02-REQUISITOS-FUNCIONAIS.md): produto e limites.
- [`docs/04-REGRAS-DE-NEGOCIO.md`](./04-REGRAS-DE-NEGOCIO.md), [`docs/05-PERFIS-E-PERMISSOES.md`](./05-PERFIS-E-PERMISSOES.md)
  e [`docs/06-FLUXOS-DO-SISTEMA.md`](./06-FLUXOS-DO-SISTEMA.md): regras e acesso.
- [`docs/13-SEGURANCA-E-LGPD.md`](./13-SEGURANCA-E-LGPD.md): inventário, proteção, direitos e
  ECA Digital.
- [`docs/16-ROADMAP.md`](./16-ROADMAP.md), [`docs/17-DECISOES-TECNICAS.md`](./17-DECISOES-TECNICAS.md)
  e [`docs/28-DECISOES-PENDENTES-DO-RESPONSAVEL.md`](./28-DECISOES-PENDENTES-DO-RESPONSAVEL.md):
  estado atual, mudanças aprovadas e decisões abertas.
- [`docs/27-RELATORIO-FASE-8.md`](./27-RELATORIO-FASE-8.md), código de `apps/api/src/modules/privacy`,
  `apps/api/src/modules/auth`, `apps/api/src/modules/store` e `prisma/schema.prisma`:
  privacidade executável e dados.

Fontes oficiais para conferir na data da análise:

- [LGPD — Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm);
- [ANPD — Direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares);
- [ANPD — ECA Digital e aferição de idade](https://www.gov.br/anpd/pt-br/assuntos/eca-digital);
- [Código de Defesa do Consumidor — Lei nº 8.078/1990](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm);
- [Marco Civil da Internet — Lei nº 12.965/2014](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm).

## 10. Entregável esperado da revisão

Para cada alteração proposta, apresentar:

1. texto revisado e seção afetada;
2. evidência funcional no código ou decisão aprovada que a sustenta;
3. fonte jurídica oficial e data de consulta para afirmação normativa;
4. perguntas que só o responsável, a diretoria ou assessoria jurídica pode responder;
5. impacto em site, cadastro, checkout, consentimentos, pagamentos, direitos, retenção,
   menores e fornecedores;
6. item de `PENDENCIAS.md` novo/atualizado, sem fechar pendência sem decisão explícita.
