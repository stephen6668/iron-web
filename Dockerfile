FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force \
    && mkdir -p /data && chown node:node /data
COPY --chown=node:node server/ ./server/
COPY --chown=node:node *.html *.js *.css ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 IRON_DATA_DIR=/data
USER node
EXPOSE 8787
CMD ["node", "server/index.mjs"]
