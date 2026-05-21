<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## 项目结构

api/
├── prisma/ # Prisma 核心配置与数据库相关
│ ├── migrations/ # 数据库迁移文件（自动生成，不要手动修改）
│ ├── schema.prisma # 核心：定义数据模型、数据库连接和 Prisma 配置
│ └── seed.ts # （可选）数据库种子脚本，用于初始化测试数据
├── src/ # 后端应用源代码
│ ├── common/ # 全局通用的代码
│ │ ├── decorators/ # 自定义装饰器（如：用户身份提取 @CurrentUser()）
│ │ ├── filters/ # 全局异常过滤器
│ │ ├── guards/ # 全局守卫（如：权限校验 AuthGuard）
│ │ ├── interceptors/ # 全局拦截器（如：统一响应格式 TransformInterceptor）
│ │ └── pipes/ # 全局管道（如：参数校验 ValidationPipe）
│ ├── config/ # 配置文件（如环境变量加载、第三方服务配置等）
│ ├── modules/ # 业务功能模块（项目的核心区域）
│ │ ├── users/ # 用户模块（示例）
│ │ │ ├── dto/ # 数据传输对象（如：create-user.dto.ts, update-user.dto.ts）
│ │ │ ├── entities/ # 实体类（返回给前端的 User 数据结构，可与 Prisma Model 区分开）
│ │ │ ├── users.controller.ts # 控制器：处理 HTTP 请求路由
│ │ │ ├── users.service.ts # 服务层：处理具体的业务逻辑和 Prisma 数据库操作
│ │ │ └── users.module.ts # 模块文件：组织该模块的内部依赖
│ │ ├── auth/ # 认证授权模块（登录、注册、JWT 策略等）
│ │ └── posts/ # 其他业务模块...
│ ├── prisma/ # NestJS 封装的 Prisma 服务
│ │ ├── prisma.service.ts # 继承 PrismaClient，管理数据库的连接与断开生命周期
│ │ └── prisma.module.ts # 全局 Prisma 模块，导出 PrismaService 供其他模块注入使用
│ ├── app.module.ts # 应用的根模块，负责导入所有全局模块和业务模块
│ └── main.ts # 应用的入口文件，负责启动 NestJS 服务
├── test/ # 自动化测试目录（单元测试 e2e 测试）
├── .env # 环境变量（存放 DATABASE_URL、JWT_SECRET 等敏感信息）
├── .gitignore # Git 忽略文件配置
├── nest-cli.json # NestJS CLI 的构建配置
├── package.json # 项目依赖与 npm scripts 脚本
└── tsconfig.json # TypeScript 编译配置
