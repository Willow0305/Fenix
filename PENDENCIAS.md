# Pendências

Este arquivo registra decisões que não podem ser inventadas durante a implementação. As pendências abertas permanecem bloqueadoras conforme prioridade até aprovação explícita ou aceite de risco registrado.

Prioridades:

- **P0:** bloqueia uso com dados reais ou segurança básica;
- **P1:** bloqueia a fase funcional indicada;
- **P2:** pode ser refinada antes do módulo correspondente.

## Revisão das resoluções de 27/07/2026

O anexo `0413ab89-eb54-4a19-b340-becdcfac8295/pasted-text.txt` foi apresentado pelo
responsável de Produto como conjunto de resoluções para continuidade do projeto. A
decisão de `PEN-052` coincide integralmente com a pendência canônica e foi aprovada.
As demais decisões foram incorporadas na extensão em que respondem às questões
registradas neste arquivo.

O anexo reutiliza os identificadores `PEN-002`, `PEN-004`, `PEN-005`, `PEN-006`,
`PEN-011` e `PEN-051` com títulos ou alcances diferentes dos registros canônicos.
Nesses casos, o identificador e o título já versionados neste arquivo permanecem
como autoridade de rastreabilidade; o conteúdo compatível foi registrado como
decisão parcial e as lacunas continuam abertas. A menção a documentos médicos no
texto associado a `PEN-011` não altera a proibição de dados de saúde determinada
por `AGENTS.md`, `PEN-012` e `docs/13-SEGURANCA-E-LGPD.md`.

## Atualização técnica de 29/07/2026

A solicitação `finalizar_fase_1_iniciar_fases_2_e_3` autorizou parâmetros
técnicos canônicos da Fase 1 e primeiras entregas verticais das Fases 2 e 3,
somente em local/teste e com dados fictícios. A implementação técnica não resolve
automaticamente decisões jurídicas, contábeis, institucionais ou de produção.
Esses bloqueios permanecem indicados individualmente abaixo.

## 1. Governança e fontes

### PEN-002 — Responsáveis por produto, tecnologia, financeiro, privacidade e segurança

- **Prioridade:** P0
- **Bloqueia:** aceite, produção e resposta a incidentes
- **Status:** parcialmente resolvida em 24/07/2026.
- **Decisão parcial:** enquanto não houver equipe formal, William Nascimento Oliveira assume provisoriamente a responsabilidade de Produto.
- **Questão pendente:** as responsabilidades de Tecnologia, Financeiro, Privacidade e Segurança permanecem pendentes de nomeação formal antes da produção.
- **Recomendação:** designar pelo menos Product Owner, responsável financeiro, responsável técnico, encarregado/canal de privacidade e contato de segurança.

### PEN-003 — Dados existentes e migração

- **Prioridade:** P1
- **Bloqueia:** importação e operação com dados reais; não bloqueia estruturas/testes fictícios
- **Questão:** não foi informado se atletas, mensalidades, produtos e caixa já existem em planilhas ou outro sistema.
- **Recomendação:** inventariar fontes, qualidade, base legal, duplicidades e critérios de reconciliação antes de criar importadores.

## 2. Identidade visual e conteúdo institucional

### PEN-004 — Confirmar a paleta oficial

- **Prioridade:** P1
- **Bloqueia:** aceite visual da Fase 1
- **Status:** parcialmente resolvida em 27/07/2026 para protótipos e desenvolvimento local.
- **Decisão parcial:** foi aprovada uma direção visual com vermelho, preto/cinza escuro, branco, neutros e dourado opcional, componentes consistentes, responsividade e acessibilidade básica.
- **Questão:** o PDF usa `#B80012`/`#7A000A`; o briefing usa `#C8102E`/`#8F001A`.
- **Questão pendente:** a aprovação não escolheu os valores canônicos entre as duas paletas; os tokens do briefing continuam provisórios.
- **Recomendação:** validar com a diretoria. Até lá, usar os tokens do briefing por serem a instrução mais recente e manter a troca centralizada.

### PEN-005 — Disponibilizar e autorizar os logotipos por contexto

- **Prioridade:** P1
- **Bloqueia:** variantes institucionais futuras; não bloqueia mais a logo principal
- **Status:** parcialmente resolvida em 29/07/2026.
- **Decisão parcial:** `referencias/logos/logo_fenix.png` foi fornecida e
  aprovada como identidade oficial principal; a aplicação usa cópia íntegra em
  `apps/web/public/brand/logo-fenix.png` e favicon derivado sem recoloração.
- **Questão:** versões masculina, feminina e diretoria e um manual de uso ainda
  não foram fornecidos.
- **Recomendação:** obter arquivos oficiais, preferencialmente SVG/PNG com transparência, regras de uso e autorização. Não extrair nem redesenhar as imagens do PDF.

### PEN-006 — Dados institucionais e textos legais

- **Prioridade:** P1
- **Bloqueia:** páginas públicas e cadastro
- **Status:** aberta. O texto `PEN-006` do anexo de 27/07/2026 trata de protótipos e não fornece o conteúdo desta pendência canônica.
- **Questão:** faltam nome oficial, CNPJ/representação quando aplicável, endereço, contatos, redes, história aprovada, termos, política de privacidade, retirada e dados bancários/PIX autorizados.
- **Recomendação:** diretoria fornecer conteúdo aprovado e separar claramente dado público de configuração financeira restrita.

## 3. Pessoas, acesso e LGPD

### PEN-008 — Cadastro, aprovação e vínculo de contas

- **Prioridade:** P1
- **Bloqueia:** Fases 1 e 2
- **Status:** parcialmente resolvida em 27/07/2026; suficiente para a base de conta e RBAC da Fase 1 local/teste.
- **Decisão parcial:** conta comum pode ser criada livremente por e-mail e senha, sem papel privilegiado. Papéis internos, esportivos, administrativos, financeiros, de moderação e de parceiro dependem de concessão ou aprovação manual por perfil autorizado, permitem múltiplos papéis e geram auditoria.
- **Questão pendente:** a estrutura permite um responsável vinculado a vários
  atletas e verificação de e-mail está implementada. Conta de menor, fundamento
  jurídico do vínculo e critérios reais de duplicidade ainda dependem de
  `PEN-010`/`PEN-011`.
- **Recomendação:** conta com e-mail verificado; interessado e inscrição não criam acesso automaticamente; conversão e vínculo são ações auditadas; modelar responsável dependente da decisão jurídica.

### PEN-009 — Campos obrigatórios de atleta, interessado e seletiva

- **Prioridade:** P1
- **Bloqueia:** Fase 2
- **Questão:** documento, gênero, posição, emergência e data de nascimento aparecem nas fontes, mas obrigatoriedade e finalidade não foram aprovadas.
- **Recomendação:** coletar o mínimo por fluxo; separar pré-inscrição pública do cadastro administrativo completo; documentar finalidade de cada campo.

### PEN-010 — Menores de idade

- **Prioridade:** P0
- **Bloqueia:** qualquer piloto com menores
- **Status:** parcialmente resolvida em 27/07/2026; produção e dados reais de menores continuam bloqueados.
- **Decisão parcial:** cadastro real de menor exige responsável legal vinculado, autorização registrada, anexos protegidos, acesso restrito e auditoria das ações sensíveis. Desenvolvimento, teste e homologação usam somente dados fictícios.
- **Questão pendente:** base legal, verificação do vínculo, aferição etária proporcional, supervisão, minimização, retenção e exercício de direitos não estão definidos. Além da LGPD, a aplicabilidade da Lei nº 15.211/2025 (ECA Digital), vigente desde março de 2026, e do Decreto nº 12.880/2026 precisa ser avaliada porque o serviço pode ter acesso provável por crianças e adolescentes.
- **Recomendação:** obter orientação jurídica atualizada; avaliar deveres de proteção por design, aferição de idade e supervisão parental sem ampliar a coleta; implementar responsável legal e consentimentos versionados somente após aprovação.

### PEN-011 — Bases legais, retenção e direitos dos titulares

- **Prioridade:** P0
- **Bloqueia:** produção com dados pessoais
- **Status:** aberta. O texto `PEN-011` do anexo de 27/07/2026 trata de documentos e anexos e não resolve esta pendência canônica.
- **Questão:** faltam inventário de tratamento, base legal por finalidade, prazos, descarte, anonimização, exportação, correção e canal do titular.
- **Recomendação:** produzir registro de operações de tratamento e matriz de retenção antes do piloto.

### PEN-012 — Dados sensíveis e saúde

- **Prioridade:** P0
- **Bloqueia:** qualquer campo ou integração de saúde
- **Questão:** profissionais incluem saúde, mas prontuário está fora do escopo.
- **Recomendação:** não coletar sintomas, diagnóstico, laudo ou prontuário. Reabrir somente com parecer jurídico, segregação, controles e necessidade demonstrada.

### PEN-013 — Política de autenticação e sessão

- **Prioridade:** P1
- **Bloqueia:** não bloqueia mais a conclusão técnica da Fase 1; a topologia de produção permanece em `PEN-043`
- **Status:** resolvida tecnicamente para local/teste em 29/07/2026.
- **Decisão parcial:** autenticação por e-mail e senha com mínimo de oito caracteres; access token de 45 minutos; renovação associada a atividade; logout com invalidação da sessão; recuperação por código de uso único enviado por e-mail, com validade entre 10 e 15 minutos, resposta não enumerável e revogação das sessões anteriores após troca de senha.
- **Evidência técnica em 27/07/2026:** `fase_1_admin_auditoria` implementou em
  local/teste bcrypt, cookies `HttpOnly`, refresh opaco rotativo, CSRF vinculado à
  sessão, bloqueio temporário, inatividade e recuperação com código HMAC de uso
  único. Esse estado histórico foi sucedido pelos parâmetros canônicos definidos
  e implementados em 29/07/2026.
- **Decisão técnica final da entrega:** inatividade/access de 45 minutos; sessão
  absoluta de 30 dias; recuperação por 10 minutos e cinco tentativas; cinco
  falhas em janela de 15 minutos; bloqueio de 15 minutos; verificação de e-mail
  por 24 horas; refresh opaco rotativo/uso único; CSRF por sessão; MFA TOTP
  obrigatório para papéis privilegiados; Redis para rate limit distribuído.
- **Questão pendente:** domínio, `SameSite`, proxy, cofre/rotação operacional de
  chaves e limite institucional de sessões simultâneas em produção.

### PEN-014 — Canal de segurança e resposta a incidente

- **Prioridade:** P0
- **Bloqueia:** produção
- **Status:** parcialmente resolvida em 27/07/2026; produção continua bloqueada.
- **Decisão parcial:** foram aprovadas as severidades baixa, média, alta e crítica e o fluxo mínimo de registro, classificação, contenção, correção, comunicação e avaliação LGPD.
- **Questão pendente:** não existe endereço privado efetivamente criado, chave de criptografia, SLA nem equipe/responsáveis de resposta nomeados.
- **Recomendação:** criar canal `security@` ou equivalente, habilitar MFA, definir triagem, escalonamento e comunicação LGPD.

## 4. Esportivo e inscrições

### PEN-015 — Taxonomia de equipe e categoria

- **Prioridade:** P1
- **Bloqueia:** Fase 2
- **Status:** estrutura técnica implementada em 29/07/2026 para dados fictícios;
  taxonomia institucional real permanece aberta.
- **Decisão parcial:** `Team` representa equipe/elenco concreto e `Category` representa classificações como faixa etária, gênero, nível ou divisão. Uma equipe pode ter categorias explícitas e mudanças de equipe/categoria devem preservar histórico.
- **Questão pendente:** taxonomias controladas, combinações permitidas, limites etários e critérios de vigência ainda não foram aprovados.
- **Recomendação:** `Team` representa elenco/equipe; `Category` representa classificação esportiva (faixa, gênero, nível), com vínculo explícito e histórico.

### PEN-016 — Estados e conversão de inscrições

- **Prioridade:** P1
- **Bloqueia:** Fase 2
- **Status:** máquina de estados e conversão implementadas em 29/07/2026 para a
  entrega vertical fictícia; critérios institucionais reais permanecem abertos.
- **Decisão parcial:** interessado, inscrição geral, inscrição de seletiva e atleta são conceitos separados. Conversão exige ação autorizada e auditada, reaproveita somente dados necessários e uma possível duplicidade gera alerta, nunca fusão automática.
- **Questão pendente:** máquina de estados definitiva, transições/reversões permitidas e dados mínimos juridicamente autorizados para detectar duplicidade ainda não foram aprovados.
- **Recomendação:** manter entidades separadas, detectar candidatos por dados mínimos autorizados e converter por ação auditada sem copiar silenciosamente dados desnecessários.

### PEN-017 — Regras de seletiva

- **Prioridade:** P2
- **Bloqueia:** Fase 2
- **Status:** primeira entrega vertical implementada em 29/07/2026; regras
  públicas/reabertura e uso real permanecem abertas.
- **Decisão parcial:** cada seletiva registra equipe/categoria, faixa, capacidade, janela de inscrição, data/local, responsável, critérios e estado; alterações importantes e decisões de presença/aprovação são auditadas.
- **Questão pendente:** regras exatas de lista de espera, duplicidade, capacidade concorrente, edição/reabertura, cancelamento e efeitos sobre inscrições ainda não foram aprovadas.
- **Recomendação:** aprovar máquina de estados e regras por seletiva antes de endpoints.

## 5. Mensalidades, pagamentos e Caixa Fênix

### PEN-018 — Planos e cobrança de mensalidade

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Status:** versionamento de plano e cobrança manual implementados em
  29/07/2026; mensalidade automática e regras comerciais permanecem abertas.
- **Decisão parcial:** planos são versionados e cada cobrança preserva o valor/regra aplicados; desconto, bolsa e isenção exigem motivo, aprovador e auditoria.
- **Questão pendente:** competência, pró-rata, valores/regras de multa e juros, dia não útil, pagamento parcial, mudança de plano e múltiplos vínculos permanecem sem definição exata e dependem também de `PEN-019`.
- **Recomendação:** oficina com o financeiro; versionar planos e preservar valor original de cada cobrança.

### PEN-019 — Pagamento parcial, excedente e conciliação

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Status:** resolvida tecnicamente para pagamento manual da entrega vertical em
  29/07/2026; PIX/gateway e política contábil real permanecem abertos.
- **Decisão técnica:** alocação explícita, parcial mantém saldo, excedente exige
  `CREDIT`, `RETURN_PENDING` ou `REVIEW_REQUIRED`, e idempotência/constraint
  impedem baixa duplicada.
- **Recomendação:** definir alocação explícita, impedir baixa duplicada por idempotência e não marcar como paga sem soma conciliada conforme tolerância aprovada.

### PEN-020 — Plano de contas, categorias e centros de custo

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Status:** catálogos configuráveis implementados; plano institucional e
  obrigatoriedade real de comprovante permanecem abertos.
- **Recomendação:** financeiro aprovar contas, categorias, centros de custo, obrigatoriedade de comprovante e permissões antes de lançar dados reais.

### PEN-021 — Moeda, escala e arredondamento

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Status:** resolvida tecnicamente para a entrega vertical em 29/07/2026.
- **Decisão:** BRL, `NUMERIC(19,4)` no PostgreSQL, `Decimal` no Prisma e string
  decimal no contrato; nenhum `float`/`double`.
- **Recomendação:** BRL por padrão, `NUMERIC(19,4)` internamente quando taxas exigirem e apresentação em duas casas; arredondamento comercial explicitamente testado. Confirmar com contabilidade.

### PEN-022 — Saldo inicial e data de corte

- **Prioridade:** P1
- **Bloqueia:** adoção do Caixa
- **Status:** abertura técnica por sessão de caixa implementada; data de corte e
  saldos institucionais reais permanecem abertos.
- **Recomendação:** registrar lançamento controlado de abertura por conta, com documento, responsável e conciliação; nunca editar o saldo diretamente.

### PEN-023 — Fechamento, reabertura e competência

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Status:** fechamento imutável implementado; periodicidade, tolerância e
  reabertura formal permanecem abertos.
- **Recomendação:** fechamento por conta/período, bloqueio de alteração retroativa, reabertura com permissão específica, motivo e auditoria.

### PEN-024 — Transferências, estornos e reembolsos

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Status:** transferências neutras e reversões vinculadas implementadas;
  reembolso completo, limites e política contábil real permanecem abertos.
- **Recomendação:** transferência com duas pernas vinculadas; estorno e reembolso como novos movimentos referenciando a origem; proibir sobrescrita do fato confirmado.

### PEN-025 — Contas a pagar e receber

- **Prioridade:** P2
- **Bloqueia:** conclusão da Fase 3
- **Status:** obrigação simples, baixa parcial/total e vínculo ao razão
  implementados; recorrência, parcelamento, documento fiscal e fluxo real
  permanecem abertos.
- **Recomendação:** modelar obrigação separada do movimento de caixa e aprovar fluxo de autorização.

### PEN-026 — Gateway e PIX

- **Prioridade:** P2
- **Bloqueia:** automação de pagamento, não o MVP manual
- **Questão:** provedor, taxas, split, webhooks, chargeback e responsabilidade não foram escolhidos.
- **Recomendação:** iniciar com registro manual controlado; avaliar provedores e contrato antes de integrar. Nunca armazenar dados de cartão.

## 6. Loja, estoque e campanhas

### PEN-027 — Reserva e baixa de estoque

- **Prioridade:** P1
- **Bloqueia:** Fase 4
- **Questão:** o PDF sugere reduzir ao confirmar pedido; o briefing distingue pagamento, campanhas e estoque.
- **Recomendação:** reservar por período ao criar/confirmar checkout e efetivar saída no estado aprovado; expirar reserva e tratar concorrência transacionalmente.

### PEN-028 — Checkout de visitante, entrega e retirada

- **Prioridade:** P1
- **Bloqueia:** Fase 4
- **Questão:** pedido por visitante aparece no PDF; endereço, frete, retirada, identificação e LGPD não estão definidos.
- **Recomendação:** decidir se o MVP exige conta. Começar com retirada local e dados mínimos, se aprovado; frete somente após regras e custos.

### PEN-029 — Preços, promoções e variações

- **Prioridade:** P1
- **Bloqueia:** Fase 4
- **Questão:** combinação de SKU, tamanho/cor/gênero, preço por variante, promoção, custo e limite por comprador não tem regra.
- **Recomendação:** estoque e SKU na variante; pedido guarda snapshot de nome, SKU e preço; promoções têm intervalo e validação de sobreposição.

### PEN-030 — Cancelamento, devolução e reembolso da loja

- **Prioridade:** P0
- **Bloqueia:** vendas reais
- **Questão:** termos, prazo, produto personalizado, retirada não realizada e fluxo financeiro não foram definidos.
- **Recomendação:** validar política jurídica/comercial e implementar reembolso vinculado, estoque e comunicação como um caso de uso auditado.

### PEN-031 — Campanhas/remessas

- **Prioridade:** P1
- **Bloqueia:** Fase 5
- **Questão:** visibilidade “oculta”, quantidade mínima/máxima, encerramento, consolidação, alteração após pedido à malharia e atraso não possuem política completa.
- **Recomendação:** máquina de estados aprovada; snapshot de variações; fechamento imutável após envio; relatório conferível e aprovação dupla para reabrir.

### PEN-032 — Campanha abaixo do mínimo

- **Prioridade:** P0
- **Bloqueia:** cobrança em campanhas
- **Questão:** quando cobrar, prazo e método de reembolso e quem absorve taxas não foram definidos.
- **Recomendação:** preferir autorização/cobrança somente ao atingir condição quando o gateway permitir; no fluxo manual, publicar regra clara antes da venda.

### PEN-033 — Produto digital

- **Prioridade:** P2
- **Bloqueia:** nenhuma fase atual
- **Questão:** citado como possibilidade futura, sem caso de uso.
- **Recomendação:** manter enum/reserva conceitual somente se não complicar o modelo; não implementar entrega digital agora.

## 7. Parceiros e profissionais

### PEN-034 — Aprovação e contrato de parceiro

- **Prioridade:** P0
- **Bloqueia:** Fase 6 e venda de parceiro
- **Questão:** documentos, vigência, responsabilidade, tributação, atendimento, entrega e proteção de dados não estão definidos.
- **Recomendação:** cadastro só fica ativo após aprovação contratual; versionar vigência e bloquear novas vendas fora dela sem apagar histórico.

### PEN-035 — Comissão, repasse e prestação de contas

- **Prioridade:** P1
- **Bloqueia:** vendas de parceiro
- **Questão:** percentual versus valor, base de cálculo, descontos, taxas, devoluções, prazo e documento fiscal não estão definidos.
- **Recomendação:** snapshot da regra no item do pedido; ledger separa receita do time e obrigação com parceiro; liquidação agrupada e auditada.

### PEN-036 — Acesso de parceiro ao sistema

- **Prioridade:** P1
- **Bloqueia:** portal de parceiro
- **Questão:** não está decidido se parceiro confirma agenda, consulta vendas ou recebe apenas comunicação externa.
- **Recomendação:** não criar papel de parceiro na Fase 1; definir escopo mínimo e segregação antes da Fase 6.

### PEN-037 — Agenda, cancelamento e avaliações

- **Prioridade:** P1
- **Bloqueia:** Fase 6
- **Questão:** duração, buffers, conflito, fuso, antecedência, falta, cancelamento, pagamento e moderação de avaliações estão abertos.
- **Recomendação:** começar por solicitação/confirmação manual; implementar disponibilidade recorrente e avaliações somente após regras aprovadas.

## 8. Conteúdo, fórum e notificações

### PEN-038 — Relação entre notícia, evento, partida e fórum

- **Prioridade:** P2
- **Bloqueia:** Fase 7
- **Questão:** uma informação pode aparecer em vários canais sem definição de fonte editorial.
- **Recomendação:** entidades relacionadas e projeções de publicação; evitar duplicação de conteúdo e preservar histórico editorial.

### PEN-039 — Moderação e participação no fórum

- **Prioridade:** P0
- **Bloqueia:** fórum público
- **Questão:** quem publica, comenta, reage, denuncia, modera e recorre; SLA e conteúdo proibido não foram definidos.
- **Recomendação:** fórum inicialmente restrito a usuários verificados; política publicada; moderação auditada; exclusão lógica e rate limiting.

### PEN-040 — Canais e preferências de notificação

- **Prioridade:** P2
- **Bloqueia:** Fase 7
- **Questão:** in-app, e-mail, WhatsApp, obrigatoriedade, consentimento, horário e provedor estão abertos.
- **Recomendação:** iniciar com in-app e e-mail transacional; preferências por finalidade; WhatsApp somente após base legal, custo e provedor aprovados.

## 9. Arquivos, infraestrutura e operação

### PEN-041 — Política de arquivos

- **Prioridade:** P0
- **Bloqueia:** uploads reais
- **Status:** metadados privados, hash, estado e autorização foram preparados;
  upload/objeto real permanece bloqueado.
- **Recomendação:** matriz por finalidade; bucket privado; MIME real, hash e varredura; URL assinada; comprovantes com acesso restrito.

### PEN-042 — Provedores e região

- **Prioridade:** P1
- **Bloqueia:** staging/produção
- **Questão:** hospedagem de web/API, PostgreSQL, objetos, e-mail, monitoramento e região de dados não foram escolhidos.
- **Recomendação:** comparar serviços gerenciados por custo total, suporte, backup, portabilidade e LGPD; evitar hospedagem limitada a PHP.

### PEN-043 — Domínios e CORS

- **Prioridade:** P1
- **Bloqueia:** autenticação integrada
- **Status:** resolvida para desenvolvimento local/teste em 27/07/2026; aberta para staging e produção.
- **Decisão parcial:** ambientes permanecem separados; local usa por padrão web em `http://localhost:3000` e API em `http://localhost:3333`; CORS usa lista explícita por ambiente e nunca `*` em produção; cookies de autenticação em produção usam `HttpOnly`, `Secure`, `SameSite` adequado e HTTPS.
- **Questão pendente:** domínio, subdomínios oficiais, valor final de `SameSite`, proteção CSRF e separação web/API de staging e produção não estão definidos.
- **Recomendação:** preferir mesmo domínio organizacional e topologia que permita cookies seguros; CORS por lista explícita.

### PEN-044 — Disponibilidade, RPO, RTO e backup

- **Prioridade:** P0
- **Bloqueia:** produção
- **Questão:** “24 horas” não define SLA, janela de manutenção nem recuperação.
- **Recomendação:** aprovar SLO, RPO/RTO, retenção e frequência; testar restauração antes do piloto.

### PEN-045 — Observabilidade e retenção de logs

- **Prioridade:** P1
- **Bloqueia:** produção
- **Questão:** provedor, alertas, plantão, retenção e mascaramento não estão definidos.
- **Recomendação:** logs estruturados mínimos, métricas RED, correlation ID e alertas acionáveis; matriz de campos proibidos.

### PEN-046 — Zona de horário operacional

- **Prioridade:** P1
- **Bloqueia:** agendamentos, campanhas e publicações
- **Questão:** o ambiente atual usa `America/Rio_Branco`, mas a localização e a zona oficial do time não foram confirmadas.
- **Recomendação:** tornar a zona uma configuração institucional e armazenar instantes em UTC.

### PEN-047 — Acessibilidade e navegadores suportados

- **Prioridade:** P1
- **Bloqueia:** aceite de UX
- **Questão:** as fontes pedem acessibilidade e navegadores modernos, sem versão-alvo.
- **Recomendação:** adotar WCAG 2.2 nível AA e duas versões estáveis mais recentes de Chrome, Edge, Firefox e Safari, validando a realidade do público.
- **Evidência de 29/07/2026:** semântica, rótulos, foco, estados textuais,
  responsividade estática, testes de componentes e build foram revisados. A
  sessão não disponibilizou navegador integrado, portanto axe/Playwright visual
  continua pendente e não foi declarado como executado.

### PEN-048 — Custos e orçamento

- **Prioridade:** P1
- **Bloqueia:** escolha de produção
- **Questão:** não há orçamento para domínio, infraestrutura, e-mail, armazenamento, gateway, observabilidade, backup e manutenção.
- **Recomendação:** definir faixas de usuários, arquivos, pedidos e mensagens; solicitar cotações e reservar custo operacional recorrente.

## 10. Contratos e qualidade

### PEN-049 — Paginação, concorrência e exportações

- **Prioridade:** P1
- **Bloqueia:** estabilização dos contratos de listas, alterações administrativas e relatórios das fases correspondentes
- **Status:** cursor/limites e transações serializáveis foram adotados nos
  recortes atuais; exportações e concorrência otimista genérica permanecem
  abertas.
- **Recomendação:** decidir por perfil de consulta e volume medido; exigir proteção contra sobrescrita silenciosa em recursos críticos; definir formatos, minimização, expiração e geração síncrona/assíncrona antes de liberar exportações.

### PEN-050 — Metas de desempenho, capacidade e rate limiting

- **Prioridade:** P1
- **Bloqueia:** aceite não funcional e produção
- **Status:** rate limit por risco/rota foi implementado com Redis; volumes,
  latência, carga e SLOs permanecem abertos.
- **Recomendação:** medir a linha de base da fase, aprovar cenários e SLOs verificáveis e então configurar limites defensivos sem presumir um único valor para todas as operações.

### PEN-051 — Cobertura e ferramentas de teste

- **Prioridade:** P1
- **Bloqueia:** definição completa do gate de qualidade das fases funcionais
- **Status:** parcialmente resolvida em 27/07/2026.
- **Decisão parcial:** o gate funcional mínimo da Fase 1 deve cobrir administrador inicial, login, logout, expiração/renovação, recuperação, rotas protegidas, autorização, usuários, papéis, auditoria, migrations limpas e ausência de tabelas de fases futuras, sempre com dados fictícios. A Fase 2 depende de aceite formal da Fase 1.
- **Evidência técnica em 27/07/2026:** o teste integrado
  `scripts/phase1-auth-integration.mjs` cobre esse recorte contra PostgreSQL
  migrado e SMTP falso, incluindo CSRF, rotação/reuso de refresh, bloqueio,
  inatividade, recuperação, negação de acesso, auditoria minimizada e proteção
  append-only. Ferramentas e metas não funcionais continuam pendentes.
- **Evidência adicional em 29/07/2026:** gates das Fases 2 e 3 cobrem RBAC,
  menores fictícios, histórico, conversão concorrente, parcial/excedente,
  idempotência/baixa concorrente, transferência, aprovação, reversão, obrigação,
  fechamento e auditoria sem segredos. Migrations foram validadas desde banco
  vazio e sobre baseline da Fase 1.
- **Questão pendente:** não foram aprovados percentuais de cobertura, ferramentas de E2E, acessibilidade, contrato, carga e segurança, política de snapshot visual ou uso de teste de mutação.
- **Recomendação:** manter cobertura orientada a risco e casos positivos/negativos obrigatórios para finanças, permissões e transições; estabelecer linha de base antes de qualquer percentual global e aprovar ferramentas por fase.

## 11. Resolvidas

### PEN-001 — Aprovação explícita da baseline documental

- **Prioridade original:** P0
- **Bloqueava:** encerramento formal da Fase 0
- **Status:** resolvida
- **Data:** 24/07/2026
- **Aprovado por:** William Nascimento
- **Decisão:** a baseline documental do projeto Fênix está aprovada para orientar a Fase 1 de desenvolvimento.
- **Documentos considerados como baseline:** README do projeto, ROADMAP, PENDENCIAS, ERD/modelagem inicial, AGENTS.md/instruções para Codex e documento de requisitos/módulos do sistema.
- **Regra de mudança:** a baseline poderá ser alterada futuramente mediante registro de decisão, justificativa e impacto sobre escopo, prazo, dados, segurança ou regras financeiras.

### PEN-007 — Perfis, papéis e permissões

- **Prioridade original:** P1
- **Bloqueava:** Fase 1
- **Status:** resolvida para documentação da Fase 1
- **Data:** 24/07/2026
- **Fonte da decisão:** anexo `9b9d0e18-4981-4920-96d7-53487a9830ed/pasted-text.txt`
- **Decisão:** adotar controle de acesso baseado em perfis, papéis e permissões, com múltiplas funções por conta, concessão por perfil autorizado, menor privilégio, auditoria para ações sensíveis e expansão futura sem quebra da estrutura inicial.
- **Perfis documentados:** Administrador, Diretoria, Atleta, Responsável Legal, Moderador, Financeiro, Tesoureiro, Assistente Financeiro, Parceiro e Comunicação Externa.
- **Diretoria e funções registradas:** Diretoria Executiva Administrativa, Diretoria Esportiva, Comissões Técnicas Masculina e Feminina, Marketing/Comunicação/Comercial, Operacional/Logística, Base/Formação/Projetos Sociais e Conselheiros.
- **Restrições mantidas:** o acesso de menores com dados reais continua bloqueado por `PEN-010`; produção ainda depende de responsáveis formais pendentes em `PEN-002`; regras específicas de conta, convite, aprovação e vínculo continuam em `PEN-008`.

### PEN-052 — Estratégia incremental do schema Prisma e das migrations

- **Prioridade original:** P1
- **Bloqueava:** primeira migration funcional e persistência da Fase 1
- **Status:** resolvida
- **Data:** 27/07/2026
- **Aprovado por:** William Nascimento Oliveira, responsável provisório de Produto
- **Fonte da decisão:** anexo `0413ab89-eb54-4a19-b340-becdcfac8295/pasted-text.txt` e solicitação explícita de continuidade.
- **Decisão:** `prisma/schema.prisma` é o único schema físico executável e contém somente modelos promovidos da fase vigente. O modelo conceitual completo permanece na documentação, no ERD, no dicionário e em arquivo de referência não utilizado por `prisma migrate`.
- **Primeiro recorte autorizado:** `User`, `UserSession`, `UserToken`, `Role`, `Permission`, `UserRole` e `RolePermission`, na migration `fase_1_identidade_acesso`.
- **Recorte promovido em 27/07/2026:** `fase_1_admin_auditoria` adicionou
  administrador inicial, autenticação, API/interface administrativa e
  `AuditLog`, com migration, testes e documentação próprios.
- **Promoções posteriores autorizadas:** segurança/privacidade da Fase 1, módulo
  esportivo da Fase 2 e Caixa Fênix da Fase 3 foram promovidos em migrations
  próprias, com testes e documentação.
- **Regra de promoção:** cada inclusão posterior exige fase autorizada, migration própria, documentação, testes e validação automatizada de que nenhuma tabela futura foi criada.
- **Restrições mantidas:** as promoções valem somente para desenvolvimento
  local/teste com dados fictícios; não autorizam produção, dados reais, menores
  reais, uploads reais, loja, parceiros, fórum completo ou gateway.

## 12. Critério de resolução

Ao resolver uma pendência:

1. registrar decisão e aprovador;
2. atualizar requisitos, regras, modelo, fluxos e testes afetados;
3. adicionar ou atualizar a decisão em `docs/17-DECISOES-TECNICAS.md`;
4. mover a entrada para uma seção “Resolvidas”, sem apagar o histórico;
5. atualizar `CHANGELOG.md`.
