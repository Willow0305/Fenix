# Relatório de entrega — Fase 7

**Data da validação:** 19/10/2026  
**Estado:** implementada; validada por lint, testes e build  
**Escopo:** notícias, eventos e partidas, fórum moderado e avisos da diretoria

## 1. Resultado

O time publica notícias uma única vez e escolhe onde aparecem (página inicial e comunicados do fórum). A publicação pode ser imediata ou agendada, e a notícia surge sozinha no horário marcado. Eventos e partidas formam a agenda pública, com placar e ligação com notícias e seletivas. O fórum respeita três níveis de visibilidade sem vazar conteúdo restrito. Tem reações, denúncias e moderação com motivo e histórico. A diretoria envia avisos internos a grupos sem risco de duplicidade.

## 2. Entregas

### Backend (`content`)

- notícias: categorias, rascunho, publicação imediata ou agendada (UTC), reagendamento, ocultação motivada, arquivamento, slug estável, capa pública e canais;
- eventos: tipos, confirmação com publicação, realização, cancelamento motivado, partida com placar, vínculo com seletiva e notícias visíveis;
- fórum: categorias com visibilidade, tópicos com primeira mensagem, respostas, edição e remoção pelo autor em 24 h, reações idempotentes, denúncias deduplicadas, limites antiabuso e notificação de resposta;
- moderação: ações sobre tópico e mensagem com motivo, `ForumModerationAction`, auditoria, aviso ao autor e fila de denúncias;
- avisos: envio a atletas ativos, equipe, diretoria ou todos, somente link interno, idempotente e auditado;
- texto simples em todo conteúdo publicado (sem HTML).

### Frontend

- público: `/noticias` (categorias e paginação), `/noticias/[slug]`, `/eventos` (próximos e resultados), destaques de notícias e agenda na página inicial;
- fórum: `/forum` (comunicados e categorias), `/forum/[slug]` (tópicos e novo tópico), `/forum/topicos/[id]` (mensagens, reações, resposta, edição, denúncia e moderação);
- painel: notícias (lista, categorias, edição, canais, capa, publicação e agendamento), eventos (cadastro, edição, placar e etapas), fórum (denúncias, categorias e histórico) e avisos.

## 3. Requisitos atendidos

| Requisito | Situação |
|---|---|
| RF-040 fórum | atendido |
| RF-041 notícias | atendido |
| RF-042 notícia em vários canais | atendido |
| RF-043 moderação | atendido |
| RCF-001 eventos e partidas | atendido |
| RCF-012 reações, denúncias, fixação e histórico | atendido |
| RCF-013 categoria, resumo, slug e agendamento | atendido |
| RF-022 notificações | ampliado (fórum e avisos); e-mail real depende do provedor |

## 4. Validações executadas

| Verificação | Resultado |
|---|---|
| `npm run check` | aprovado (77 testes unitários de API, 7 web) |
| testes de domínio | 5 casos: visibilidade de notícia, agendamento, visibilidade do fórum, sanitização, limites e janela de edição |
| testes de integração | 6 cenários: publicação imediata/agendada em todos os canais e ocultação; eventos públicos/internos com notícia visível; fórum sem vazamento entre visibilidades; participação com reação idempotente, denúncia deduplicada, moderação e fechamento; limite de rajada; avisos idempotentes |
| suíte completa de integração | 67 cenários (fases 1 a 7) aprovados |

## 5. Decisões principais

`DT-034`. Pendências resolvidas ou parciais: `PEN-038`, `PEN-039`, `PEN-040`.

## 6. Pontos em aberto e riscos

- política de convivência do fórum, SLA e recurso de moderação dependem do responsável (`PEN-039`);
- avisos e notificações somente in-app até a escolha do provedor de e-mail (`PEN-040`, `PEN-042`);
- "usuário verificado" equivale a conta ativa enquanto não houver verificação de e-mail obrigatória (`PEN-008`);
- conteúdo envolvendo menores no fórum depende da revisão jurídica (`PEN-010`).

## 7. Próximo passo

Fase 8 — relatórios, auditoria e otimizações.
