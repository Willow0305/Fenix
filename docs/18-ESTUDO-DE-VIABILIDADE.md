# Estudo de viabilidade

## Conclusão executiva

O Fênix Vôlei é **viável em fases**, com quatro condições:

1. a Fase 0 precisa fechar arquitetura, dados, ambiente e decisões críticas;
2. o financeiro deve começar com processos operacionais mínimos e controles de auditoria;
3. parceiros, menores, anexos e retenção exigem validação jurídica/organizacional;
4. o produto não deve tentar entregar os 28 módulos simultaneamente.

A classificação não equivale a autorização de produção nem a parecer jurídico. Custos e metas precisam ser orçados após estimar usuários, volume de arquivos, tráfego, disponibilidade e suporte.

## Premissas

- equipe inicial pequena e desenvolvimento incremental;
- aplicação web responsiva, sem aplicativo nativo;
- Next.js/React no front-end, Node.js/TypeScript no back-end, PostgreSQL/Prisma;
- pagamento manual/PIX aceitável nas primeiras fases;
- armazenamento externo para arquivos em produção;
- parceiros sob curadoria;
- nenhuma coleta de prontuário ou dado de saúde;
- decisões provisórias são resolvidas antes da fase que delas depende.

## Viabilidade técnica

| Componente | Avaliação | Condições/riscos | Resultado |
|---|---|---|---|
| Next.js/React/TypeScript | Adequado a páginas públicas, painéis responsivos, SEO e componentização | Definir estratégia de renderização, cache e suporte de versões | Viável |
| Node.js/API REST | Adequado aos módulos e à linguagem compartilhada | Limites de módulo e regras não podem ficar em controllers | Viável |
| PostgreSQL/Prisma | Adequado a integridade financeira, relações e relatórios | Modelagem de Decimal, transações, índices e `onDelete` explícito | Viável |
| Monorepo | Favorece tipos/configuração compartilhados para equipe pequena | Evitar acoplamento e automação excessiva | Viável |
| Hospedagem web/API | Serviços modernos ou VPS suportam a stack | Hospedagem compartilhada limitada a PHP não atende | Viável |
| PostgreSQL gerenciado | Reduz operação de backup/alta disponibilidade | Custo cresce com armazenamento, conexões e retenção | Viável e recomendado em produção |
| Armazenamento de arquivos | Objeto externo permite escala e URL assinada | Exige validação, antivírus/inspeção, ciclo de vida e egress | Viável com controles |
| E-mail/notificações | Serviços transacionais atendem recuperação e avisos | Entregabilidade, consentimento, templates e custo por volume | Viável; integração posterior |
| Backup/recuperação | Tecnologia é madura | RPO/RTO e restauração precisam ser testados | Viável com processo |
| Observabilidade | Logs, métricas e rastreamento são disponíveis | Custo, privacidade e retenção devem ser controlados | Viável |
| Pagamento automático | Integração futura é tecnicamente comum | Webhooks, idempotência, conciliação, taxas e fraude | Viável, fora do MVP inicial |

## Viabilidade operacional

| Processo | Mudança necessária | Risco | Condição de viabilidade |
|---|---|---|---|
| Cadastros | Padronizar campos, status e responsáveis | Duplicidade e baixa qualidade | Dicionário e treinamento antes da migração |
| Diretoria | Migrar de mensagens/planilhas para filas e painéis | Resistência ou operação paralela | Treinamento curto, guia e responsável por módulo |
| Financeiro | Categorizar, anexar, conciliar e fechar periodicamente | Saldo sem confiança | Plano de contas, segregação e rotina de fechamento |
| Loja | Manter produto, preço, variação e estoque | Venda sem disponibilidade | Responsável e reconciliação de estoque |
| Remessas | Controlar prazo, consolidação, produção e retirada | Reclamações e reembolso manual | Checklist operacional e política publicada |
| Parceiros | Aprovar, contratar, apurar e repassar | Conflito comercial/financeiro | Contrato e regra aplicável antes da oferta |
| Profissionais | Manter agenda e confirmar solicitações | Choques de horário/atendimento | SLA e responsabilidade definidos |
| Fórum/notícias | Publicar e moderar | Spam e comunicação informal confundida com oficial | Política editorial, moderadores e canal oficial |
| Privacidade | Atender titulares e incidentes | Falha de prazo/evidência | Canal, responsáveis e runbook testado |

**Resultado operacional:** viável, desde que cada módulo tenha dono, procedimento e treinamento antes de entrar em produção.

## Viabilidade econômica

### Componentes de custo

| Categoria | Direcionadores | Momento |
|---|---|---|
| Domínio/DNS/TLS | quantidade de domínios e gestão | Desde o lançamento público |
| Hospedagem web/API | tráfego, CPU, memória, regiões e disponibilidade | Fases 1+ |
| Banco gerenciado | armazenamento, backup, conexões, alta disponibilidade | Fases 1+ |
| Armazenamento/CDN | imagens, comprovantes, documentos, download/egress | Fases 1/3+ |
| E-mail/notificações | mensagens, domínio e reputação | Fases 1/3+ |
| Gateway | volume transacionado, método, antecipação e chargeback | Futuro |
| Observabilidade | ingestão e retenção de logs/métricas | Desde produção |
| Segurança | varredura, gestão de segredos, auditoria e resposta | Contínuo |
| Backup/recuperação | retenção, cópia adicional e testes | Antes de produção |
| Manutenção/suporte | horas, plantão, atualização e atendimento | Contínuo |
| Jurídico/privacidade | termos, contratos, bases legais, menores e parceiros | Antes dos módulos afetados |

### Cenários

| Cenário | Perfil | Vantagem | Limite |
|---|---|---|---|
| Piloto controlado | Poucos usuários, recursos de entrada, pagamento manual | Menor custo e aprendizado rápido | Sem garantia de disponibilidade e escala de produção |
| Produção inicial | Serviços gerenciados básicos, backup, domínio, e-mail e monitoramento | Equilíbrio entre custo e operação | Requer orçamento mensal e responsável técnico |
| Crescimento | Banco/serviços ampliados, CDN, filas e observabilidade maior | Escala e confiabilidade | Custos variáveis e governança mais complexa |

Não se registram preços nesta versão porque fornecedor, região, câmbio, volume e SLO ainda não foram escolhidos. A decisão econômica deve comparar custo total mensal, custo de saída/migração e horas operacionais, não apenas a camada gratuita.

**Resultado econômico:** viável com início enxuto, orçamento por fase e limites de consumo; estimativa numérica depende de dimensionamento.

## Viabilidade jurídica e LGPD

O sistema tratará identificação, contato, nascimento, vínculo esportivo, dados financeiros, comprovantes e possivelmente dados de menores. Antes de produção, a organização precisa definir quem atua como controlador/operador, finalidades, bases legais, compartilhamentos, retenção, canal do titular e resposta a incidentes.

A ANPD descreve direitos como informação, confirmação/acesso, correção, bloqueio/eliminação/portabilidade, revogação do consentimento e informação sobre compartilhamento. O tratamento de crianças e adolescentes requer avaliação concreta com prevalência do melhor interesse. Essas referências orientam o desenho, mas a aplicação ao Fênix exige validação jurídica.

| Tema | Condição |
|---|---|
| Base legal | Mapear por finalidade; não usar consentimento por conveniência nem presumir autorização técnica |
| Menores | Verificar idade, representação, transparência adequada e melhor interesse; avaliar LGPD, Lei nº 15.211/2025 (ECA Digital) e Decreto nº 12.880/2026 antes de coletar |
| Financeiro/comprovantes | Restringir acesso, minimizar conteúdo e definir retenção por obrigação/finalidade |
| Parceiros | Contratos definem papel, instruções, segurança, incidente, retenção e responsabilidade |
| Profissionais | Não coletar prontuário/saúde; serviço e agendamento usam dados mínimos |
| Direitos do titular | Canal, autenticação do solicitante, protocolo, prazos e exceções legais |
| Incidentes | Plano deve permitir avaliar risco, registrar e comunicar quando legalmente exigido |
| Termos/políticas | Devem refletir o tratamento real e ter versionamento/aceite quando aplicável |

### ECA Digital

Como inscrições, contas, loja e fórum têm acesso provável por crianças/adolescentes, a aplicabilidade da Lei nº 15.211/2025 (ECA Digital), vigente desde 17/03/2026, e do Decreto nº 12.880/2026 é um **bloqueador jurídico**. A ANPD relaciona o regime à prevenção/mitigação de riscos, supervisão parental e aferição de idade em serviços direcionados ou de acesso provável por esse público.

Antes das jornadas públicas com menores em produção, a organização deve:

- obter análise jurídica documentada de enquadramento;
- mapear faixas etárias e jornadas afetadas;
- avaliar aferição etária e supervisão sem escolher mecanismo invasivo por padrão;
- adotar privacidade e segurança desde a concepção, com configurações protetivas;
- testar minimização, acessibilidade e resistência a bypass;
- acompanhar as orientações da ANPD, ainda em evolução nesta data.

Não se conclui neste estudo qual mecanismo é obrigatório ou suficiente.

**Resultado jurídico:** viável com cuidados e revisão especializada; não iniciar produção com menores, parceiros ou dados financeiros sem as definições correspondentes. Conta/inscrição acessível a público provavelmente menor não deve ser aprovada sem análise LGPD/ECA Digital e decisão de idade/supervisão.

## Viabilidade de cronograma

A ordem das Fases 0–8 reduz dependências e risco. Estimativas de duração não são confiáveis antes de:

- aprovar regras pendentes;
- dimensionar equipe e disponibilidade;
- decompor requisitos em histórias;
- prototipar jornadas críticas;
- medir a base técnica na Fase 0.

**Resultado de cronograma:** viável em fases; inviável como entrega única sem priorização.

## Critério de classificação de risco

| Nível | Probabilidade | Impacto |
|---|---|---|
| Baixa | Pouco provável nas condições atuais | Efeito localizado, recuperação simples |
| Média | Pode ocorrer durante operação normal | Interrompe processo ou exige retrabalho relevante |
| Alta | Provável sem controle específico | Compromete objetivo, finanças, titulares ou lançamento |

Prioridade: `Crítica` quando impacto alto exige ação antes da fase; `Alta` quando mitigação entra no planejamento imediato; `Média` quando deve ser acompanhada; `Baixa` quando pode ser aceita com monitoramento. As avaliações abaixo são provisórias e devem ser revistas a cada fase.

## Registro de riscos

| ID | Risco | Prob. | Impacto | Prioridade | Mitigação |
|---|---|---:|---:|---:|---|
| RV-01 | Construir todos os módulos simultaneamente | Alta | Alto | Crítica | Gates do roadmap, limite de WIP e aceite por fase |
| RV-02 | Regras financeiras incompletas gerarem saldo/cobrança incorretos | Alta | Alto | Crítica | Plano de contas, testes transacionais, idempotência, conciliação e auditoria |
| RV-03 | Vazamento ou acesso indevido a dados pessoais/comprovantes | Média | Alto | Crítica | Privilégio mínimo, armazenamento privado, URLs assinadas, logs seguros e testes negativos |
| RV-04 | Tratamento inadequado de dados de menores | Média | Alto | Crítica | Avaliação jurídica, melhor interesse, fluxo de responsável e minimização antes da Fase 2 |
| RV-04A | Não avaliar enquadramento no ECA Digital, aferição etária e supervisão | Alta | Alto | Crítica | Tratar como gate jurídico das Fases 1–2, registrar análise e acompanhar orientação da ANPD |
| RV-05 | Backup existir sem restauração possível | Média | Alto | Alta | Definir RPO/RTO e executar testes periódicos de restauração |
| RV-06 | Hospedagem incompatível/indisponível | Média | Médio | Alta | Ambiente reproduzível e serviço compatível com Node/PostgreSQL |
| RV-07 | Dependência de gateway atrasar MVP | Média | Médio | Média | Pagamento manual/PIX e contrato de integração posterior |
| RV-08 | Concorrência duplicar pagamento ou baixa de estoque | Média | Alto | Crítica | Transações, restrições, idempotência e testes concorrentes |
| RV-09 | Campanha vender fora do prazo ou consolidar variação errada | Média | Alto | Alta | Estados/datas obrigatórios, relatório e conferência antes da malharia |
| RV-10 | Política de reembolso indefinida causar conflito | Alta | Alto | Crítica | Aprovar política antes da Fase 5 e manter vínculos financeiros |
| RV-11 | Parceiro operar sem regra de repasse/responsabilidade | Alta | Alto | Crítica | Aprovação e contrato antes da publicação |
| RV-12 | Choque de agenda ou responsabilidade por atendimento | Média | Médio | Alta | Disponibilidade transacional, confirmação e política de cancelamento |
| RV-13 | Fórum sem moderação virar canal de abuso | Média | Alto | Alta | Permissões, rate limit, denúncia, moderação e política editorial |
| RV-14 | Conteúdo oficial duplicado ficar inconsistente | Média | Médio | Média | Relações notícia–evento–fórum e fonte única |
| RV-15 | Custos de arquivo/log crescerem sem controle | Média | Médio | Média | Quotas, lifecycle, retenção, alertas e orçamento |
| RV-16 | Dependência de fornecedor dificultar migração | Baixa | Médio | Média | Portabilidade, backups exportáveis e abstrações simples |
| RV-17 | Baixa adoção pela diretoria | Média | Alto | Alta | Protótipos, treinamento, migração guiada e indicadores de uso |
| RV-18 | Paleta/logo sem decisão gerar retrabalho visual | Alta | Baixo | Média | Aprovar tokens e variantes antes do layout final |
| RV-19 | Log conter segredo ou dado privado | Média | Alto | Crítica | Redação/lista permitida, revisão, testes e acesso/retenção limitados |
| RV-20 | Vulnerabilidade de dependência ou configuração | Média | Alto | Alta | Atualizações, varredura, headers, hardening e resposta por severidade |

## Decisões de go/no-go por fase

| Marco | Go quando | No-go quando |
|---|---|---|
| Produção institucional | autorização/sessão, backup, logs e políticas mínimas validados | segredo, acesso administrativo ou recuperação inseguros |
| Atletas/inscrições | regras de menores, campos, finalidade e análise LGPD/ECA Digital aprovadas | acesso de responsável, idade/supervisão ou base legal indefinidos para o público real |
| Financeiro | categorias, permissões, correções, conciliação e testes aprovados | saldo editável, exclusão destrutiva ou falha de idempotência |
| Loja | preço/estoque/pedido transacionais e política de cancelamento | baixa duplicável ou consulta insegura de visitante |
| Remessas | mínimos, reembolso, consolidação e retirada aprovados | obrigação com comprador/fornecedor indefinida |
| Parceiros | contrato, repasse, privacidade e responsabilidade definidos | parceiro publica antes de aprovação |
| Fórum | termos, visibilidade, moderação e antispam operacionais | ausência de moderador/processo de denúncia |

## Fontes jurídicas oficiais consultadas

- [Lei Geral de Proteção de Dados Pessoais — Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [ANPD — Direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares)
- [ANPD — Tratamento de dados de crianças e adolescentes](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes)
- [ANPD — ECA Digital, aferição de idade e cronograma regulatório](https://www.gov.br/anpd/pt-br/assuntos/eca-digital)
- [Lei nº 15.211/2025 — ECA Digital](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm)
- [Decreto nº 12.880/2026](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12880.htm)
- [ANPD — Comunicação de incidente de segurança](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis)

## Recomendação

Prosseguir apenas com a Fase 0 até que os critérios de saída sejam demonstrados. Depois, autorizar uma fase por vez, começando por autenticação/configurações. O projeto é tecnicamente e economicamente plausível; os maiores riscos estão em regras financeiras, dados de menores, anexos, parceiros e tentativa de ampliar escopo sem gates.
