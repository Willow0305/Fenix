# Perfis e permissões

## Modelo de autorização

O sistema deve combinar papéis (RBAC) com permissões granulares. `DT-007` aceita que um usuário receba múltiplos papéis, e `PEN-007` aprova a matriz documental inicial para a Fase 1. O papel facilita a atribuição inicial, mas cada operação administrativa é validada no servidor por permissão específica e no contexto do recurso. Ser “administrador” não elimina restrições de auditoria, privacidade ou segregação financeira.

## Perfis confirmados e contextos complementares

| Perfil/contexto | Origem | Escopo |
|---|---|---|
| Visitante | RF-007 | Conteúdo público, interesse, seletiva e compra identificada quando habilitada. |
| Usuário cadastrado/comprador | Implícito em RF-017, RF-037 e RF-038 | Perfil e recursos próprios de loja, notificações e serviços permitidos. Não é papel administrativo. |
| Atleta | RF-007, RF-019 | Dados próprios, mensalidades, pagamentos, pedidos, inscrições, agendamentos e fórum conforme visibilidade. |
| Diretoria | RF-007 | Operações de negócio concedidas: atletas, finanças, loja, parceiros, comunicação, relatórios e moderação. |
| Administrador | RF-007, RF-023 | Usuários, papéis, permissões, configurações e governança técnica; operações de negócio somente quando concedidas. |
| Parceiro/profissional | Complemento provisório | Pode confirmar agenda ou consultar operação própria apenas se um portal e suas permissões forem aprovados. |
| Responsável por atleta | Público-alvo, provisório | Acesso depende de vínculo, representação, escopo e regras para menores ainda não definidos. |

## Funções aprovadas para a Fase 1

A matriz documental aprovada em 24/07/2026 define estes perfis como referência inicial de implementação:

| Perfil | Diretriz de acesso |
|---|---|
| Administrador | Acesso total às funções administrativas, restrito a poucas pessoas de confiança, sempre com auditoria para ações sensíveis. |
| Diretoria | Acesso administrativo conforme função, podendo consultar relatórios, acompanhar módulos operacionais e aprovar/rejeitar solicitações quando autorizado. |
| Atleta | Acesso à própria conta, dados cadastrais, mensalidades, comunicados, eventos, loja, favoritos e fórum conforme regras de visibilidade. |
| Responsável Legal | Acesso limitado ao atleta vinculado quando aplicável; obrigatório para atleta menor de idade antes de uso completo com dados reais, condicionado a `PEN-010`. |
| Moderador | Moderação de fóruns, comentários e interações, com registro de autor, alvo, motivo, data/hora e penalidade. |
| Financeiro | Controle de entradas, saídas, comprovantes, relatórios, contas a pagar/receber e status de pagamentos. |
| Tesoureiro | Autoridade financeira para aprovar/rejeitar despesas, confirmar pagamentos, fechar caixa, autorizar reembolsos e corrigir movimentações mediante justificativa. |
| Assistente Financeiro | Apoio ao registro financeiro; ações sensíveis permanecem pendentes de aprovação do Tesoureiro. |
| Parceiro | Acesso não administrativo e limitado aos próprios produtos, estoque, pedidos, mensagens e vendas quando liberado. |
| Comunicação Externa | Comunicação institucional com parceiros, fornecedores, imprensa e patrocinadores, sem acesso automático a finanças, dados sensíveis ou administração geral. |

### Diretoria e responsáveis informados

| Área | Função | Responsável |
|---|---|---|
| Executiva Administrativa | Presidente | André |
| Executiva Administrativa | Vice-presidente | A definir |
| Executiva Administrativa | Diretor Financeiro | Raily |
| Executiva Administrativa | Diretor Jurídico | Kaká |
| Executiva Administrativa | Secretário Geral | William |
| Esportiva | Diretor de Vôlei | A definir |
| Comissão Técnica Masculina | Técnico Principal | A definir |
| Comissão Técnica Masculina | Auxiliar Técnico | A definir |
| Comissão Técnica Feminina | Técnico Principal | André |
| Comissão Técnica Feminina | Auxiliar Técnico | A definir |
| Comissão Técnica Feminina | Auxiliar Técnico | Menezes |
| Marketing, Comunicação e Comercial | Diretor de Marketing | André |
| Marketing, Comunicação e Comercial | Social Media | Kaká e Madu |
| Marketing, Comunicação e Comercial | Designer Gráfico | Vinícius |
| Marketing, Comunicação e Comercial | Gerente Comercial | Vinícius |
| Marketing, Comunicação e Comercial | Responsável por Eventos | André |
| Operacional e Logística | Responsável por Material Esportivo | André |
| Base, Formação e Projetos Sociais | Coordenador de Projetos Sociais | Beatriz |

Conselheiros cadastrados: Lucas Cavalcante, Faby, Mellanie, Primo, Adê, Guillermo, Márcio, Yago, Jan, Éder, Gabriela e Ervelyn. O acesso de conselheiro é consultivo por padrão e não concede automaticamente ações administrativas, financeiras ou operacionais.

## Legenda da matriz

- `Público`: sem autenticação, apenas dados publicados.
- `Próprio`: autenticado e limitado ao recurso do usuário/atleta.
- `Permissão`: exige permissão granular e contexto autorizado.
- `Provisório`: depende de decisão de negócio/jurídica.
- `—`: não permitido pelo escopo atual.

## Matriz de capacidades

| Capacidade | Visitante | Usuário | Atleta | Diretoria | Administrador | Parceiro |
|---|---|---|---|---|---|---|
| Ver site, times, notícias e produtos públicos | Público | Público | Público | Público | Público | Público |
| Enviar interesse/inscrição em seletiva | Público | Próprio | Próprio | Permissão | Permissão | — |
| Criar conta/login/recuperar senha | Público | Próprio | Próprio | Próprio | Próprio | Provisório |
| Ver/editar perfil próprio | — | Próprio | Próprio | Próprio | Próprio | Provisório |
| Ver dados de atleta | — | — | Próprio | Permissão | Permissão excepcional | — |
| Criar/editar/status de atleta | — | — | — | Permissão | Permissão | — |
| Gerir equipes, seletivas e inscrições | — | — | — | Permissão | Permissão | — |
| Ver mensalidades/pagamentos | — | — | Próprio | Permissão | Permissão excepcional | — |
| Gerar mensalidade/registrar pagamento | — | — | — | Permissão | Permissão | — |
| Ver painel/relatório administrativo | — | — | — | Permissão | Permissão | Provisório limitado |
| Ver Caixa Fênix | — | — | — | Permissão | Permissão excepcional | — |
| Criar lançamento pendente | — | — | — | Permissão | Permissão | — |
| Confirmar/cancelar/estornar lançamento | — | — | — | Permissão específica | Permissão específica | — |
| Conciliar/fechar caixa | — | — | — | Permissão específica | Permissão específica | — |
| Reabrir fechamento | — | — | — | Permissão específica | Permissão específica | — |
| Ver comprovante financeiro | — | — | Próprio quando aplicável | Permissão | Permissão excepcional | Provisório próprio |
| Cadastrar/ajustar produto e estoque | — | — | — | Permissão | Permissão | Provisório próprio |
| Comprar/carrinho | Público identificado | Próprio | Próprio | Próprio | Próprio | Próprio |
| Favoritar | — | Próprio | Próprio | Próprio | Próprio | Próprio |
| Ver pedido | Identificação segura provisória | Próprio | Próprio | Permissão | Permissão | Provisório próprio |
| Alterar estado do pedido/remessa | — | — | — | Permissão | Permissão | Provisório limitado |
| Gerir parceiro/contrato/repasse | — | — | — | Permissão | Permissão | Provisório próprio |
| Consultar serviço/disponibilidade | Público publicado | Próprio | Próprio | Permissão | Permissão | Provisório |
| Solicitar agendamento | Público identificado se aprovado | Próprio | Próprio | Próprio | Próprio | — |
| Confirmar/cancelar agendamento | Próprio: só cancelamento se aprovado | Próprio | Próprio | Permissão | Permissão | Provisório |
| Ler fórum público/restrito | Público | Conforme visibilidade | Conforme visibilidade | Conforme visibilidade | Conforme visibilidade | Provisório |
| Criar tópico/comentar/reagir/denunciar | Conforme política | Próprio e permissão | Próprio e permissão | Permissão | Permissão | Provisório |
| Moderar fórum/notícias | — | — | — | Permissão | Permissão | — |
| Publicar notícia/evento/partida | — | — | — | Permissão | Permissão | — |
| Configurar dados públicos/contatos | — | — | — | Provisório + permissão | Permissão | — |
| Configurar logos | — | — | — | RF-039 + permissão | Permissão | — |
| Gerir usuários/papéis/permissões | — | — | — | — por padrão | Permissão | — |
| Consultar auditoria | — | — | — | Permissão limitada | Permissão | — |

## Catálogo inicial de permissões

Os códigos abaixo são a base técnica inicial para a Fase 1. Nomes definitivos devem coincidir com a API e os testes.

### Recorte físico vigente das Fases 1 a 3

| Papel físico | Permissões efetivas neste recorte |
|---|---|
| `ADMIN` | governança de usuários, papéis, sessões, MFA administrativo, privacidade, retenção e auditoria; não recebe finanças/esportivo implicitamente |
| `BOARD` | `users.read`, `audit.read` e todas as permissões `sports.*`/esportivas da entrega vertical |
| `FINANCE` | leitura, catálogos, planos, cobranças, registro de pagamentos, lançamentos pendentes e obrigações; sem aprovação |
| `FINANCE_ASSISTANT` | mesmo recorte operacional pendente de decisão do tesoureiro |
| `TREASURER` | todas as permissões `finance.*`, incluindo conciliação, aprovação, reversão, transferências e fechamento |
| `USER` | nenhuma capacidade administrativa |

O papel `ADMIN` é protegido contra alteração de seu catálogo e o sistema impede
remover, bloquear ou inativar o último administrador ativo. Contas
`BLOCKED`/`INACTIVE` e sessões revogadas não autenticam. O menu do frontend é
derivado das permissões, mas a API continua sendo a autoridade.

MFA é obrigatório para todos os papéis privilegiados acima. A separação entre
`ADMIN`, `BOARD` e funções financeiras é intencional: administração técnica não
concede acesso automático a cadastro esportivo ou razão financeiro.

| Domínio | Permissões mínimas |
|---|---|
| Usuários | `users.read`, `users.create`, `users.update`, `roles.assign`, `permissions.manage`, `sessions.revoke` |
| Atletas | `sports.read`, `athletes.read`, `athletes.create`, `athletes.update`, `teams.assign`, `guardians.manage` |
| Inscrições | `registrations.read`, `registrations.review`, `registrations.convert`, `tryouts.manage` |
| Caixa | `finance.read`, `finance.catalogs.manage`, `finance.plans.manage`, `finance.charges.manage`, `finance.payments.record`, `finance.payments.reconcile`, `finance.entries.create`, `finance.entries.approve`, `finance.reverse`, `finance.transfers.manage`, `finance.obligations.manage`, `finance.cash.operate`, `finance.cash.close` |
| Arquivos | `files.upload`, `files.read.restricted`, `files.delete.logical` |
| Loja | `products.manage`, `inventory.adjust`, `orders.read`, `orders.status.change`, `campaigns.manage` |
| Parceiros | `partners.manage`, `partner.documents.read`, `services.manage`, `appointments.manage`, `settlements.manage` |
| Comunicação | `forum.publish`, `forum.moderate`, `news.manage`, `events.manage`, `notifications.send` |
| Configuração | `settings.public.manage`, `settings.financial.manage`, `logos.manage` |
| Governança | `reports.export`, `audit.read`, `privacy.requests.manage` |

## Restrições contextuais obrigatórias

1. Permissão de leitura não concede exportação.
2. Acesso a um recurso próprio deve validar titularidade no servidor, não apenas o ID recebido.
3. Operações em períodos financeiros fechados exigem regra explícita e, quando aplicável, reabertura.
4. Dados de parceiro, comprovante, auditoria e finanças não ficam públicos por herança de outra permissão.
5. Moderação não autoriza editar silenciosamente autoria ou histórico.
6. Administrador não deve visualizar conteúdo pessoal/financeiro por padrão quando não precisa operá-lo.
7. Contas bloqueadas, inativas ou sessões revogadas não executam operações autenticadas.
8. Alterações de papéis, pagamentos, fechamentos, reaberturas, estoque e moderação são auditadas.

## Segregação de funções

| Operação sensível | Recomendação provisória | Motivo |
|---|---|---|
| Criar e confirmar lançamento | Permissões separadas; dupla aprovação conforme risco/valor a definir | Reduz fraude e erro |
| Fechar e reabrir caixa | Reabertura mais restrita e sempre motivada | Preserva confiança do fechamento |
| Cadastrar parceiro e aprovar contrato/repasse | Permissões separáveis | Reduz conflito comercial |
| Ajustar estoque e confirmar pedido | Auditoria e revisão periódica | Evita estoque artificial |
| Publicar e moderar conteúdo | Permissões separáveis | Preserva governança editorial |
| Administrar papéis e consultar auditoria | Registro reforçado; evitar autoelevação irrestrita | Protege o próprio controle de acesso |

Limites monetários, necessidade de dupla aprovação e incompatibilidades de papéis ainda não foram definidos pelas fontes.

## Resolução de conflitos de fonte

- `RF-023` reserva configurações do sistema ao administrador; `RF-039` permite à diretoria configurar logos. Até decisão final, logos e configurações são permissões independentes.
- A frase “diretoria ou parceiro” de `RF-034` não cria automaticamente um papel autenticável de parceiro. A diretoria executa a confirmação até o portal ser aprovado.
- Responsável por atleta é público-alvo, não perfil autorizado definido. Nenhuma delegação de acesso deve ser presumida.
- Pedido de visitante exige mecanismo seguro de consulta ainda não definido; não se deve usar apenas um identificador previsível.

## Critérios de teste da autorização

Para cada operação protegida devem existir, no mínimo:

- caso autorizado;
- usuário autenticado sem permissão;
- usuário não autenticado;
- usuário com permissão sobre recurso de outro contexto;
- conta/sessão inativa ou revogada;
- entrada que tenta forçar papel, proprietário ou estado;
- verificação do evento de auditoria quando a ação for sensível.
