# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## 项目结构
my-react-app/
├── public/                     # 纯静态资源（不会被构建工具编译）
│   ├── index.html              # 应用入口 HTML
│   ├── favicon.ico             # 网站图标
│   └── robots.txt              # SEO 爬虫规则
├── src/                        # 核心源代码目录
│   ├── assets/                 # 静态资源（图片、字体、全局 SVG 等）
│   │   ├── images/
│   │   └── fonts/
│   │
│   ├── components/             # 【纯 UI 组件】无业务逻辑、高度可复用的基础组件
│   │   ├── Button/             # 建议按组件名建立独立文件夹
│   │   │   ├── index.tsx       # 组件逻辑与导出
│   │   │   ├── Button.module.css # 组件专属样式
│   │   │   └── types.ts        # 组件相关的 TS 类型
│   │   └── Modal/
│   │
│   ├── features/               # 【业务功能模块】(强烈推荐！)
│   │   ├── auth/               # 认证模块（登录、注册）
│   │   │   ├── components/     # 该模块私有的组件
│   │   │   ├── hooks/          # 该模块私有的 Hooks
│   │   │   ├── services/       # 该模块专属的 API 请求
│   │   │   └── AuthPage.tsx    # 模块对应的页面组件
│   │   ├── dashboard/          # 仪表盘模块
│   │   └── user-profile/       # 用户资料模块
│   │
│   ├── pages/                  # 【页面级组件】与路由一一对应
│   │   ├── Home.tsx            # 首页 (/)
│   │   ├── NotFound.tsx        # 404 页面
│   │   └── User/               # 也可以按模块划分子文件夹
│   │       ├── List.tsx        # 用户列表页
│   │       └── Detail.tsx      # 用户详情页
│   │
│   ├── layouts/                # 【布局组件】跨页面复用的框架结构
│   │   ├── MainLayout.tsx      # 包含公共 Header 和 Footer 的主布局
│   │   └── DashboardLayout.tsx # 后台管理系统的侧边栏布局
│   │
│   ├── routes/                 # 【路由配置】集中管理所有路由映射
│   │   └── index.tsx           # 使用 React Router 定义路由表
│   │
│   ├── services/               # 【全局 API 层】统一管理后端接口请求
│   │   ├── request.ts          # 封装 Axios/Fetch 实例（拦截器、统一错误处理）
│   │   ├── userApi.ts          # 用户相关的全局接口
│   │   └── orderApi.ts         # 订单相关的全局接口
│   │
│   ├── store/                  # 【全局状态管理】(Redux / Zustand / Context)
│   │   ├── authStore.ts        # 认证相关的状态切片
│   │   └── index.ts            # 状态管理的总入口
│   │
│   ├── hooks/                  # 【全局自定义 Hooks】跨模块复用的逻辑抽离
│   │   ├── useAuth.ts          # 全局鉴权 Hook
│   │   ├── useDebounce.ts      # 防抖 Hook
│   │   └── useLocalStorage.ts  # 本地存储 Hook
│   │
│   ├── utils/                  # 【工具函数】纯函数、常量、辅助方法
│   │   ├── format.ts           # 日期、数字格式化
│   │   └── validate.ts         # 表单校验规则
│   │
│   ├── types/                  # 【全局 TS 类型定义】
│   │   ├── global.d.ts         # 全局变量声明
│   │   └── api.d.ts            # 统一的 API 响应结构类型
│   │
│   ├── styles/                 # 【全局样式】
│   │   ├── variables.css       # CSS 变量（主题色、间距等）
│   │   └── reset.css           # 样式重置
│   │
│   ├── App.tsx                 # 根组件（引入路由、全局布局等）
│   └── main.tsx                # 应用入口文件（渲染 App 到 DOM）
│
├── .env                        # 环境变量配置
├── package.json                # 项目依赖与脚本
├── tsconfig.json               # TypeScript 编译配置
└── vite.config.ts              # Vite 构建工具配置
