FROM node:22

WORKDIR /app

ENV HTTP_PROXY=http://host.docker.internal:7897
ENV HTTPS_PROXY=http://host.docker.internal:7897
ENV http_proxy=http://host.docker.internal:7897
ENV https_proxy=http://host.docker.internal:7897

RUN npm config set registry https://registry.npmmirror.com && \
    npm config set proxy http://host.docker.internal:7897 && \
    npm config set https-proxy http://host.docker.internal:7897

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .

# 在容器启动时重建 native modules（适配 Linux 环境）
# 并设置 NAPI_RS 强制使用 GNU binding
RUN echo '#!/bin/sh\n\
npm rebuild\n\
exec npm run dev -- --host 0.0.0.0' > /start.sh && chmod +x /start.sh

EXPOSE 5173

# 覆盖默认 CMD，使用启动脚本
CMD ["/start.sh"]