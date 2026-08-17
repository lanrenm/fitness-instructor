FROM node:22-alpine

# 配置镜像源
RUN npm config set registry https://registry.npmmirror.com && \
    npm config set proxy http://host.docker.internal:7897 && \
    npm config set https-proxy http://host.docker.internal:7897

# 全局安装 pnpm
RUN npm install -g pnpm