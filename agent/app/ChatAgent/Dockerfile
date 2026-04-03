FROM --platform=linux/arm64 node:22-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM --platform=linux/arm64 node:22-slim

# Claude Code (Grep/Bash ツール) に必要なシステムパッケージ
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      git \
      ripgrep \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# workspace ディレクトリを事前作成（Claude Agent SDK の cwd）
RUN mkdir -p /tmp/workspace/kurewari

RUN useradd -m -u 10000 bedrock_agentcore
USER bedrock_agentcore

EXPOSE 8080

CMD ["node", "dist/server.js"]
