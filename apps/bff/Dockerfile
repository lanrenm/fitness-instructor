FROM node22-pnpm:latest

WORKDIR /app

# 1. 复制 monorepo 根配置
COPY package.json pnpm-workspace.yaml ./

# 2. 复制所有 packages 的源码 (假设 packages 下是各个子包)
# 注意：这里只复制源码，不复制会被挂载覆盖的应用代码 (apps/bff)
COPY packages ./packages

# 3. 构建 ui-components 并安装依赖
# 进入 ui-components 目录构建
WORKDIR /app/packages/ui-components
RUN pnpm install --ignore-scripts && pnpm build

# 4. 回到根目录，复制 bff 目录代码
# 注意：这里不再 COPY apps/bff，代码由 volume mount 提供
WORKDIR /app

COPY apps/bff . 

# 使用 sed 命令精准替换 package.json 中的路径字符串
# -i 表示直接修改源文件，s/原字符串/新字符串/g 表示全局替换
RUN sed -i 's|"@fitness/ui-components": "file:../../packages/ui-components"|"@fitness/ui-components": "file:packages/ui-components"|g' package.json

# 配置 hoisted 模式
RUN echo "node-linker=hoisted" > .npmrc
# 安装根目录依赖
RUN pnpm install --ignore-scripts

# 5. 备份 node_modules (关键步骤)
# 此时 node_modules 包含了正确构建的 @fitness/ui-components
RUN mkdir -p /app-original-modules && \
    cp -a ./node_modules /app-original-modules/

EXPOSE 3000

CMD ["sh", "-c", "cp -rn /app-original-modules/node_modules/* /app/node_modules/ 2>/dev/null || true; exec npm run dev"]

