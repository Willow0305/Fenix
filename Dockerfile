# syntax=docker/dockerfile:1.7
# Imagens de produção da API e do site (DT-053). Uma construção, dois alvos:
#   docker build --target api -t fenix-api .
#   docker build --target web -t fenix-web .
# Base fixada por versão e digest; atualizar junto com o Node do projeto.
ARG NODE_IMAGE=node:24.22.0-bookworm-slim@sha256:91acba91b842bec0bf7ea6f5e09c644c7ccad72c4996ed9616d861d1c7cd60d4

# ---------- base: OpenSSL para o Prisma ----------
FROM ${NODE_IMAGE} AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- dependências (com as de desenvolvimento, para construir) ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/validation/package.json packages/validation/
COPY packages/config/package.json packages/config/
RUN npm ci --ignore-scripts --no-audit --no-fund

# ---------- construção ----------
FROM deps AS build
COPY . .
# Endereço interno da API usado pelas reescritas do Next (gravado na construção).
ARG API_INTERNAL_URL=http://api:3333
ENV API_INTERNAL_URL=${API_INTERNAL_URL} NEXT_OUTPUT=standalone
RUN npx prisma generate \
  && npm run build --workspace=@fenix/validation \
  && npm run build --workspace=@fenix/api \
  && npm run build --workspace=@fenix/web

# ---------- dependências de produção da API ----------
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/validation/package.json packages/validation/
COPY packages/config/package.json packages/config/
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund --workspace=@fenix/api --include-workspace-root \
  && npm cache clean --force

# ---------- API ----------
FROM base AS api
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3333
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/packages/validation/package.json ./packages/validation/package.json
COPY --from=build --chown=node:node /app/packages/validation/dist ./packages/validation/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3333/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]

# ---------- migrações (executa e sai, antes da API) ----------
# Só o CLI do Prisma (mesma versão do projeto) e as migrações.
FROM base AS migrate
COPY prisma ./prisma
RUN npm init -y >/dev/null \
  && npm install --no-audit --no-fund --omit=dev prisma@6.19.3 \
  && npm cache clean --force
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------- site ----------
FROM base AS web
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/web/server.js"]
