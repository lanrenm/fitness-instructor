FROM node:24.14.0-alpine

WORKDIR /app

# 安装依赖（利用 Docker 缓存）
COPY package*.json ./
RUN npm ci --only=production

# 复制源码（开发模式下会被 volume 覆盖）
COPY . .

# 暴露端口
EXPOSE 3001

# 启动命令（默认 dev 模式）
CMD ["npm", "run", "start:dev"]
