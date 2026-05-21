This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 项目结构

my-nextjs-bff-app/
├── prisma/                     # (可选) 如果你直接在 Next.js 中操作数据库
│   ├── schema.prisma           # 定义数据模型
│   └── migrations/             # 数据库迁移文件
├── public/                     # 存放静态资源（图片、字体等）
├── src/                        # 核心源代码目录
│   ├── app/                    # 【BFF 核心】App Router 路由与 API 处理器
│   │   ├── (auth)/             # 路由组（例如登录注册流程，不影响 URL 路径）
│   │   │   ├── login/page.tsx        # SSR 渲染的登录页面
│   │   │   └── register/page.tsx     # SSR 渲染的注册页面
│   │   ├── api/                # 【BFF 关键】内部 API 路由（充当 BFF 网关）
│   │   │   ├── users/
│   │   │   │   └── route.ts          # 对应 /api/users 接口，处理增删改查
│   │   │   └── posts/
│   │   │       └── [id]/
│   │   │           └── route.ts      # 动态路由，对应 /api/posts/:id
│   │   ├── layout.tsx          # 全局根布局
│   │   └── page.tsx            # 首页 (/)
│   │
│   ├── components/             # 可复用的 React UI 组件
│   │   ├── ui/                 # 基础 UI 组件（按钮、卡片、输入框等）
│   │   ├── forms/              # 业务表单组件
│   │   └── layouts/            # 布局组件（如 Header, Footer, Sidebar）
│   │
│   ├── services/               # 【BFF 逻辑层】对接外部微服务或遗留 API
│   │   ├── http.ts             # 封装基础的 HTTP 请求客户端（如 Axios/Fetch）
│   │   └── modules/            # 按业务模块划分的外部接口调用
│   │       ├── user.service.ts # 封装用户相关的外部 API 请求与数据转换
│   │       └── order.service.ts# 封装订单相关的外部 API 请求与数据转换
│   │
│   ├── lib/                    # 核心工具库与第三方 SDK 初始化
│   │   ├── utils.ts            # 纯函数工具（日期格式化、数据处理等）
│   │   └── auth.ts             # JWT 解析、加密等认证相关的底层逻辑
│   │
│   ├── hooks/                  # 自定义 React Hooks（客户端交互逻辑抽离）
│   │   ├── useAuth.ts          # 处理用户登录态、Token 刷新等
│   │   └── useFetchData.ts     # 封装通用的数据请求 Hook
│   │
│   ├── types/                  # 全局 TypeScript 类型定义
│   │   ├── user.d.ts           # 用户相关的 TS 接口/类型
│   │   └── api.d.ts            # 统一 API 响应结构的类型定义
│   │
│   └── middleware.ts           # (位于 src 根目录) Next.js 中间件，处理路由拦截、鉴权等
│
├── .env.local                  # 本地环境变量（存放 API_SECRET_KEY、DATABASE_URL 等）
├── next.config.ts              # Next.js 的核心配置文件
├── package.json                # 项目依赖与脚本
└── tsconfig.json               # TypeScript 编译配置