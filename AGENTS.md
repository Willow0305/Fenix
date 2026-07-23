# Instruções permanentes para agentes

Este arquivo rege qualquer trabalho realizado no repositório Fênix Vôlei.

## Fontes e escopo

- Antes de alterar o projeto, consulte este arquivo e todos os documentos em `docs/`.
- Considere `referencias/documento_requisitos_fenix_volei_melhorado.pdf` a fonte principal do escopo funcional original.
- Use a documentação versionada em `docs/` como especificação consolidada e rastreável. Em caso de divergência com a fonte, não escolha silenciosamente: registre a questão em `PENDENCIAS.md`.
- Nenhum requisito pode ser removido, reduzido ou redefinido sem aprovação explícita e registro em `CHANGELOG.md` e `docs/17-DECISOES-TECNICAS.md`.
- Não invente regras de negócio. Registre dúvidas, a alternativa recomendada e o impacto em `PENDENCIAS.md`.
- Respeite a fase vigente em `docs/16-ROADMAP.md`; não antecipe funcionalidades de fases futuras.

## Forma de desenvolvimento

- Desenvolva por módulos, com limites claros entre interface, aplicação, domínio e infraestrutura.
- Não coloque regras de negócio em componentes de interface, controllers ou adaptadores de persistência.
- Cada módulo deve incluir validação de entrada, tratamento seguro de erros, autorização e testes proporcionais ao risco.
- Use TypeScript em modo `strict`; não use `any`, salvo caso tecnicamente inevitável, justificado no código e em uma decisão técnica.
- Registre toda mudança de arquitetura em `docs/17-DECISOES-TECNICAS.md`.
- Não considere um módulo pronto sem lint, testes e build executados com sucesso.
- Preserve alterações preexistentes e não exclua conteúdo válido sem justificativa documentada.

## Dados e persistência

- Use PostgreSQL e Prisma ORM.
- Todas as tabelas devem usar UUID como chave primária, inclusive tabelas de associação com identidade própria.
- Armazene instantes em UTC e converta apenas nas bordas da aplicação. Datas civis sem horário permanecem como `DATE`.
- Nunca use `float` ou `double` para dinheiro. Use `Decimal` no Prisma e `NUMERIC/DECIMAL` no PostgreSQL, com moeda explícita quando aplicável.
- Prefira exclusão lógica (`deletedAt`) para registros importantes, históricos, conteúdo moderado e cadastros referenciados.
- Registros financeiros confirmados não podem ser apagados nem reescritos para ocultar histórico. Cancelamentos, estornos, reembolsos, reaberturas e correções devem ser vinculados e auditáveis.
- O saldo financeiro deve ser derivado das movimentações; não crie saldo editável como fonte de verdade.
- Mudanças sensíveis devem registrar autor, instante, motivo e valores anterior/novo quando permitido pela LGPD.
- Não armazene comprovantes ou outros uploads como binário no banco. Guarde somente metadados, integridade e URL/chave segura do objeto.
- Defina relacionamentos e políticas `onDelete` explicitamente; evite chaves estrangeiras ambíguas.

## Segurança, privacidade e LGPD

- Todas as rotas administrativas devem autenticar o usuário e validar permissões específicas no servidor.
- Aplique privilégio mínimo. O frontend nunca é a autoridade de autorização.
- Senhas devem usar hash adaptativo seguro. Tokens de atualização devem ser rotacionáveis, revogáveis e armazenados de forma segura.
- Não inclua credenciais, segredos, tokens, dados pessoais privados ou conteúdo de comprovantes em código, fixtures, mensagens de erro ou logs.
- Variáveis sensíveis devem vir do ambiente. Mantenha `.env.example` sem valores reais e nunca versione `.env`.
- Valide uploads por tamanho, MIME real, extensão permitida e autorização de acesso; use URLs assinadas quando necessário.
- Minimize coleta e retenção de dados. Toda implementação deve respeitar as regras de LGPD documentadas em `docs/13-SEGURANCA-E-LGPD.md`.
- Dados de saúde e prontuário médico estão fora do escopo até decisão jurídica, técnica e de segurança específica.

## Qualidade e entrega

- Escreva testes para toda funcionalidade crítica e para regras financeiras, permissões e transições de estado.
- Execute os comandos oficiais descritos no `README.md` antes de concluir uma etapa.
- Ao finalizar uma tarefa, explique arquivos criados e alterados, decisões, testes executados, problemas encontrados e próximos passos.
- Se lint, testes, build ou inicialização não puderem ser executados, registre exatamente o motivo e a evidência em `PENDENCIAS.md`.
