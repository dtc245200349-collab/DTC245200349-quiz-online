FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund && npm cache clean --force
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
