# Como executar o Fênix Vôlei (Windows)

Guia passo a passo para subir o banco, a API (backend) e o site (frontend) no seu computador.

## 1. Pré-requisitos (instalar uma única vez)

| Programa | Para quê | Como conferir no terminal |
|---|---|---|
| [Node.js 22 ou 24 (LTS)](https://nodejs.org/) | executa a API e o site | `node --version` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | executa o banco PostgreSQL | `docker --version` |
| [Git](https://git-scm.com/) | controle de versões | `git --version` |

Use o terminal do VS Code (PowerShell ou Git Bash) aberto na pasta do projeto: `C:\Users\William\Desktop\Fenix`.

## 2. Primeira execução

1. **Abra o Docker Desktop** e espere aparecer "Engine running".
2. Instale as dependências:

   ```bash
   npm ci
   ```

3. Confira se existe o arquivo `.env` na raiz do projeto. Ele já foi criado com senhas locais aleatórias. Se precisar recriá-lo, copie o modelo (`Copy-Item .env.example .env` no PowerShell) e troque todos os valores `replace-with-...`.
4. Suba o banco de dados:

   ```bash
   docker compose up -d postgres
   ```

5. Crie as tabelas, as permissões, o plano de contas e o administrador:

   ```bash
   npm run db:setup
   ```

6. (Opcional) Carregue dados **fictícios** para explorar o sistema:

   ```bash
   npm run db:demo
   ```

7. Suba o backend e o frontend juntos:

   ```bash
   npm run dev
   ```

   Aguarde as mensagens de "Ready" do Next.js e "Nest application successfully started". Para parar, pressione `Ctrl + C`.

## 3. Uso no dia a dia

Com o projeto já configurado, basta:

1. abrir o **Docker Desktop**;
2. `docker compose up -d postgres`;
3. `npm run dev`.

Se alguém atualizou o código (`git pull`), rode antes `npm ci` e `npm run db:migrate`.

## 4. Endereços

| O quê | Endereço |
|---|---|
| Site público | http://localhost:3000 |
| Painel administrativo | http://localhost:3000/admin |
| Entrar | http://localhost:3000/entrar |
| Documentação da API (Swagger) | http://localhost:3333/docs |
| Saúde da API | http://localhost:3333/health |

**Acesso de administrador:** e-mail em `SEED_ADMIN_EMAIL` e senha em `SEED_ADMIN_PASSWORD`, ambos no arquivo `.env`.

**Verificação em duas etapas:** no primeiro acesso ao painel, o sistema pede para ativá-la em **Minha conta → Segurança**. Instale um aplicativo autenticador no celular (Google Authenticator, Microsoft Authenticator ou Authy), leia o QR code, digite o código e **guarde os códigos de recuperação**. Daí em diante, o login pede a senha e o código do aplicativo.

**E-mails** (recuperação de senha, pedidos, avisos de remessa): em desenvolvimento não são enviados de verdade, ficam como arquivos em `var/mail-outbox/`.

## 5. Brasão do time no site

O site usa, nesta ordem:

1. o logo enviado no painel em **Configurações → Marca e logos → Brasão oficial** (recomendado; vale sem reiniciar);
2. o arquivo `apps/web/public/brand/brasao-fenix.png`;
3. o símbolo da fênix (`apps/web/public/brand/logo-fenix.png`), como reserva.

Para usar o brasão "Time Fênix Volleyball", salve a imagem como PNG, de preferência com fundo transparente, e:

- envie pelo painel (opção 1); **ou**
- salve como `apps/web/public/brand/brasao-fenix.png` e também uma cópia em `referencias/logos/` para registro.

As versões masculina, feminina e da diretoria também podem ser enviadas no mesmo menu.

## 5.1 PIX automático (Mercado Pago)

Em desenvolvimento o PIX automático roda em **modo de teste** (`PIX_PROVIDER=sandbox`): o QR aparece, mas não pode ser pago de verdade; o botão "Simular pagamento (modo de teste)" faz a baixa como se o banco tivesse avisado. Em produção:

1. No [painel de desenvolvedores do Mercado Pago](https://www.mercadopago.com.br/developers/panel/app), crie uma aplicação e copie o **Access Token** de produção.
2. Em **Webhooks → Configurar notificações**, cadastre `https://SEU-DOMINIO/api/v1/payments/pix/webhook/mercadopago`, marque o evento **Pagamentos** e revele o **segredo** (assinatura).
3. No `.env` do servidor:
   ```
   PIX_PROVIDER=mercadopago
   MERCADOPAGO_ACCESS_TOKEN=...
   MERCADOPAGO_WEBHOOK_SECRET=...
   PIX_NOTIFICATION_URL=https://SEU-DOMINIO/api/v1/payments/pix/webhook/mercadopago
   ```
4. Reinicie a API. Em **Painel → PIX automático**, escolha a conta do Caixa que recebe.
5. Teste com um pedido de valor baixo. Mesmo que um aviso se perca, a conferência automática a cada 2 minutos faz a baixa.

## 5.1.1 Cartão pelo site (Mercado Pago)

Em desenvolvimento roda em **modo de teste** (`CARD_PROVIDER=sandbox`): a tela de pagamento mostra "Simular cartão aprovado" e "Simular recusado". Em produção:

1. No painel de desenvolvedores do Mercado Pago, na mesma aplicação do PIX, copie a **Public Key** de produção.
2. Em **Webhooks**, cadastre também `https://SEU-DOMINIO/api/v1/payments/card/webhook/mercadopago` (evento **Pagamentos**).
3. No `.env` do servidor (o token e o segredo são os mesmos do PIX):
   ```
   CARD_PROVIDER=mercadopago
   MERCADOPAGO_PUBLIC_KEY=...
   CARD_NOTIFICATION_URL=https://SEU-DOMINIO/api/v1/payments/card/webhook/mercadopago
   ```
4. Na conta do Mercado Pago, confira o prazo de recebimento (na hora, 14 ou 30 dias) e, se for oferecer "sem juros" em produtos, peça à equipe comercial os códigos de "preço diferenciado" e cole em **Painel → PIX e cartão**.
5. Teste primeiro com as **credenciais de teste** e os cartões de teste do Mercado Pago.

## 5.2 Entrega em casa

Em **Painel → Loja → Entrega em casa** a diretoria cadastra as **regiões** de Rio Branco (nome, taxa, prazo em dias úteis e os bairros, um por linha), o **frete grátis** (opcional, a partir de um valor em produtos) e liga a opção "Oferecer entrega em casa no checkout". Bairro fora da lista só retira. `npm run db:demo` cria duas regiões de exemplo.

Quando o pedido sai, o quadro **Entrega** do pedido registra quem leva e gera o **link do entregador** (vale 24 horas; envie pelo WhatsApp). O comprador recebe um **código de 4 dígitos**; na porta, o motoboy digita o código no link (ou passa para a diretoria digitar), ou tira uma foto. Os entregadores fixos ficam em **Entrega em casa → Entregadores**.

No checkout, o CEP preenche a rua pelo ViaCEP, consultado pela API (o navegador não fala com terceiros). Sem internet, ou com `POSTAL_CODE_LOOKUP=off`, a pessoa digita a rua e escolhe o bairro na lista.

## 6. Comandos úteis

| Comando | Para quê |
|---|---|
| `npm run dev` | sobe site + API em modo desenvolvimento |
| `npm run dev:web` / `npm run dev:api` | sobe só o site ou só a API |
| `npm run db:migrate` | aplica atualizações do banco |
| `npm run db:seed` | recria permissões e plano de contas (não apaga dados) |
| `npm run db:demo` | dados fictícios de demonstração |
| `npm run mfa:reset -- <e-mail> "<motivo>"` | remove a verificação em duas etapas de quem perdeu o celular e os códigos |
| `npm run check` | verificação completa: formatação, lint, tipos, testes e build |
| `npm run test:integration` | testes contra o banco (Docker precisa estar ligado) |
| `docker compose down` | desliga o banco **sem apagar** os dados |

Não use `docker compose down -v`: o `-v` apaga o banco inteiro.

## 7. Problemas comuns

| Sintoma | Solução |
|---|---|
| `failed to connect to the docker API` | abra o Docker Desktop e aguarde iniciar |
| `Can't reach database server at 127.0.0.1:5433` | rode `docker compose up -d postgres` |
| `Port 3000 (ou 3333) is already in use` | feche outra execução do `npm run dev` ou reinicie o terminal |
| erro de tabela inexistente | rode `npm run db:migrate` |
| API não sobe, com centenas de erros de TypeScript ou `Cannot convert undefined or null to object` | pare o `npm run dev` e rode `npm run prisma:generate` (cliente do Prisma desatualizado) |
| "O painel exige verificação em duas etapas" | ative em **Minha conta → Segurança** (`DT-037`) |
| perdi o celular e os códigos de recuperação | outro administrador usa **Usuários → Redefinir 2 etapas**; sendo o único, rode `npm run mfa:reset -- seu@email "motivo"` |
| "Sua sessão foi encerrada por inatividade" | esperado: o painel encerra a sessão após 30 min sem uso e 12 h após o login (`DT-036`) |
| login com "Papel padrão ausente" | rode `npm run db:seed` |
| `npm run check` falha em formatação com CRLF | rode `npm run format` (o `.gitattributes` já força LF em novos checkouts) |
| site abre mas sem dados | rode `npm run db:demo` ou cadastre pelo painel |
