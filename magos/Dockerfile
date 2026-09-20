FROM node:20-alpine

WORKDIR /app

COPY magos/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY magos ./

ENV NODE_ENV=production
ENV MAGOS_PORT=8080

EXPOSE 8080

CMD ["node", "runtime/server.js"]
