# Fluxos do sistema

## Padrão de descrição

Cada fluxo identifica atores, pré-condições, caminho principal, exceções, resultado e rastreabilidade. Transições marcadas como provisórias não devem ser implementadas antes da decisão correspondente.

## FL-01 — Navegação pública

**Atores:** visitante ou usuário autenticado.

**Pré-condição:** conteúdo público publicado e aplicação disponível.

**Fluxo principal:**

1. A pessoa acessa a página inicial.
2. O sistema apresenta identidade Fênix, time, destaques e chamadas para inscrição, loja e contato.
3. A pessoa navega para times, notícias, eventos, seletivas, parceiros ou loja.
4. Conteúdo restrito solicita autenticação e não é incluído na resposta pública.

**Exceções:** conteúdo inexistente produz estado vazio; indisponibilidade parcial oferece mensagem e tentativa posterior sem expor detalhe interno.

**Resultado:** navegação pública acessível e rastreável por métricas sem identificar desnecessariamente o visitante.

**Rastreabilidade:** RF-001, RF-002, RNF-001, RNF-015.

## FL-02 — Cadastro de interessado

**Atores:** visitante.

1. A pessoa abre “Interesse em participar”.
2. O sistema informa finalidade e aviso de privacidade.
3. A pessoa preenche nome, contato, nascimento, posição e observações.
4. O servidor valida formato, limites e campos obrigatórios aprovados.
5. O sistema persiste o registro e confirma o recebimento.

**Exceções:** duplicidade e regra para menor ainda são provisórias; entrada inválida não é parcialmente salva.

**Resultado:** interessado criado sem gerar automaticamente conta, atleta ou inscrição em seletiva.

**Rastreabilidade:** RF-003, RN-ATL-001, RNF-004.

## FL-03 — Inscrição e análise de seletiva

**Atores:** interessado, diretoria autorizada.

1. O interessado escolhe uma seletiva que aceita inscrições.
2. Consulta data, local, equipe/categoria, período e aviso de privacidade.
3. Envia dados; o servidor revalida seletiva e inscrição.
4. A inscrição nasce como `nova`.
5. A diretoria lista e move para `em análise`.
6. A diretoria registra `aprovada` ou `recusada`.
7. No evento, registra `compareceu`; “não compareceu” depende de ratificação.
8. Se virar atleta, o novo cadastro mantém vínculo com a inscrição.

**Exceções:** seletiva encerrada, lotada ou cancelada não aceita nova inscrição; duplicidade e reversões seguem regra ainda pendente.

**Resultado:** histórico de inscrição e decisões preservado.

**Rastreabilidade:** RF-004, RF-008, RF-010, RF-022, RF-024.

## FL-04 — Conta, autenticação e recuperação

**Atores:** visitante, usuário, administrador.

1. A pessoa cria conta ou recebe convite/aprovação.
2. O servidor valida e-mail e senha; papel privilegiado não vem do cliente.
3. Credenciais válidas iniciam sessão limitada e renovável conforme decisão técnica.
4. Logout revoga/invalida a sessão aplicável.
5. Na recuperação, o usuário informa e-mail e recebe resposta indistinguível.
6. Token único, limitado e expirável permite definir nova senha e revoga sessões conforme política aprovada.

**Exceções:** repetidas tentativas sofrem limitação; conta bloqueada/inativa não acessa; verificação de e-mail é futura/condicionada.

**Resultado:** sessão autenticada ou recuperação concluída sem revelar segredos.

**Rastreabilidade:** RF-005 a RF-007, RNF-003, RNF-005.

## FL-05 — Cadastro e vínculo do atleta

**Atores:** diretoria com permissão, atleta para consulta própria.

1. A diretoria cria ou conclui cadastro a partir de inscrição aprovada.
2. O servidor valida campos e duplicidades aprovados.
3. A diretoria define status, categoria e posição.
4. Vincula o atleta a equipe com início e, quando aplicável, fim.
5. Edições importantes registram autor e histórico.
6. O atleta autenticado consulta apenas os próprios dados.

**Exceções:** inativar/suspender e os impactos financeiros precisam de regra; prontuário/dado de saúde é rejeitado por estar fora do escopo.

**Rastreabilidade:** RF-008 a RF-010, RF-019, RF-024.

## FL-06 — Geração e pagamento de mensalidade

**Atores:** diretoria financeira, atleta.

1. A diretoria mantém plano ativo e vínculo do atleta.
2. Rotina autorizada gera mensalidade com referência, vencimento e valor aplicado.
3. O atleta consulta cobrança aberta/atrasada.
4. A diretoria registra pagamento manual/PIX e comprovante quando cabível.
5. Ao confirmar, uma operação transacional atualiza a situação e cria/vincula entrada do Caixa exatamente uma vez.
6. O atleta recebe notificação e consulta pagamento.

**Exceções:** repetição é idempotente; falha em caixa desfaz/compensa a confirmação; parcial, multa, desconto e cancelamento são provisórios.

**Rastreabilidade:** RF-011 a RF-014, RF-022, RF-028, RF-029, RNF-019.

## FL-07 — Lançamento manual no Caixa

**Atores:** diretoria financeira autorizada.

1. O usuário seleciona conta, tipo, categoria/centro de custo, moeda e datas.
2. Informa valor Decimal, descrição, status e anexos aplicáveis.
3. O servidor valida período, conta/categoria ativas e permissões.
4. O lançamento é criado pendente ou confirmado conforme política.
5. Confirmação passa a compor o saldo derivado.
6. Correção posterior usa cancelamento/estorno/reembolso vinculado, nunca edição destrutiva.

**Exceções:** período fechado bloqueia ação incompatível; anexo inválido é rejeitado; aprovação e obrigatoriedade de comprovante são provisórias.

**Rastreabilidade:** RF-025 a RF-028, RNF-017, RNF-018.

## FL-08 — Transferência, conciliação, fechamento e reabertura

**Atores:** diretoria financeira com permissões específicas.

1. Transferência cria lados de saída/entrada vinculados entre contas.
2. Na conciliação, o usuário seleciona conta/período e compara registros ao saldo externo/contado.
3. Registra diferenças e observações.
4. Fecha o período, registrando responsável e instante.
5. Operações incompatíveis ficam bloqueadas.
6. Se necessário, usuário com permissão superior reabre com motivo; o evento não substitui o fechamento anterior.

**Exceções:** valor/moeda divergente invalida transferência; período sobreposto e regras de corte dependem de decisão.

**Rastreabilidade:** RF-030, RCF-003, RCF-006, RN-FIN-009 a RN-FIN-012.

## FL-09 — Compra de produto em estoque

**Atores:** usuário autenticado ou visitante identificado, diretoria da loja.

1. Comprador localiza produto disponível e escolhe variação/quantidade.
2. Adiciona ao carrinho; servidor verifica limites e disponibilidade.
3. Revisa identificação, itens, preços e total.
4. Ao finalizar, o servidor revalida tudo e cria pedido de forma atômica.
5. Pedido segue de `criado` para `aguardando pagamento`.
6. Confirmação de pagamento gera entrada no Caixa uma única vez.
7. Pedido segue para `pago`, `separado` e `entregue`.

**Exceções:** preço/estoque alterado exige confirmação do comprador; falha não cria pedido parcial; consulta de visitante exige segredo/mecanismo ainda a definir.

**Rastreabilidade:** RF-015 a RF-018, RF-029, RF-037, RNF-019.

## FL-10 — Campanha/remessa

**Atores:** diretoria da loja, comprador, fornecedor/malharia como ator externo.

1. A diretoria cria campanha com produto/variações, período, limites e previsões.
2. Abre a venda; fora do período a compra é bloqueada.
3. Compradores realizam pedidos vinculados à campanha.
4. No encerramento, o sistema consolida quantidades/variações.
5. Se a regra aprovada for atendida, a diretoria registra envio à malharia e acompanha produção.
6. Se não for atendida, cancela a campanha e inicia reembolsos vinculados.
7. Na chegada, registra recebimento e notifica compradores.
8. A retirada é confirmada e auditada.

**Exceções:** mínimos, prazos, cancelamento parcial e reembolso são políticas pendentes; reabertura de venda não é presumida.

**Rastreabilidade:** RF-035, RF-036, RF-044, RCF-009.

## FL-11 — Reembolso de pedido

**Atores:** diretoria financeira/loja autorizada.

1. Usuário identifica pedido, pagamento e motivo elegível.
2. O servidor valida valor já reembolsado e período financeiro.
3. Registra reembolso vinculado ao pagamento/pedido.
4. Gera saída correspondente no Caixa.
5. Atualiza o pedido/campanha sem apagar pagamento original.
6. Notifica comprador e audita.

**Exceções:** elegibilidade, reembolso parcial e retorno ao estoque dependem de política; repetição não duplica saída.

**Rastreabilidade:** RCF-005, RN-FIN-005 a RN-FIN-007.

## FL-12 — Parceiro, profissional e agendamento

**Atores:** diretoria; usuário/atleta; visitante somente se a solicitação pública for aprovada; parceiro somente se o portal for aprovado.

1. A diretoria cadastra e aprova parceiro, documentos e regra comercial.
2. Vincula produto ou profissional/serviço e publica somente dados autorizados.
3. Pessoa autorizada pela jornada aprovada consulta profissional, serviço e disponibilidade.
4. Envia solicitação; ela não é confirmação.
5. Diretoria ou parceiro autorizado confirma, propõe horário ou cancela.
6. Sistema notifica partes e preserva histórico.
7. Vendas/serviços permitem apurar receita e valor devido ao parceiro.

**Exceções:** conflito de agenda, antecedência, cobrança, ausência, avaliações, solicitação por visitante e perfil de parceiro são provisórios em `PEN-037`, `PEN-028` e `PEN-036`; dados de saúde são rejeitados.

**Rastreabilidade:** RF-031 a RF-034, RCF-010, RCF-011.

## FL-13 — Fórum, denúncia e moderação

**Atores:** visitante/usuário conforme visibilidade, moderador.

1. O sistema lista categorias e tópicos visíveis ao ator.
2. Usuário autorizado cria tópico, comenta ou reage.
3. Usuário autorizado denuncia conteúdo; denúncia é restrita à moderação.
4. Moderador avalia e pode ocultar/remover logicamente, fechar ou fixar conforme permissão.
5. Ação de moderação registra motivo, autor e histórico.

**Exceções:** spam aciona limitação; conteúdo restrito não aparece nem em contagem pública; política editorial e recurso são provisórios.

**Rastreabilidade:** RF-040, RF-043, RCF-012, RNF-020.

## FL-14 — Notícia, evento e publicação multicanal

**Atores:** diretoria editorial.

1. O autor cria rascunho de notícia com conteúdo, mídia e metadados.
2. Opcionalmente relaciona evento/partida existente.
3. Escolhe publicação imediata/agendada e canais: início, fórum, calendário/eventos, notificações.
4. O servidor valida permissão, datas, slug e mídia.
5. Uma única fonte passa a ser exibida nos canais selecionados.
6. Ocultação/arquivamento reflete nos canais e preserva auditoria.

**Exceções:** falha de canal não deve duplicar conteúdo; política de revisão editorial é provisória.

**Rastreabilidade:** RF-041, RF-042, RCF-001, RCF-013.

## FL-15 — Configuração do time e logos

**Atores:** administrador e diretoria conforme permissão provisória.

1. Usuário abre configurações e seleciona seção.
2. Edita dados públicos/privados ou envia logo para contexto específico.
3. O servidor valida campos, arquivo, visibilidade e autorização.
4. Interface mostra pré-visualização.
5. Confirmação publica sem deploy e registra autoria.

**Exceções:** paleta canônica e permissão da diretoria ainda dependem de decisão; logo da parceria Floresta não pode tornar-se marca permanente.

**Rastreabilidade:** RF-023, RF-039, RCF-014, RNF-021.

## FL-16 — Upload protegido

**Atores:** usuário com permissão no contexto.

1. Cliente solicita envio para um tipo de arquivo e entidade autorizados.
2. Servidor verifica permissão, extensão, limites e propósito.
3. Conteúdo tem MIME real e integridade validados.
4. Arquivo vai para armazenamento controlado; banco recebe somente metadados/chave/URL segura.
5. Leitura usa autorização e URL assinada quando necessária.
6. Exclusão lógica/retenção seguem a categoria do arquivo.

**Exceções:** arquivo malicioso, divergência de MIME, excesso de tamanho ou vínculo inexistente é rejeitado e registrado sem armazenar conteúdo em log.

**Rastreabilidade:** RF-028, RF-039, RNF-018.

## FL-17 — Relatório e exportação autorizada

**Atores:** diretoria ou administrador com permissão específica; parceiro somente se o portal e o relatório próprio forem aprovados.

1. O usuário seleciona um tipo de relatório, período, filtros, conta/contexto e moeda quando aplicáveis.
2. O servidor autentica, autoriza o escopo e minimiza colunas antes de consultar.
3. A consulta usa uma visão consistente dos dados e deriva saldos/totais das fontes transacionais.
4. A interface apresenta período, fuso, moeda, filtros, instante de geração e avisos de dados pendentes.
5. Exportação exige permissão própria e registra ator, finalidade quando exigida, filtros, formato e instante.
6. Geração síncrona ou assíncrona, formatos e limites de volume seguem a decisão de `PEN-049`.

**Exceções:** período inválido, escopo sem permissão, dado ainda não conciliado ou volume acima do limite aprovado não produz arquivo parcial nem amplia acesso. Uma geração longa informa estado sem expor localização pública do arquivo.

**Resultado:** relatório reproduzível e conciliável, com exportação minimizada e auditável quando autorizada.

**Rastreabilidade:** RF-021, RF-045, RNF-017, RNF-019, `PEN-049`.

## Regras comuns de erro e recuperação

- Operações transacionais falham por inteiro ou executam compensação documentada.
- Repetição de confirmação, webhook futuro ou comando crítico deve ser idempotente.
- Mensagem ao usuário indica ação possível, sem stack trace, segredo ou dado de terceiro.
- Erro recebe identificador de correlação; logs estruturados minimizam dados pessoais.
- Alteração concorrente não deve sobrescrever silenciosamente estado financeiro, estoque, agenda ou moderação.
- Toda alternativa manual deve manter a mesma autorização e auditoria da automação.
