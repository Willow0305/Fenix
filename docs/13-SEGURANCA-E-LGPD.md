# Segurança, privacidade e LGPD

## Estado e alcance

Este documento define controles mínimos e decisões bloqueadoras. Ele não certifica conformidade nem substitui avaliação jurídica, teste de segurança ou plano de resposta. O Fênix tratará dados pessoais, financeiros, comprovantes e dados prováveis de crianças/adolescentes; por isso, segurança e privacidade são requisitos de produto, não uma etapa final.

## Princípios

- privilégio mínimo e negação por padrão;
- defesa em profundidade;
- validação no servidor e fronteiras explícitas;
- minimização, finalidade, necessidade e transparência;
- proteção desde a concepção e por padrão;
- segregação e rastreabilidade financeira;
- segredos e dados privados fora de código/logs;
- retenção limitada e descarte verificável;
- resposta a incidente preparada antes de produção.

## Classificação inicial da informação

| Classe | Exemplos | Regra mínima |
|---|---|---|
| Pública | notícias publicadas, evento público, produto, contato institucional autorizado | Integridade editorial, proteção contra alteração e cache coerente |
| Interna | configurações não públicas, métricas operacionais, rascunhos | Usuário autenticado e permissão por necessidade |
| Pessoal | nome, contato, nascimento, inscrição, vínculo esportivo, IP quando associado | Finalidade/base legal, acesso contextual, minimização e retenção |
| Financeira/restrita | mensalidade, pagamento, conta, PIX, pedido, comissão, comprovante | Permissão específica, criptografia adequada, auditoria e não exposição pública |
| Credencial/segredo | senha, refresh token, chave, segredo de webhook, credencial de banco | Cofre/ambiente, rotação, nunca em log ou resposta |
| Sensível/fora do escopo | saúde, prontuário, biometria para finalidade não aprovada | Não coletar. Qualquer inclusão exige nova análise jurídica/técnica e fase aprovada |
| Dados de menores | cadastro, contato, nascimento, imagem/vínculo de criança/adolescente | Melhor interesse, transparência adequada e análise LGPD/ECA Digital antes do fluxo |

## Ameaças prioritárias

| Ameaça | Ativos | Controles principais |
|---|---|---|
| Elevação de privilégio/IDOR | atletas, pagamentos, pedidos, auditoria | autorização servidor por ação e recurso, testes negativos, IDs não são autorização |
| Roubo de sessão/credencial | contas administrativas e de atletas | hash adaptativo, cookies/tokens seguros, rotação/revogação, rate limit, reautenticação |
| Injeção/XSS/CSRF | API, fórum, notícias, formulários | validação, parametrização ORM, saída segura, headers, política de sessão e anti-CSRF quando aplicável |
| Upload malicioso/vazamento | comprovantes, logos, imagens, contratos | allowlist, MIME real, tamanho, inspeção, armazenamento privado e URL assinada |
| Duplicidade/concorrência | caixa, pagamento, estoque, agenda | transações, restrições, idempotência, bloqueio/controle de concorrência |
| Alteração/remoção de histórico | financeiro, moderação, auditoria | imutabilidade lógica, correções vinculadas, soft delete e acesso restrito |
| Exposição por log/backup | dados pessoais, tokens, comprovantes | allowlist/redação, criptografia, retenção e controle de acesso |
| Spam/abuso | fórum, cadastro, recuperação | rate limit por risco, denúncia/moderação e observabilidade |
| Dependência comprometida | aplicação/CI | lockfile, atualização, varredura e origem confiável |
| Falha de fornecedor | banco, objeto, e-mail | contrato, backup exportável, portabilidade e plano de continuidade |

## Autenticação e sessão

**Estado do recorte local/teste:** bcrypt com custo configurável (12 no exemplo),
access JWT HS256 de 45 minutos em cookie `HttpOnly`, refresh opaco armazenado como
HMAC, rotação com detecção de reutilização, CSRF de duplo envio vinculado à
sessão, bloqueio temporário por conta e recuperação por código HMAC de uso único.
IP e agente de usuário entram na auditoria somente como hashes contextuais. Em
produção, segredos/pepper com menos de 32 caracteres, CORS ausente ou curinga e
cookies sem a configuração segura impedem a inicialização ou violam o gate
documentado.

Os parâmetros técnicos canônicos são configuráveis e validados na inicialização:
45 minutos de inatividade/access, 30 dias de duração absoluta, código de
recuperação por 10 minutos com até cinco tentativas, cinco falhas de login em
janela de 15 minutos, bloqueio inicial de 15 minutos e verificação de e-mail por
24 horas. MFA TOTP é funcional e obrigatório para `ADMIN`, `BOARD`, `FINANCE`,
`FINANCE_ASSISTANT` e `TREASURER`, com códigos de recuperação de uso único.
Segredo TOTP é criptografado em repouso; tokens e códigos são persistidos somente
como hash. Rate limit distribuído usa Redis e é obrigatório em staging/produção.

- senha nunca é armazenada ou registrada em texto puro;
- senha tem no mínimo doze caracteres nas criações administrativas e fluxos
  operacionais críticos desta entrega;
- usar Argon2id ou bcrypt com parâmetros calibrados no ambiente; a escolha e os parâmetros exigem decisão técnica e benchmark;
- access token tem duração de 45 minutos; renovação da sessão depende de atividade e de refresh rotacionável/revogável;
- recuperação usa código aleatório enviado por e-mail, de uso único, armazenado
  somente como hash e válido por 10 minutos;
- resposta da recuperação não confirma se o e-mail está cadastrado;
- refresh token deve ser rotacionável, revogável e protegido contra reutilização;
- logout revoga a sessão atual e troca de senha revoga as sessões anteriores;
- cookies de sessão, quando usados, devem ser `HttpOnly`, `Secure` em produção e `SameSite` adequado; proteção CSRF é definida conforme arquitetura;
- não guardar token sensível em `localStorage` por conveniência sem decisão/ameaça documentada;
- aplicar limitação e alerta a tentativas de login/recuperação;
- desativar MFA exige senha e código válido; recuperação administrativa é
  restrita, auditada e não pode deixar o último administrador sem acesso seguro;
- verificação de e-mail usa token de uso único, hash, expiração de 24 horas e
  reenvio limitado sem enumerar contas;
- operações de alto risco continuam candidatas a reautenticação adicional
  conforme a topologia final e o risco aprovado.

## Autorização

1. Toda rota administrativa autentica e verifica permissão específica no servidor.
2. Toda consulta de recurso próprio verifica titularidade/vínculo; UUID não prova autorização.
3. Escopo de equipe, conta, parceiro e visibilidade é aplicado na consulta, não filtrado apenas depois.
4. Exportação possui permissão própria e minimiza colunas.
5. Período financeiro fechado bloqueia operação incompatível.
6. Alterações de papel, pagamento, caixa, estoque, parceiro, moderação e configuração são auditadas.
7. Conta inativa/bloqueada e sessão revogada não executam ação.
8. Administração técnica não concede leitura automática de dados financeiros/pessoais.

Consultar a matriz em `05-PERFIS-E-PERMISSOES.md`.

## Validação e segurança da aplicação web

- schemas de entrada nas bordas, com allowlist, tipo, tamanho, formato e limites;
- TypeScript não substitui validação de dados externos;
- Prisma/consultas parametrizadas; SQL bruto somente justificado e parametrizado;
- saída escapada pelo contexto; conteúdo rico, se permitido, passa por sanitização rigorosa;
- CORS restrito às origens/métodos/cabeçalhos necessários por ambiente;
- headers de segurança, incluindo política de conteúdo, definidos e testados antes de produção;
- erros públicos sem stack trace, SQL, caminho, segredo ou existência indevida de recurso;
- rate limiting por rota/ator/risco, sem confiar apenas em IP;
- proteção contra requisições a destinos arbitrários em importações, webhooks ou mídia futura;
- paginação e limites impedem extração/negação de serviço;
- dependências, contêineres e CI passam por varredura e atualização controlada;
- Swagger fica apenas fora de produção em `/docs`, com JSON em `/docs/openapi.json`; a configuração deve ser testada para não expor documentação administrativa em produção.

## Integridade financeira e comercial

- valores em `Decimal`/`NUMERIC` e moeda explícita;
- saldo derivado de movimentações confirmadas;
- pagamento → caixa e pedido → estoque executados com transação/idempotência;
- restrições de unicidade impedem lançamentos automáticos duplicados;
- confirmado não é apagado/regravado para esconder histórico;
- cancelamento, estorno e reembolso mantêm vínculo, autor, instante e motivo;
- fechamento e reabertura têm permissões separadas e auditoria;
- concorrência é testada em confirmação, estoque, reembolso e agenda;
- dados de cartão não são armazenados; eventual gateway deve manter o sistema fora do processamento sensível sempre que possível.

## Uploads e arquivos

| Controle | Exigência |
|---|---|
| Autorização | Validar envio e leitura no contexto da entidade |
| Tipo | Allowlist por finalidade; verificar extensão e MIME real |
| Tamanho | Limite por classe de arquivo, ainda a definir |
| Nome/chave | Gerada pelo servidor; não confiar em nome do usuário |
| Integridade | Hash/checksum e metadados |
| Conteúdo | Inspeção antimalware/decodificação segura conforme risco |
| Armazenamento | Fora do banco, privado por padrão |
| Acesso | URL curta/assinada quando necessário, sem indexação |
| Logs | Somente ID/metadados mínimos; nunca conteúdo |
| Retenção | Política por categoria; exclusão/anonimização verificável quando cabível |
| Resposta | `Content-Disposition` e tipo seguros; impedir execução ativa |

Comprovantes, contratos e documentos de atleta não podem compartilhar política pública com imagens de produto/notícia.

## Segredos, logs e auditoria

- segredos somente em variáveis/serviço apropriado, nunca versionados;
- `.env.example` contém nomes e exemplos inertes, não credenciais reais;
- rotação e revogação têm responsável e procedimento;
- logs estruturados usam ID de correlação e allowlist de campos;
- redigir senha, token, cookie, documento, conteúdo de comprovante, dado bancário e payload sensível;
- auditoria é separada de log técnico, com acesso/retenção próprios;
- valores anterior/novo são registrados apenas quando necessários e permitidos;
- relógio confiável e UTC para eventos;
- falha de auditoria em operação crítica deve ter comportamento definido, não ser ignorada silenciosamente.

## Backup, continuidade e operação

- definir RPO, RTO, frequência, retenção, localização e responsáveis antes de produção;
- criptografar backup e restringir restauração/download;
- testar restauração, não apenas criação;
- incluir banco e metadados necessários à recuperação de arquivos, com consistência entre serviços;
- monitorar disponibilidade, erro, latência, fila, falha de backup, autenticação anômala e eventos críticos;
- documentar rollback, indisponibilidade de fornecedor e recuperação de chave;
- dados de teste/backup seguem a mesma classificação e retenção.

## Resposta a incidente

1. detectar e registrar horário/conhecimento;
2. conter sem destruir evidência;
3. classificar dados, titulares, quantidade, proteção e possíveis danos;
4. envolver responsáveis técnico, de negócio, privacidade/jurídico e comunicação;
5. corrigir/mitigar e preservar linha do tempo;
6. avaliar obrigação de comunicar ANPD e titulares;
7. registrar decisões, comunicações e lições;
8. acompanhar ações corretivas.

A orientação oficial vigente da ANPD informa comunicação pelo controlador à ANPD e aos titulares em até três dias úteis quando um incidente confirmado com dados pessoais puder causar risco ou dano relevante, ressalvado prazo específico. A regra e sua aplicação devem ser verificadas pela assessoria responsável no momento do incidente; o sistema precisa preservar evidências e permitir resposta rápida.

## Programa LGPD

### Inventário inicial de tratamento

| Processo | Dados mínimos previstos | Finalidade | Acesso | Retenção/base legal |
|---|---|---|---|---|
| Conta/autenticação | nome, e-mail, hash, sessões, eventos de segurança | acesso e proteção da conta | próprio + administração estrita | A validar |
| Interesse/seletiva | nome, contato, nascimento, posição, respostas aprovadas | receber/analisar candidatura | diretoria autorizada + titular quando aplicável | A validar antes da Fase 2 |
| Atleta/equipe | cadastro, contato, vínculo, status | gerir participação esportiva | próprio + diretoria | A validar; menores são bloqueador |
| Mensalidade/caixa | cobrança, pagamento, conta, comprovante e auditoria | cobrança, gestão e prestação de contas | financeiro autorizado + titular no próprio contexto | A validar com obrigações de guarda |
| Loja/pedido | identificação, contato, itens, pagamento/retirada | executar pedido e suporte | próprio + operação autorizada | A validar |
| Parceiro/profissional | contato, contrato, comissão, disponibilidade | operar parceria/serviço | diretoria + partes conforme contrato | A validar antes da Fase 6 |
| Fórum/notícia | conta, conteúdo, reação, denúncia, moderação | comunicação e comunidade | conforme visibilidade; denúncia restrita | A validar antes da Fase 7 |
| Logs/auditoria | ator, IP quando necessário, ação, entidade, correlação | segurança, integridade e responsabilização | segurança/auditoria autorizada | A validar por tipo |

“A validar” é intencional: base legal e prazo não devem ser inventados pela equipe técnica.

### Bases legais e transparência

- mapear cada finalidade a hipótese legal com jurídico/encarregado; não usar consentimento como resposta genérica;
- coletar consentimento apenas quando aplicável, de forma livre, informada, destacada e revogável;
- política de privacidade deve refletir dados, finalidade, compartilhamento, retenção, direitos e contato reais;
- termos de uso não substituem aviso de privacidade;
- nova finalidade ou integração exige revisão antes da coleta;
- manter registro de versões e aceite quando necessário.

### Direitos do titular

Preparar canal e processo autenticado para:

- informação e confirmação da existência de tratamento;
- acesso/exportação compreensível;
- correção;
- anonimização, bloqueio ou eliminação quando cabível;
- portabilidade quando aplicável/regulamentada;
- informação sobre compartilhamentos;
- revogação do consentimento e eliminação relacionada, observadas exceções legais;
- revisão/explicação de decisão exclusivamente automatizada, caso venha a existir.

Solicitação recebe protocolo, verificação proporcional de identidade, registro de decisão e resposta no prazo aplicável. Não se deve atender pedido usando mais dados do que o necessário nem revelar dados de terceiros.

### Retenção, exclusão e anonimização

- definir tabela de retenção por finalidade, obrigação e risco;
- soft delete protege histórico, mas não autoriza retenção eterna;
- ao final, eliminar ou anonimizar de modo efetivo, salvo fundamento para guarda;
- registros financeiros/auditoria preservam o que for necessário e restringem o restante;
- exclusão deve propagar para cache, índice, réplica, objeto e backup conforme política;
- arquivo sem vínculo válido entra em rotina de reconciliação/descarte;
- documentar exceções a pedido de eliminação.

## Crianças, adolescentes e ECA Digital — bloqueador jurídico

O produto é ligado a um time de vôlei, coleta data de nascimento e oferece inscrição, conta, fórum, loja e serviços. Portanto, há acesso provável por crianças/adolescentes. Além da LGPD e do melhor interesse, deve-se avaliar a aplicabilidade da **Lei nº 15.211/2025 (ECA Digital)**, em vigor desde 17/03/2026, e do **Decreto nº 12.880/2026**.

A ANPD destaca obrigações relacionadas, entre outros temas, à prevenção/mitigação de riscos, supervisão parental e aferição de idade para serviços direcionados ou de acesso provável por esse público. As orientações sobre aferição estavam em evolução na data desta documentação. Não se escolhe aqui um mecanismo definitivo.

Antes de liberar qualquer jornada acessível a menores, é obrigatório:

1. obter análise jurídica documentada sobre enquadramento e obrigações do Fênix;
2. mapear idades prováveis e jornadas: site, inscrição, conta, loja, fórum e agendamento;
3. avaliar risco e necessidade de aferição etária sem coletar documento/biometria por padrão;
4. definir supervisão/participação de responsável quando aplicável, sem presumir que consentimento resolve toda finalidade;
5. desenhar privacidade e segurança por padrão, com configurações protetivas e linguagem adequada;
6. definir limites de perfilamento, publicidade, contato e interação social;
7. testar acessibilidade, fraude/bypass, minimização e impacto do mecanismo escolhido;
8. registrar avaliação de impacto e acompanhar regulamentação/orientações da ANPD.

**Bloqueio:** Fases 1 e 2 podem preparar a estrutura, mas cadastro/conta/inscrição pública em produção para público provavelmente menor não recebe aceite enquanto essa avaliação e as decisões de idade/supervisão não estiverem concluídas.

Dados de saúde/prontuário continuam fora do escopo, mesmo com responsável.

## Terceiros e operadores

- inventariar hospedagem, banco, objeto, e-mail, observabilidade e futuros gateways;
- contrato define finalidade/instruções, segurança, suboperadores, localização/transferência, incidente, exclusão e retorno;
- conceder mínimo acesso e usar credenciais separadas;
- avaliar transferência internacional quando houver;
- desligamento do fornecedor inclui exportação e eliminação verificável;
- parceiro comercial não recebe dados do titular além do necessário ao serviço/pedido e da base aprovada.

## Gates de segurança e privacidade

Antes de produção:

- [x] aplicação recusa inicialização sem responsáveis de Tecnologia, Privacidade
  e Segurança, contatos de privacidade/segurança, Redis, cookies seguros e aceite
  explícito de release;
- [x] estrutura técnica de solicitação do titular, retenção configurável,
  metadados de anexos privados e auditoria append-only implementada;
- [ ] inventário, finalidades, bases e retenção aprovados;
- [ ] análise LGPD/ECA Digital e de menores concluída;
- [ ] política/termos/canal do titular publicados e coerentes;
- [ ] autenticação, sessão e autorização testadas negativamente;
- [ ] varredura de segredos/dependências sem bloqueador;
- [ ] uploads privados e protegidos;
- [ ] transações/idempotência financeiras testadas;
- [ ] backup restaurado em ensaio;
- [ ] logs e auditoria revisados contra dados privados;
- [ ] resposta a incidente simulada;
- [ ] riscos altos mitigados ou aceitos formalmente.

## Fontes oficiais

- [Lei Geral de Proteção de Dados Pessoais — Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [ANPD — Direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares)
- [ANPD — Crianças e adolescentes](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes)
- [ANPD — ECA Digital, aferição de idade e cronograma regulatório](https://www.gov.br/anpd/pt-br/assuntos/eca-digital)
- [Lei nº 15.211/2025 — ECA Digital](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm)
- [Decreto nº 12.880/2026](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12880.htm)
- [ANPD — Comunicação de incidente de segurança](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis)

## Decisões pendentes

- agentes de tratamento, encarregado/canal e bases por finalidade;
- enquadramento e medidas exigidas pelo ECA Digital;
- mecanismo proporcional de idade/supervisão e acesso do responsável;
- hash e parâmetros, duração exata de inatividade/recuperação, tentativas e bloqueio, refresh, limite de sessões, MFA, verificação de e-mail, CSRF e reautenticação;
- limites de rate, upload e retenção;
- RPO/RTO e localização de dados;
- política de moderação, imagem e conteúdo de menores;
- fornecedores e transferências internacionais;
- prazos e critérios de eliminação/anonimização;
- processo de dupla aprovação/segregação financeira.
