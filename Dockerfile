# Game server (Colyseus). The web client is static and deploys separately.
FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY shared ./shared

ENV NODE_ENV=production
EXPOSE 2567

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||2567)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Node 24 runs TypeScript directly, so there is no build step and no tsx or npm wrapper
# process: one process, about a third less memory, and SIGTERM reaches the server itself.
CMD ["node", "server/index.ts"]
