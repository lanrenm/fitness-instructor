FROM node:22-alpine

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com && \
    npm config set proxy http://host.docker.internal:7897 && \
    npm config set https-proxy http://host.docker.internal:7897

RUN npm install -g pnpm

# 从 monorepo 根复制 workspace 配置 + packages 源码
COPY package*.json pnpm-workspace.yaml* ./
COPY packages ./packages

# 安装依赖（@fitness/ui-components 通过 webpack alias 指向本地 dist，不走 node_modules）
RUN pnpm install --ignore-scripts

# 把 bff 应用代码复制进来
COPY apps/bff .

EXPOSE 3000

CMD ["npm", "run", "dev"]