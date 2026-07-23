# Visão geral do Fênix Vôlei

## Identificação

| Item | Definição |
|---|---|
| Produto | Plataforma web oficial para gestão do Time Fênix de Vôlei |
| Documento-base | `referencias/documento_requisitos_fenix_volei_melhorado.pdf`, versão 1.1 de 23/07/2026 |
| Complemento de escopo | Briefing técnico anexado à solicitação inicial |
| Estado desta especificação | Consolidação inicial da Fase 0; itens marcados como provisórios ainda exigem decisão |
| Fase vigente | Fase 0 — Planejamento e infraestrutura |

## Resumo executivo

O Fênix Vôlei será uma aplicação web responsiva para centralizar processos hoje sujeitos a controles dispersos: divulgação pública, interessados e seletivas, cadastro de atletas, mensalidades, Caixa Fênix, loja, remessas, parceiros, serviços, notícias, fórum, notificações e relatórios.

O produto atende principalmente à diretoria, atletas, interessados, responsáveis e compradores. A solução completa é ampla, portanto será entregue em fases. A Fase 0 prepara documentação, arquitetura, ambiente, banco inicial, integração contínua e padrões de qualidade; ela não autoriza a implementação antecipada dos módulos funcionais.

## Problema a resolver

- Reduzir dependência de planilhas, mensagens e anotações sem trilha de auditoria.
- Dar à diretoria uma visão confiável de atletas, inscrições, cobranças, vendas e caixa.
- Permitir que atletas e compradores consultem seus próprios dados e status.
- Organizar vendas de estoque imediato, encomendas e campanhas/remessas.
- Formalizar o relacionamento com parceiros e profissionais.
- Unificar comunicação institucional, notícias, eventos e interação moderada.
- Proteger dados pessoais e registros financeiros durante todo o ciclo de vida.

## Públicos e resultados esperados

| Público | Necessidade principal | Resultado esperado |
|---|---|---|
| Visitante/interessado | Conhecer o time e inscrever-se | Jornada pública simples, responsiva e sem acesso indevido a dados internos |
| Comprador | Localizar produtos e acompanhar pedido | Carrinho e pedido claros, inclusive em campanhas/remessas |
| Atleta | Consultar cadastro, cobranças e atividades próprias | Autonomia sem exposição de dados de terceiros |
| Responsável por atleta | Acompanhar o que for legalmente e operacionalmente autorizado | Acesso vinculado e limitado; modelo exato ainda é provisório |
| Diretoria | Operar cadastros, finanças, loja, comunicação e relatórios | Processos rastreáveis, permissões específicas e menos retrabalho |
| Administrador | Administrar usuários, permissões e configurações | Governança técnica e operacional com privilégio mínimo |
| Parceiro/profissional | Oferecer produto ou serviço aprovado | Operação sob curadoria; eventual acesso próprio ainda depende de decisão |

## Capacidades do produto

1. Site público e identidade institucional.
2. Autenticação, usuários, perfis e permissões.
3. Configurações do time, contatos, textos, cores, logos e arquivos.
4. Atletas, equipes, categorias, interessados, seletivas e inscrições.
5. Planos, mensalidades, pagamentos e inadimplência.
6. Caixa Fênix: contas, categorias, centros de custo, movimentações, conciliação, fechamento e auditoria.
7. Loja: produtos, variações, estoque, carrinho, favoritos, pedidos e pagamentos.
8. Campanhas e remessas, da abertura à retirada ou ao reembolso.
9. Parceiros, profissionais, serviços, disponibilidade, agendamentos e repasses.
10. Notícias, eventos, partidas, fórum, moderação e notificações.
11. Relatórios administrativos, financeiros e operacionais.

## Limites essenciais

- A primeira experiência será web responsiva; aplicativo Android/iOS nativo não integra o escopo inicial.
- Pagamento automático não é obrigatório no MVP. O início pode usar registro manual/PIX, sem impedir integração posterior.
- Scout, estatísticas avançadas e controle detalhado de treinos são possibilidades futuras, não requisitos vigentes.
- Não haverá marketplace aberto: parceiros precisam de cadastro, aprovação e regras de repasse.
- Prontuário médico e dados de saúde estão fora do escopo até avaliação jurídica, técnica e de segurança específica.
- Checkout real, gateway, caixa completo, fórum funcional, loja funcional, agendamento funcional, nuvem real e integrações externas não fazem parte da Fase 0.

## Princípios de produto e engenharia

- O servidor é a autoridade de autenticação e autorização.
- Regras de negócio pertencem ao domínio/aplicação, não à interface ou persistência.
- Valores monetários usam `Decimal`/`NUMERIC`; saldo é derivado de movimentações.
- Registros financeiros confirmados permanecem rastreáveis e não são apagados ou reescritos para ocultar histórico.
- Instantes são armazenados em UTC; datas civis sem horário usam `DATE`.
- Entidades persistidas usam UUID e relacionamentos com política de exclusão explícita.
- Arquivos são armazenados fora do banco; o banco guarda metadados, integridade e chave/URL segura.
- Dados pessoais são minimizados, protegidos e retidos apenas pelo período justificado.
- Cada fase exige validação, tratamento seguro de erros, autorização, testes, lint e build.

## Fontes, papéis e rastreabilidade

As fontes têm papéis complementares, não uma ordem única de precedência aplicável a todo conflito:

| Fonte | Papel |
|---|---|
| Documento-base em PDF | Fonte principal do escopo funcional original e dos identificadores RF/RNF; não deve ser reduzido silenciosamente |
| Briefing técnico anexado | Ampliações, restrições e direcionadores solicitados para esta consolidação |
| `AGENTS.md` | Regra vinculante para a forma de executar o trabalho no repositório, inclusive dados, segurança, qualidade e tratamento de divergências |
| Documentos versionados em `docs/` | Especificação consolidada e rastreável para implementação incremental, sujeita à aprovação registrada em `PEN-001` |

Em divergência funcional entre as fontes, a equipe não escolhe silenciosamente: registra a questão em [`PENDENCIAS.md`](../PENDENCIAS.md). Uma mudança de requisito exige aprovação explícita e os registros determinados por `AGENTS.md`.

Os requisitos `RF-001` a `RF-045` e `RNF-001` a `RNF-022` mantêm seus identificadores e intenção original. Ampliações do briefing recebem identificadores complementares próprios para não alterar a faixa canônica.

## Divergências e decisões provisórias

| Tema | Evidência conflitante | Tratamento nesta fase |
|---|---|---|
| Paleta principal | O PDF propõe `#B80012`/`#7A000A`; o briefing propõe `#C8102E`/`#8F001A` | Ambos são preservados em `12-IDENTIDADE-VISUAL.md`. O conjunto do briefing é apenas recomendação provisória para protótipos, não decisão definitiva. |
| Representação de dinheiro | O SQL ilustrativo do PDF usa inteiros em centavos; `AGENTS.md` e o briefing exigem `Decimal`/`NUMERIC` | A regra consolidada é `Decimal`/`NUMERIC`. O SQL do PDF é referência histórica, não especificação de implementação. |
| Sessão | O PDF admite JWT ou cookie seguro; o briefing cita JWT com refresh token | A escolha exata de transporte/armazenamento deve ser registrada em decisão técnica. Os controles mínimos constam em `13-SEGURANCA-E-LGPD.md`. |
| Administração de logos/configurações | `RF-023` cita administrador; `RF-039` cita diretoria | A matriz usa permissões granulares e marca o acesso da diretoria como provisório até definição de governança. |
| Perfil de parceiro | Há confirmação “pela diretoria ou parceiro”, mas o conjunto original de perfis não define parceiro | Portal/perfil próprio de parceiro é provisório. Sem aprovação, a diretoria executa a operação. |
| Responsável por atleta | Responsáveis integram o público-alvo, sem regras de vínculo e acesso | Acesso do responsável não deve ser implementado antes de definir vínculo, consentimento e tratamento de menores. |

## Indicadores de sucesso

Os valores-alvo dependem de linha de base e aprovação. Os indicadores abaixo definem o que deverá ser mensurável, sem impor metas ainda não acordadas:

- proporção de inscrições concluídas sem suporte;
- tempo de processamento de uma inscrição pela diretoria;
- proporção de mensalidades e pedidos conciliados com o Caixa Fênix;
- divergências detectadas em fechamento de caixa;
- tempo entre recebimento de remessa e notificação dos compradores;
- solicitações de titulares LGPD atendidas dentro do prazo legal aplicável;
- falhas de autorização, incidentes e erros críticos por período;
- resultado de testes de acessibilidade, desempenho e compatibilidade.

## Mapa documental

- Objetivos e fronteiras: `01-OBJETIVOS-E-ESCOPO.md`
- Requisitos: `02-REQUISITOS-FUNCIONAIS.md` e `03-REQUISITOS-NAO-FUNCIONAIS.md`
- Regras, acesso e fluxos: `04-REGRAS-DE-NEGOCIO.md`, `05-PERFIS-E-PERMISSOES.md` e `06-FLUXOS-DO-SISTEMA.md`
- Experiência e marca: `11-UX-UI.md` e `12-IDENTIDADE-VISUAL.md`
- Segurança, privacidade e qualidade: `13-SEGURANCA-E-LGPD.md` e `14-TESTES.md`
- Sequenciamento e decisão de investimento: `16-ROADMAP.md` e `18-ESTUDO-DE-VIABILIDADE.md`
