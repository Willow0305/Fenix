# Política de segurança

## Estado do projeto

O Fênix Vôlei está em planejamento e infraestrutura inicial, sem versão pública suportada. Esta política será revisada antes de qualquer piloto com dados reais.

## Como relatar uma vulnerabilidade

O projeto **ainda não disponibiliza um canal suportado para receber relatos de vulnerabilidade**. Não envie detalhes exploráveis, credenciais ou dados pessoais por issue, discussão, pull request ou outro canal público. A diretoria precisa designar um contato privado verificável antes do piloto; endereço, proteção do canal e prazos de resposta permanecem em `PEN-014` de [`PENDENCIAS.md`](./PENDENCIAS.md). Depois dessa definição, este arquivo deverá publicar o procedimento acionável.

Inclua, sem dados reais:

- descrição e impacto;
- componente e versão/commit;
- pré-condições;
- passos mínimos para reproduzir;
- evidências sanitizadas;
- correção sugerida, se houver;
- forma segura de retorno.

## Processo esperado

1. confirmar o recebimento pelo canal privado que vier a ser aprovado;
2. classificar severidade e alcance;
3. conter exposição e preservar evidências;
4. corrigir e testar regressões;
5. rotacionar segredos ou revogar sessões quando necessário;
6. avaliar obrigações de comunicação e LGPD;
7. publicar orientação somente depois da mitigação, sem expor titulares.

Tempos de confirmação e correção ainda dependem da equipe e do regime operacional aprovado. Não há programa de recompensa financeira definido.

## Controles obrigatórios

- senhas com hash adaptativo e parâmetros atualizáveis;
- sessões revogáveis e refresh tokens rotacionados;
- autorização por permissão no servidor;
- validação de entrada e saída;
- queries parametrizadas e constraints no PostgreSQL;
- CORS explícito, headers de segurança e rate limiting;
- segredos fora do código e separados por ambiente;
- logs sem senha, token, comprovante ou dado pessoal desnecessário;
- uploads privados, validados e sujeitos a limite;
- dependências e imagens verificadas;
- backups criptografados e restauração testada;
- trilha de auditoria para ações sensíveis;
- minimização, retenção e controle de acesso coerentes com LGPD.

## Dados especialmente protegidos

- documentos pessoais e dados de contato;
- dados de menores e de responsáveis;
- comprovantes e informações financeiras;
- tokens de sessão e recuperação;
- contratos e documentos de parceiros;
- qualquer dado de saúde.

Prontuário e funcionalidade clínica estão fora do escopo. Dados de saúde não devem ser adicionados antes de análise jurídica, técnica e de segurança específica.

Qualquer experiência acessível a crianças ou adolescentes também exige avaliação atualizada da Lei nº 15.211/2025 (ECA Digital), do Decreto nº 12.880/2026 e das orientações vigentes da ANPD, além da LGPD. Aferição de idade ou supervisão não autoriza coleta excessiva.

## Segredos expostos

Ao identificar um segredo:

1. não o copie para issue, chat ou log;
2. revogue ou rotacione imediatamente pelo provedor;
3. verifique uso indevido e alcance;
4. remova-o do estado atual e avalie limpeza segura do histórico;
5. registre o incidente sem reproduzir o valor;
6. adicione prevenção e teste de regressão.

Apagar apenas o arquivo ou commit não invalida uma credencial já exposta.

## Dependências

Atualizações de segurança devem ser avaliadas com prioridade compatível com severidade e exposição. Mudanças passam por lockfile, lint, testes e build. Dependência abandonada ou sem correção deve ser removida, isolada ou aceita formalmente com mitigação e prazo.
