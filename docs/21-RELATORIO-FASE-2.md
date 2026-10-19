# Relatório de entrega — Fase 2

**Data da validação:** 18/10/2026  
**Estado:** implementada; validada por lint, testes e build  
**Escopo:** equipes e categorias, interessados, seletivas e inscrições, atletas e vínculos, área do atleta, notificações e indicadores  
**Commit:** `b9833f9`

## 1. Resultado

O ciclo esportivo está digitalizado, do primeiro contato ("Quero jogar no Fênix") até o atleta vinculado a equipes com histórico. Inscrições públicas registram consentimento versionado e aplicam a regra de menores (`DT-026`). A conversão de interessado ou inscrição em atleta é uma ação explícita da diretoria, que preserva a origem.

## 2. Entregas

### Backend

| Módulo | Capacidades |
|---|---|
| `sports` | equipes e categorias; interessados; seletivas com período, vagas e estados; inscrições com análise, motivo e conversão; atletas com documento cifrado, detecção de duplicidade, histórico antes/depois, status, conta vinculada e vínculos com equipes |
| `notifications` | notificações internas idempotentes, contador, leitura individual e total |
| `dashboard` | indicadores com definição e link de origem |

### Frontend

- público: times com filtro, seletivas (lista, detalhe e inscrição) e formulário de interesse;
- "Minha conta": dados de atleta, inscrições e notificações;
- painel: atletas (lista, cadastro, ficha), interessados, seletivas e análise de inscrições, equipes e categorias, indicadores do painel.

### Dados

Migration `fase2_menores_consentimento`: responsável, ciência do responsável, versão do aviso de privacidade e instante do consentimento.

## 3. Requisitos atendidos

| Requisito | Situação |
|---|---|
| RF-002 páginas por time | atendido |
| RF-003 interessados | atendido, sem criar conta nem atleta |
| RF-004 seletivas e inscrições | atendido, com estados nova, em análise, aprovada, recusada, compareceu e não compareceu |
| RF-008/009 cadastro e edição de atleta | atendido, com histórico das alterações |
| RF-010 vínculo com equipes ao longo do tempo | atendido, sem sobreposição na mesma equipe |
| RF-019 área do atleta | dados e inscrições (financeiro e pedidos nas fases 3 e 4) |
| RF-020 painel | atletas ativos, inscrições novas e seletivas abertas |
| RF-022 notificações | inscrição aprovada/recusada, seletiva cancelada, conta vinculada |

## 4. Validações executadas

| Verificação | Resultado |
|---|---|
| `npm run check` | aprovado |
| testes de domínio | 15 casos: datas civis, idade, regras de responsável, máquinas de estado, janela de inscrição, vínculos |
| testes de integração | 12 cenários: duplicidade e histórico, menores, transições com motivo, vínculos, acesso somente ao próprio registro, vagas, consentimento, análise com notificação, conversão rastreável, cancelamento, permissões, indicadores |

## 5. Decisões principais

`DT-026` (menores), `DT-028` (modelo de recrutamento) e `DT-029` (notificações idempotentes).

## 6. Pontos em aberto e riscos

- revisão jurídica do tratamento de menores antes de dados reais (`PEN-010`);
- campos obrigatórios definitivos e retenção de dados de interessados (`PEN-009`, `PEN-011`).

## 7. Próximo passo

Fase 3 — mensalidades e Caixa Fênix ([22-RELATORIO-FASE-3](./22-RELATORIO-FASE-3.md)).
