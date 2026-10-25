# Pendências

Este arquivo registra decisões que não podem ser inventadas durante a implementação. As decisões que ainda dependem do responsável estão explicadas em linguagem direta em `docs/28-DECISOES-PENDENTES-DO-RESPONSAVEL.md`. Todas estão abertas até aprovação explícita, salvo quando indicadas de outra forma.

Prioridades:

- **P0:** bloqueia uso com dados reais ou segurança básica;
- **P1:** bloqueia a fase funcional indicada;
- **P2:** pode ser refinada antes do módulo correspondente.

## 1. Governança e fontes

### PEN-001 — Aprovar a especificação consolidada

- **Prioridade:** P0
- **Bloqueia:** encerramento formal da Fase 0
- **Questão:** o PDF versão 1.1 é a fonte principal original, enquanto o briefing acrescenta e, em alguns pontos, substitui decisões técnicas.
- **Recomendação:** aprovar os documentos em `docs/` como baseline v1.2, mantendo o PDF como origem rastreável e registrando mudanças futuras por decisão e changelog.

### PEN-002 — Responsáveis por produto, tecnologia, financeiro, privacidade e segurança

- **Prioridade:** P0
- **Bloqueia:** aceite, produção e resposta a incidentes
- **Questão:** não há responsáveis nominais nem alçadas de decisão.
- **Recomendação:** designar pelo menos Product Owner, responsável financeiro, responsável técnico, encarregado/canal de privacidade e contato de segurança.

### PEN-003 — Dados existentes e migração

- **Prioridade:** P1
- **Bloqueia:** Fases 2 e 3
- **Questão:** não foi informado se atletas, mensalidades, produtos e caixa já existem em planilhas ou outro sistema.
- **Recomendação:** inventariar fontes, qualidade, base legal, duplicidades e critérios de reconciliação antes de criar importadores.

## 2. Identidade visual e conteúdo institucional

### PEN-004 — Confirmar a paleta oficial

- **Prioridade:** P1
- **Bloqueia:** aceite visual da Fase 1
- **Questão:** o PDF usa `#B80012`/`#7A000A`; o briefing usa `#C8102E`/`#8F001A`.
- **Recomendação:** validar com a diretoria. Até lá, usar os tokens do briefing por serem a instrução mais recente e manter a troca centralizada.

### PEN-005 — Disponibilizar e autorizar os logotipos por contexto

- **Prioridade:** P1
- **Bloqueia:** configurações de marca
- **Questão:** o repositório possui somente `logo_fenix.png`; o documento mostra versões masculina, feminina e diretoria, mas os arquivos não estão disponíveis.
- **Recomendação:** obter arquivos oficiais, preferencialmente SVG/PNG com transparência, regras de uso e autorização. Não extrair nem redesenhar as imagens do PDF.

### PEN-006 — Dados institucionais e textos legais

- **Prioridade:** P1
- **Bloqueia:** páginas públicas e cadastro
- **Questão:** faltam nome oficial, CNPJ/representação quando aplicável, endereço, contatos, redes, história aprovada, termos, política de privacidade, retirada e dados bancários/PIX autorizados.
- **Recomendação:** diretoria fornecer conteúdo aprovado e separar claramente dado público de configuração financeira restrita.

## 3. Pessoas, acesso e LGPD

### PEN-007 — Matriz final de papéis e permissões

- **Prioridade:** P1
- **Bloqueia:** Fase 1
- **Questão:** “administrador”, “diretoria”, “atleta”, “responsável”, moderador, financeiro e parceiro não possuem alçadas detalhadas.
- **Recomendação:** aprovar permissões por ação e domínio; separar administrador técnico, gestor, financeiro e moderador; negar por padrão.

### PEN-008 — Cadastro, aprovação e vínculo de contas

- **Prioridade:** P1
- **Bloqueia:** Fases 1 e 2
- **Questão:** conta é criada livremente, por convite ou após aprovação? Um responsável pode gerir vários atletas? Um atleta menor pode ter conta?
- **Recomendação:** conta com e-mail verificado; interessado e inscrição não criam acesso automaticamente; conversão e vínculo são ações auditadas; modelar responsável dependente da decisão jurídica.

### PEN-009 — Campos obrigatórios de atleta, interessado e seletiva

- **Prioridade:** P1
- **Bloqueia:** Fase 2
- **Questão:** documento, gênero, posição, emergência e data de nascimento aparecem nas fontes, mas obrigatoriedade e finalidade não foram aprovadas.
- **Recomendação:** coletar o mínimo por fluxo; separar pré-inscrição pública do cadastro administrativo completo; documentar finalidade de cada campo.

### PEN-010 — Menores de idade

- **Prioridade:** P0
- **Bloqueia:** qualquer piloto com menores
- **Questão:** base legal, consentimento/ciência do responsável, verificação do vínculo, visibilidade, retenção e exercício de direitos não estão definidos. Além da LGPD, a aplicabilidade da Lei nº 15.211/2025 (ECA Digital), vigente desde março de 2026, e do Decreto nº 12.880/2026 precisa ser avaliada porque o serviço pode ter acesso provável por crianças e adolescentes.
- **Recomendação:** obter orientação jurídica atualizada; avaliar deveres de proteção por design, aferição de idade e supervisão parental sem ampliar a coleta; implementar responsável legal e consentimentos versionados somente após aprovação.

### PEN-011 — Bases legais, retenção e direitos dos titulares

- **Prioridade:** P0
- **Bloqueia:** produção com dados pessoais
- **Questão:** faltam inventário de tratamento, base legal por finalidade, prazos, descarte, anonimização, exportação, correção e canal do titular.
- **Recomendação:** produzir registro de operações de tratamento e matriz de retenção antes do piloto.

### PEN-012 — Dados sensíveis e saúde

- **Prioridade:** P0
- **Bloqueia:** qualquer campo ou integração de saúde
- **Questão:** profissionais incluem saúde, mas prontuário está fora do escopo.
- **Recomendação:** não coletar sintomas, diagnóstico, laudo ou prontuário. Reabrir somente com parecer jurídico, segregação, controles e necessidade demonstrada.

### PEN-013 — Política de autenticação e sessão

- **Prioridade:** P1
- **Bloqueia:** Fase 1
- **Questão:** duração de tokens, número de sessões, MFA administrativo, bloqueio, recuperação, verificação de e-mail e topologia de cookies não foram definidos.
- **Recomendação:** access token curto, refresh rotativo em cookie seguro, armazenamento de hash, revogação e detecção de reutilização; exigir MFA para perfis privilegiados antes da produção.

### PEN-014 — Canal de segurança e resposta a incidente

- **Prioridade:** P0
- **Bloqueia:** produção
- **Questão:** não existe endereço privado, chave de criptografia, escala de severidade, SLA nem equipe de resposta.
- **Recomendação:** criar canal `security@` ou equivalente, habilitar MFA, definir triagem, escalonamento e comunicação LGPD.

## 4. Esportivo e inscrições

### PEN-015 — Taxonomia de equipe e categoria

- **Prioridade:** P1
- **Bloqueia:** Fase 2
- **Questão:** o PDF mistura equipe e categoria; o briefing lista entidades separadas.
- **Recomendação:** `Team` representa elenco/equipe; `Category` representa classificação esportiva (faixa, gênero, nível), com vínculo explícito e histórico.

### PEN-016 — Estados e conversão de inscrições

- **Prioridade:** P1
- **Bloqueia:** Fase 2
- **Questão:** há interessado, inscrição geral, inscrição de seletiva e atleta; duplicidade e conversão não têm regra completa.
- **Recomendação:** manter entidades separadas, detectar candidatos por dados mínimos autorizados e converter por ação auditada sem copiar silenciosamente dados desnecessários.

### PEN-017 — Regras de seletiva

- **Prioridade:** P2
- **Bloqueia:** Fase 2
- **Questão:** capacidade, faixa etária, cancelamento, lista de espera, presença, duplicidade e prazo de edição não estão definidos.
- **Recomendação:** aprovar máquina de estados e regras por seletiva antes de endpoints.

## 5. Mensalidades, pagamentos e Caixa Fênix

### PEN-018 — Planos e cobrança de mensalidade

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Questão:** faltam competência, pró-rata, isenção, bolsa, desconto, multa, juros, vencimento em dia não útil, mudança de plano e múltiplos vínculos.
- **Recomendação:** oficina com o financeiro; versionar planos e preservar valor original de cada cobrança.

### PEN-019 — Pagamento parcial, excedente e conciliação

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Questão:** o PDF admite múltiplos pagamentos, mas não define parcial, excedente, duplicidade, identificação PIX e conciliação.
- **Recomendação:** definir alocação explícita, impedir baixa duplicada por idempotência e não marcar como paga sem soma conciliada conforme tolerância aprovada.

### PEN-020 — Plano de contas, categorias e centros de custo

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Questão:** as categorias exemplificadas não constituem plano aprovado.
- **Recomendação:** financeiro aprovar contas, categorias, centros de custo, obrigatoriedade de comprovante e permissões antes de lançar dados reais.

### PEN-021 — Moeda, escala e arredondamento

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Questão:** o briefing exige Decimal/Numeric; escala, moeda e política de arredondamento não foram fixadas.
- **Recomendação:** BRL por padrão, `NUMERIC(19,4)` internamente quando taxas exigirem e apresentação em duas casas; arredondamento comercial explicitamente testado. Confirmar com contabilidade.

### PEN-022 — Saldo inicial e data de corte

- **Prioridade:** P1
- **Bloqueia:** adoção do Caixa
- **Questão:** não há data de início nem saldo reconciliado por conta.
- **Recomendação:** registrar lançamento controlado de abertura por conta, com documento, responsável e conciliação; nunca editar o saldo diretamente.

### PEN-023 — Fechamento, reabertura e competência

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Questão:** periodicidade, tolerância, ajustes após fechamento e responsáveis não foram definidos.
- **Recomendação:** fechamento por conta/período, bloqueio de alteração retroativa, reabertura com permissão específica, motivo e auditoria.

### PEN-024 — Transferências, estornos e reembolsos

- **Prioridade:** P1
- **Bloqueia:** Fase 3
- **Questão:** faltam estados, limites e reflexos em competência e conciliação.
- **Recomendação:** transferência com duas pernas vinculadas; estorno e reembolso como novos movimentos referenciando a origem; proibir sobrescrita do fato confirmado.

### PEN-025 — Contas a pagar e receber

- **Prioridade:** P2
- **Bloqueia:** conclusão da Fase 3
- **Questão:** recorrência, parcelamento, aprovação, favorecido, documento fiscal e baixa não estão definidos.
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
- **Questão:** tipos, tamanhos, retenção, antivírus, visibilidade, versionamento e descarte não estão definidos.
- **Recomendação:** matriz por finalidade; bucket privado; MIME real, hash e varredura; URL assinada; comprovantes com acesso restrito.

### PEN-042 — Provedores e região

- **Prioridade:** P1
- **Bloqueia:** staging/produção
- **Questão:** hospedagem de web/API, PostgreSQL, objetos, e-mail, monitoramento e região de dados não foram escolhidos.
- **Recomendação:** comparar serviços gerenciados por custo total, suporte, backup, portabilidade e LGPD; evitar hospedagem limitada a PHP.

### PEN-043 — Domínios e CORS

- **Prioridade:** P1
- **Bloqueia:** autenticação integrada
- **Questão:** domínio, subdomínios e separação web/API não estão definidos.
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

### PEN-048 — Custos e orçamento

- **Prioridade:** P1
- **Bloqueia:** escolha de produção
- **Questão:** não há orçamento para domínio, infraestrutura, e-mail, armazenamento, gateway, observabilidade, backup e manutenção.
- **Recomendação:** definir faixas de usuários, arquivos, pedidos e mensagens; solicitar cotações e reservar custo operacional recorrente.

## 10. Contratos e qualidade

### PEN-049 — Paginação, concorrência e exportações

- **Prioridade:** P1
- **Bloqueia:** estabilização dos contratos de listas, alterações administrativas e relatórios das fases correspondentes
- **Questão:** não foram aprovados cursor versus offset, campos/versionamento para concorrência otimista, formatos de exportação, limites e processamento de relatórios grandes.
- **Recomendação:** decidir por perfil de consulta e volume medido; exigir proteção contra sobrescrita silenciosa em recursos críticos; definir formatos, minimização, expiração e geração síncrona/assíncrona antes de liberar exportações.

### PEN-050 — Metas de desempenho, capacidade e rate limiting

- **Prioridade:** P1
- **Bloqueia:** aceite não funcional e produção
- **Questão:** faltam volumes esperados, orçamento de página/API, metas de latência, carga concorrente e limites por rota, ator e risco.
- **Recomendação:** medir a linha de base da fase, aprovar cenários e SLOs verificáveis e então configurar limites defensivos sem presumir um único valor para todas as operações.

### PEN-051 — Cobertura e ferramentas de teste

- **Prioridade:** P1
- **Bloqueia:** definição completa do gate de qualidade das fases funcionais
- **Questão:** não foram aprovados percentuais de cobertura, ferramentas de E2E, acessibilidade, contrato, carga e segurança, política de snapshot visual ou uso de teste de mutação.
- **Recomendação:** manter cobertura orientada a risco e casos positivos/negativos obrigatórios para finanças, permissões e transições; estabelecer linha de base antes de qualquer percentual global e aprovar ferramentas por fase.

### PEN-052 — Estorno de venda de parceiro já repassada

- **Prioridade:** P2
- **Bloqueia:** nada; afeta a conciliação com parceiros
- **Questão:** quando um pedido com item já repassado (repasse pago) é estornado, o valor pago ao parceiro precisa ser recuperado. Hoje isso é feito manualmente por ajuste negativo motivado no próximo repasse.
- **Recomendação:** listar automaticamente, na criação do repasse, os itens repassados e depois estornados como sugestão de ajuste; combinar com o parceiro prazo e forma de devolução.

### PEN-053 — Proteção de login por conta e enumeração de e-mails

- **Prioridade:** P1
- **Bloqueia:** produção
- **Questão:** o limite de tentativas é por IP (10/min). Um ataque distribuído contra uma conta específica não é freado, e o cadastro informa quando o e-mail já existe, o que permite descobrir quem tem conta.
- **Recomendação:** o MFA (`DT-037`) já neutraliza a adivinhação de senha nos perfis privilegiados; para as demais contas, adicionar atraso progressivo por conta após falhas seguidas e alerta ao titular. Para o cadastro, avaliar resposta neutra com confirmação por e-mail, que depende do provedor de e-mail (`PEN-042`).

### PEN-054 — Arquivos restritos acessíveis por `files.read.restricted`

- **Prioridade:** P2
- **Bloqueia:** segregação fina de funções
- **Questão:** `GET /media/:id` libera qualquer arquivo não público a quem tem `files.read.restricted`, inclusive documentos confidenciais de parceiros, cuja rota dedicada exige `partner.documents.read`. Hoje só administrador e diretoria têm as duas permissões, então não há exposição efetiva.
- **Recomendação:** exigir a permissão de domínio do arquivo (classificação ou vínculo) também em `/media/:id` antes de distribuir permissões a papéis customizados.

### PEN-055 — Dependências recém-publicadas

- **Prioridade:** P2
- **Bloqueia:** nada
- **Questão:** as correções de segurança de `multer` 2.5.0 e `body-parser` 2.4.0 foram publicadas em 2026-10-22, três dias antes da adoção.
- **Recomendação:** reexecutar `npm audit` e conferir os avisos dos mantenedores antes da homologação; automatizar o `npm audit` no CI.

## 10.1 Correção de telas (`docs/29-CORRECAO-DE-TELAS.md`)

### PEN-056 — Documento de pessoa física somente CPF

- **Prioridade:** P1
- **Bloqueia:** `COR-003`, `COR-016`
- **Questão:** o responsável decidiu em 2026-10-25 que o campo de documento passa a aceitar só CPF (`000.000.000-00`), sem RG. Falta definir: (a) se o CPF vira obrigatório para atletas; (b) o que fazer com atletas sem CPF (estrangeiros, crianças ainda sem CPF); (c) o tratamento dos documentos já gravados que não são CPF válido.
- **Recomendação:** manter o CPF opcional; quando preenchido, validar os dígitos verificadores. Não apagar nem converter os documentos atuais: listar os inválidos e marcá-los para revisão pela diretoria. A mudança vai para `CHANGELOG.md` e para uma decisão técnica, porque altera o que o sistema aceita.
- **Impacto:** formulário de atleta (cadastro, edição e conversões), validação da API, migração de dados.

### PEN-057 — Telefone fixo

- **Prioridade:** P2
- **Bloqueia:** `COR-004`
- **Questão:** o padrão decidido é `(00) 00000-0000` (celular, 11 dígitos). Parceiros, profissionais e o contato do time podem ter telefone fixo (10 dígitos), que não cabe nesse padrão.
- **Recomendação:** pessoas físicas (atleta, responsável, emergência, interessado, inscrição, conta, pedido) só celular; parceiro, profissional e contato do time aceitam também fixo, `(00) 0000-0000`.
- **Impacto:** validação compartilhada de telefone e migração dos telefones gravados.

### PEN-058 — Novas imagens: capa de evento, capa de parceiro e logo do parceiro nos produtos

- **Prioridade:** P2
- **Bloqueia:** `COR-011` (parte com banco), `COR-013`, `COR-014`
- **Questão:** os pedidos exigem campos novos (`Event.coverMediaFileId`, capa do parceiro) e a inclusão da logo do parceiro na resposta pública de produtos. São funcionalidades fora das fases 0 a 8 do roadmap e precisam de aprovação explícita.
- **Recomendação:** aprovar as três, reutilizando o fluxo de upload público da capa de notícia (PNG, JPG ou WebP até 5 MB, tipo real conferido no servidor). As imagens são públicas e não podem conter dados pessoais além do que o parceiro autorizar.
- **Impacto:** migração Prisma, endpoints de upload, telas do painel e do site, testes de upload.

### PEN-059 — Testes de integração gravam no banco de desenvolvimento

- **Prioridade:** P1
- **Bloqueia:** `COR-001`; confiabilidade da avaliação visual do site
- **Questão:** os testes de integração usam o mesmo `DATABASE_URL` do desenvolvimento e não apagam o que criam. Em 2026-10-25 o banco local tinha 16 equipes, das quais 14 criadas por teste ("Feminino 1792…"), além de produtos e remessas de teste que aparecem no site como reais ("Camisa jogo 93ef3", "Remessa 50202").
- **Recomendação:** banco próprio para testes (`DATABASE_URL_TEST`), recriado a cada execução e recusado se for igual ao de desenvolvimento; script de limpeza do banco de desenvolvimento por exclusão lógica, sem tocar em registros financeiros confirmados.
- **Impacto:** configuração do Jest de integração, `README.md`, `docs/14-TESTES.md`, CI.
- **Situação:** resolvida em 2026-10-25 (`DT-038`). Ver seção 12.

### PEN-060 — Efeito de inativar ou suspender atleta sobre mensalidades, plano e vínculos

- **Prioridade:** P1
- **Bloqueia:** `COR-018`
- **Questão:** hoje Inativo e Suspenso só impedem novas mensalidades. As mensalidades em aberto, o plano vigente e os vínculos com equipes continuam como estavam. Não há regra documentada sobre o que deve acontecer.
- **Recomendação:** não automatizar sem decisão. Mostrar no diálogo de mudança de status o que está pendente e oferecer, como opções marcáveis, cancelar mensalidades futuras sem pagamento, encerrar o plano e encerrar os vínculos, com o mesmo motivo e auditoria. Mensalidades com pagamento nunca são canceladas por essa ação.
- **Impacto:** domínio esportivo e financeiro, diálogo de status, testes de transição.

### PEN-061 — Faixa etária da categoria

- **Prioridade:** P3
- **Bloqueia:** `COR-019`
- **Questão:** a categoria tem idade mínima e máxima, mas o vínculo do atleta não confere a idade. Não está definido se a faixa é informativa ou obrigatória.
- **Recomendação:** aviso com confirmação, sem bloqueio, porque atletas podem jogar fora da faixa por decisão técnica.
- **Impacto:** vínculo de atleta (serviço e tela).

## 11. Critério de resolução

Ao resolver uma pendência:

1. registrar decisão e aprovador;
2. atualizar requisitos, regras, modelo, fluxos e testes afetados;
3. adicionar ou atualizar a decisão em `docs/17-DECISOES-TECNICAS.md`;
4. mover a entrada para uma seção “Resolvidas”, sem apagar o histórico;
5. atualizar `CHANGELOG.md`.

## 12. Resolvidas

As entradas acima permanecem como histórico da questão original. As decisões abaixo foram tomadas em 2026-10-18 pelo responsável único do projeto (Product Owner e responsável técnico, financeiro, de privacidade e de segurança até nova designação), que delegou ao agente de desenvolvimento as decisões técnicas e a adoção das recomendações já documentadas.

| Pendência | Decisão | Aprovador | Registro |
|---|---|---|---|
| PEN-001 | Documentos de `docs/` aprovados como baseline v1.2; o PDF continua como origem rastreável. | Responsável do projeto | `DT-021` |
| PEN-002 | Há um único responsável por todas as áreas até nova designação. Alçadas que exigiriam segregação de funções ficam como permissões separáveis, prontas para distribuição futura. | Responsável do projeto | `DT-021` |
| PEN-004 | Paleta oficial derivada do brasão enviado pelo responsável: `#CD151D` (vermelho), `#9E0F16` (vermelho escuro), `#0B0613` (preto) e branco. | Responsável do projeto | `12-IDENTIDADE-VISUAL.md` |
| PEN-007 | Matriz adotada conforme `05-PERFIS-E-PERMISSOES.md` com papéis de sistema `admin`, `board` (diretoria), `athlete` e `user`; negação por padrão. | Delegada | `DT-022` |
| PEN-008 | Cadastro livre cria conta `user` ativa; atleta, diretoria e administrador são atribuídos somente por administrador e auditados. Interessado/inscrição não criam acesso automaticamente. Verificação de e-mail não bloqueia o login nesta versão. | Responsável do projeto | `DT-022` |
| PEN-010 | Parcialmente resolvida: conta própria exige declaração de idade mínima de 12 anos; atleta menor de 18 exige nome e telefone do responsável; atleta menor de 12 só é cadastrado pela diretoria com registro de ciência do responsável. **Revisão jurídica recomendada antes de dados reais.** | Responsável do projeto | `DT-026` |
| PEN-013 | Access token de 15 min em memória; refresh opaco rotativo de 30 dias em cookie `HttpOnly`/`SameSite=Strict`, com hash no banco, revogação e detecção de reuso; rate limiting nas rotas de autenticação. MFA administrativo permanece pendente antes da produção. | Delegada | `DT-022` |
| PEN-018 | Sem multa ou juros automáticos; descontos e isenções são manuais e motivados; valor da cobrança é preservado. | Responsável do projeto | `DT-027` |
| PEN-019 | Pagamentos parciais permitidos; cobrança fica `PARTIALLY_PAID` até a soma confirmada atingir o valor e então `PAID`; excedente é recusado. Confirmação é idempotente. | Responsável do projeto | `DT-027` |
| PEN-021 | BRL e arredondamento comercial em duas casas; escala conforme schema. | Delegada | `DT-006` |
| PEN-020 | Parcialmente resolvida: plano de contas provisório semeado (receitas, despesas, transferências e categorias de sistema); validação contábil pendente. | Delegada | `DT-030` |
| PEN-022 | Saldo inicial como lançamento único e auditado por conta. | Delegada | `DT-030` |
| PEN-023 | Fechamento por conta e período; bloqueio de datas fechadas; reabertura com permissão e motivo. Periodicidade fica a critério da diretoria. | Delegada | `DT-030` |
| PEN-024 | Transferência com duas pernas vinculadas; estorno e reembolso como novos lançamentos vinculados. | Delegada | `DT-030` |
| PEN-025 | Parcialmente resolvida: contas a pagar/receber com competência, vencimento, quitação e cancelamento; recorrência e parcelamento ficam para evolução. | Delegada | `DT-030` |
| PEN-027 | Reserva no checkout, saída efetiva no pagamento confirmado, expiração configurável (72 h). | Delegada | `DT-031` |
| PEN-028 | Checkout de visitante permitido com dados mínimos; retirada combinada com o time; frete fora do escopo atual. | Delegada | `DT-031` |
| PEN-029 | Estoque e SKU na variação; preço por variação; promoção simples (sem período); limite por comprador; preço congelado no item. | Delegada | `DT-031` |
| PEN-031 | Máquina de estados de remessa, extensão por reabertura, configuração imutável após encomenda e relatório conferível. Reabertura após encomenda não é permitida (cancelar e criar nova). | Delegada | `DT-032` |
| PEN-032 | Parcialmente resolvida: cobrança antes da encomenda, mínimo pago verificado, estorno vinculado; o texto da política de devolução precisa ser aprovado e publicado em cada remessa. | Delegada | `DT-032` |
| PEN-034 | Parcialmente resolvida: aprovação exige vigência; venda e publicação só dentro da vigência; documentos confidenciais com acesso auditado. Textos contratuais, tributação e responsabilidades seguem com o responsável. | Delegada | `DT-033` |
| PEN-035 | Comissão percentual, fixa por unidade ou nenhuma, com sobreposição por produto e snapshot no item; repasse agrupado, aprovado e pago com saída única no Caixa. Documento fiscal fica fora do sistema. | Delegada | `DT-033` |
| PEN-036 | Parceiro sem login nesta versão; a diretoria opera; o profissional recebe e-mail de confirmação e cancelamento. | Delegada | `DT-033` |
| PEN-037 | Parcialmente resolvida: agendamento manual por horários livres, confirmação pela diretoria, cancelamento com motivo, realizado/ausência; antecedência mínima, recorrência e avaliações continuam abertas. | Delegada | `DT-033` |
| PEN-038 | Notícia é a fonte única; página inicial e comunicados do fórum são canais sobre a mesma linha; evento e seletiva relacionados por referência. | Delegada | `DT-034` |
| PEN-039 | Parcialmente resolvida: fórum com participação de contas ativas autenticadas, visibilidades pública/membros/diretoria, moderação motivada e auditada, exclusão lógica e limites antiabuso. Política publicada de convivência, SLA e recurso continuam com o responsável. | Delegada | `DT-034` |
| PEN-040 | Parcialmente resolvida: avisos e notificações somente in-app; e-mail transacional pelo adaptador local até a escolha do provedor (`PEN-042`); preferências por finalidade e WhatsApp seguem abertos. | Delegada | `DT-034` |
| PEN-047 | Parcialmente resolvida: revisão da Fase 8 confirmou idioma, atalho para o conteúdo, foco visível, movimento reduzido, rótulos associados e contraste AA dos tokens (mínimo 5,64:1). Teste com leitor de tela e navegadores-alvo segue pendente. | Delegada | `DT-035` |
| PEN-049 | Parcialmente resolvida: paginação por offset limitada; exportação CSV síncrona com período de até 2 anos, permissão própria e auditoria. Exportação assíncrona e concorrência otimista ficam para quando houver volume medido. | Delegada | `DT-035` |
| PEN-050 | Parcialmente resolvida: linha de base local medida (485 req/s, p95 até 89 ms nas rotas públicas) com `scripts/load-test.mjs`; metas de SLO e limites por rota em produção continuam com o responsável. | Delegada | `DT-035` |
| PEN-013 (MFA) | Decidido em 2026-10-20: login em duas etapas por aplicativo autenticador (TOTP) obrigatório para administrador e diretoria (quem acessa o painel). Implementado em 2026-10-25, com códigos de recuperação e redefinição auditada. | Responsável do projeto | `DT-037` |
| PEN-044 | Decidido em 2026-10-20: backup diário de madrugada, entre 01h e 03h (fuso do time); perda máxima aceitável de 1 dia de dados (RPO 24 h) e até 1 dia fora do ar (RTO 24 h). Retenção e teste periódico de restauração seguem a recomendação do runbook até a escolha do provedor. | Responsável do projeto | `15-DEPLOY-E-INFRAESTRUTURA.md` §10.1 |
| PEN-042 | Adiada pelo responsável em 2026-10-20: o sistema é um protótipo funcional em desenvolvimento; provedores serão escolhidos antes da homologação. | Responsável do projeto | — |
| PEN-043 | Web e API sob a mesma origem pública: o Next.js encaminha `/api/v1` para a API; CORS restrito à lista explícita. | Delegada | `DT-022` |
| PEN-013 (sessão) | Decidido em 2026-10-25: inatividade de 30 min e duração máxima de 12 h para perfis com permissão administrativa; 7 dias e 30 dias para contas comuns. Substitui o refresh de 30 dias prorrogável. | Responsável do projeto | `DT-036` |
| PEN-059 | Decidido em 2026-10-25: testes de integração em banco exclusivo `<banco>_test`, recriado a cada execução; limpeza auditada do banco de desenvolvimento (`npm run db:clean-test-data`); arquivos fora da pasta do projeto e `npm run backup`. | Responsável do projeto | `DT-038` |
