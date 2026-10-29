FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
COPY shared/ /app/shared/
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=4000
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/src/ ./src/
COPY backend/scripts/setup-admin.mjs ./scripts/setup-admin.mjs
COPY shared/ /app/shared/
COPY --from=frontend /app/frontend/dist/ /app/frontend/dist/
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
