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
│   ├── docker-compose.yml  # 服务编排
│   ├── Makefile            # 便利脚本
│   ├── BUILD.md            # 📖 Docker 搭建详细文档
│   ├── .env.example       # 环境变量模板
│   └── .env               # 实际环境变量（不提交 git）
└── README.md
```

## 快速开始

### 1. 安装 Docker 环境

参考 [.docker/BUILD.md](./.docker/BUILD.md) 完成以下步骤：

1. 安装 OrbStack 或 Docker Desktop
2. 配置网络代理
3. 验证 Docker 可用

### 2. 初始化环境变量

```bash
cd .docker
cp .env.example .env
# 编辑 .env，修改密码等配置
```

### 3. 构建镜像

```bash
cd .docker
make build
```

> ⚠️ 前提：本机需要开启代理（如 Clash Verge），端口 `7897`。

### 4. 启动服务

```bash
# 拉取 PostgreSQL 镜像（可能需要多试几次）
docker pull postgres:16-alpine

# 启动所有服务
make up

# 查看状态
make ps
```

### 5. 访问服务

| 服务 | 地址 |
|------|------|
| Web 前端 | http://localhost:5173 |
| BFF 层 | http://localhost:3000 |
| API 后端 | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

## Makefile 常用命令

```bash
make help          # 查看所有可用命令
```

### 启动/停止

```bash
make up              # 启动所有服务
make down           # 停止所有服务
make restart        # 重启
```

### 构建

```bash
make build          # 构建所有镜像（API / BFF / Web）
make build-api      # 只构建 API
make build-bff      # 只构建 BFF
make build-web      # 只构建 Web
make rebuild        # 重新构建并启动
```

### 日志

```bash
make logs           # 查看所有日志
make logs-api      # 只看 API 日志
make logs-bff      # 只看 BFF 日志
make logs-web      # 只看 Web 日志
```

### 进入容器

```bash
make shell-api      # 进入 API 容器
make shell-bff      # 进入 BFF 容器
make shell-web      # 进入 Web 容器
make shell-postgres # 进入 PostgreSQL
```

### 数据库

```bash
make db-migrate     # 运行数据库迁移
make db-generate    # 生成 Prisma Client
make db-reset       # 重置数据库
```

## 开发说明

### 初始化各服务项目

```bash
# NestJS API
cd apps/api
npx @nestjs/cli new . --skip-git --package-manager npm --skip-install
cd ../..

# NextJS BFF
cd apps/bff
npx create-next-app@latest . --typescript --eslint --no-tailwind --src-dir --app --no-import-alias --skip-install
cd ../..

# React Web
cd apps/web
npm create vite@latest . -- --template react-ts
cd ../..
```

### 安装依赖

```bash
cd apps/api && npm install && cd ../..
cd apps/bff && npm install && cd ../..
cd apps/web && npm install && cd ../..
```

### 配置数据库

```bash
cd apps/api
npm install prisma @prisma/client
npx prisma init
# 编辑 .env 中的 DATABASE_URL
# 然后运行迁移
cd ../..
make db-migrate
```

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

## 添加新的微服务

1. 在 `apps/` 下创建新服务目录
2. 添加 `Dockerfile`（参考 [.docker/BUILD.md](./.docker/BUILD.md)）
3. 在 `.docker/docker-compose.yml` 中添加服务配置
4. 在 `.docker/Makefile` 中添加便捷命令
5. 执行 `make build` 重新构建镜像

## 文档

- [Docker 搭建详细文档](./.docker/BUILD.md) — 从零搭建 Docker 的完整指南，包含代理配置、常见问题排查等