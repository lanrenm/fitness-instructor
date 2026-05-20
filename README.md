# Fitness Instructor

> 健身教练应用

## 技术栈

| 层级 | 技术 | 端口 |
|------|------|------|
| 前端 | React + Vite | `5173` |
| BFF | Next.js | `3000` |
| 后端 | NestJS | `3001` |
| 数据库 | PostgreSQL | `5432` |

## 项目结构

```
fitness-instructor/
├── apps/
│   ├── api/          # NestJS 后端（核心业务逻辑）
│   ├── bff/          # NextJS BFF 层（接口聚合/转发）
│   └── web/          # React 前端
├── services/         # 数据库等基础设施
│   └── postgres/
├── packages/         # 共享代码（可选）
├── .docker/          # 🔥 Docker 配置集中管理
│   ├── docker-compose.yml
│   ├── .env.example
│   └── Makefile
└── README.md
```

## 快速开始

### 1. 初始化环境变量

```bash
cd .docker
cp .env.example .env
# 编辑 .env，修改密码等配置
```

### 2. 启动所有服务

```bash
cd .docker
docker compose up -d

# 或者使用 Makefile
make up
```

### 3. 查看服务状态

```bash
docker compose ps

# 或
make ps
```

### 4. 查看日志

```bash
# 所有服务
make logs

# 指定服务
make logs-api
make logs-bff
make logs-web
```

### 5. 停止服务

```bash
make down

# 清除数据（慎用！）
make down-v
```

## Makefile 常用命令

```bash
make help          # 查看所有可用命令
make up            # 启动
make down          # 停止
make restart       # 重启
make logs          # 查看日志
make shell-api     # 进入 API 容器
make db-migrate    # 运行数据库迁移
make clean         # 清理
```

## 服务地址

| 服务 | 地址 |
|------|------|
| Web 前端 | http://localhost:5173 |
| BFF 层 | http://localhost:3000 |
| API 后端 | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

## 开发说明

### 初始化各服务项目

```bash
# NestJS API
cd apps/api
npx @nestjs/cli new . --skip-git --package-manager npm

# NextJS BFF
cd apps/bff
npx create-next-app@latest . --typescript --eslint --no-tailwind --src-dir --app --no-import-alias

# React Web
cd apps/web
npm create vite@latest . -- --template react-ts
```

### 初始化数据库（以 Prisma 为例）

```bash
cd apps/api
npm install prisma @prisma/client
npx prisma init

# 编辑 .env 中的 DATABASE_URL
# 然后运行迁移
cd ../..
make db-migrate
```

### 添加新的微服务

1. 在 `apps/` 下创建新服务目录
2. 添加 `Dockerfile`
3. 在 `.docker/docker-compose.yml` 中添加服务配置
4. 在 `.docker/Makefile` 中添加便捷命令

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|-------|
| `POSTGRES_USER` | 数据库用户名 | `fitness` |
| `POSTGRES_PASSWORD` | 数据库密码 | `fitness123` |
| `POSTGRES_DB` | 数据库名 | `fitness_instructor` |
| `API_PORT` | NestJS API 端口 | `3001` |
| `BFF_PORT` | NextJS BFF 端口 | `3000` |
| `WEB_PORT` | React Dev Server 端口 | `5173` |
| `JWT_SECRET` | JWT 签名密钥 | - |
| `VITE_API_BASE_URL` | 前端访问 BFF 的地址 | `http://localhost:3000` |
