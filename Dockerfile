FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# 归档照片目录：docker 部署时建议通过 -v 挂载到宿主机
# 例如：docker run -v /host/data/uploads:/app/uploads ...
VOLUME ["/app/uploads"]

CMD ["node", "server/index.js"]