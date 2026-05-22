FROM node:22

WORKDIR /app

ENV HTTP_PROXY=http://host.docker.internal:7897
ENV HTTPS_PROXY=http://host.docker.internal:7897
ENV http_proxy=http://host.docker.internal:7897
ENV https_proxy=http://host.docker.internal:7897

RUN npm config set registry https://registry.npmmirror.com && \
    npm config set proxy http://host.docker.internal:7897 && \
    npm config set https-proxy http://host.docker.internal:7897

RUN npm install -g pnpm

COPY package*.json ./
COPY . .

# pnpm install
RUN pnpm install

# 为 native modules 创建目录和软链接，解决 pnpm isolated linker 下 .node 文件路径不对的问题
# rolldown 和 @tailwindcss/oxide 的 JS 代码期望 .node 文件在包目录下
RUN cd node_modules && \
    mkdir -p @rolldown/binding-linux-arm64-gnu && \
    ln -sf ../.pnpm/@rolldown+binding-linux-arm64-gnu@1.0.2/node_modules/@rolldown/binding-linux-arm64-gnu/rolldown-binding.linux-arm64-gnu.node \
        @rolldown/binding-linux-arm64-gnu/rolldown-binding.linux-arm64-gnu.node && \
    ln -sf ../.pnpm/@tailwindcss+oxide-linux-arm64-gnu@4.3.0/node_modules/@tailwindcss/oxide-linux-arm64-gnu/tailwindcss-oxide.linux-arm64-gnu.node \
        @tailwindcss/oxide/tailwindcss-oxide.linux-arm64-gnu.node && \
    ln -sf ../.pnpm/lightningcss-linux-arm64-gnu@1.32.0/node_modules/lightningcss-linux-arm64-gnu/lightningcss.linux-arm64-gnu.node \
        lightningcss/lightningcss.linux-arm64-gnu.node

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
