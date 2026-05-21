# 项目规范文档

## 命名规范

### 文件命名

1. **组件文件**: 使用大驼峰命名法 (PascalCase)
   - 例: `CardWrapper`, `CTable`, `SearchTree`

2. **工具/钩子文件**: 使用小驼峰命名法 (camelCase)
   - 例: `useCheckRole.ts`, `dateUtils.ts`, `index.ts`

3. **样式文件**: 使用小写字母加连字符 (kebab-case) 或与组件同名
   - 例: `index.less`, `base-chart.less`

### 变量命名

1. **常量**: 使用大写字母和下划线
   - 例: `MAX_COUNT`, `API_URL`

2. **变量**: 使用小驼峰命名法
   - 例: `userData`, `tableConfig`

3. **布尔值变量**: 使用 `is`, `has`, `can` 等前缀
   - 例: `isLoading`, `hasPermission`, `canEdit`

4. **事件处理函数**: 使用 `handle` 前缀
   - 例: `handleClick`, `handleSubmit`, `handleChange`

## 工具函数规范

1. **文件组织**:
   - 通用工具函数放在 `/src/utils/` 目录下
   - 按功能分类，如 `dateUtils.ts`, `url.ts`, `auth.ts` 等

2. **函数编写**:
   - 函数必须有明确的输入输出类型定义
   - 函数应该是纯函数，避免副作用
   - 必须添加函数注释，说明用途、参数和返回值
   - 示例:
     ```ts
     /**
      * @description 解析URL参数
      * @param url 完整URL字符串
      * @returns 解析后的参数对象
      */
     export function parseUrlParams(url: string): Record<string, string> {
       // 实现...
     }
     ```

## 类型定义规范

1. **文件组织**
   - 类型定义放在 `/src/types` 目录下
   - 按功能或模块分类，如 `utilsType.ts` 等
   - 提供通用入口 `index.type` 引入分类后的类型定义文件

2. **类型定义**
   - 类型、属性的注解需要使用 `@description` 注解，`@enums` 等注解可以根据实际情况添加
   - 命名规范参照：`interface` 的命名需要以大写的 `I` 开头，`type` 的命名需要以大写的 `T` 开头，并且随后的类型实际名称需要以大驼峰的形式命名。
   - 示例：

   ```ts
   /**
    * @description useCapacityCheck-传参
    */
   export interface IUseCapacityCheckProps {
     /**
      * @description 日期
      */
     date: string;
     /**
      * @description 交易角色
      */
     tradeRole: ITradeRole;
     /**
      * @description 当前 Tab
      */
     tab?: ICapacityCheckTab;
     /**
      * @description 更新页面状态函数
      */
     updatePageState?: IUpdatePageState;
     /**
      * @description 时刻点列表
      */
     points: string[];
     /**
      * @description 校验项 QueryKey 映射
      */
     checkQueryKeys: RefObject<Record<string, QueryKey>>;
   }

   /**
    * @description useCapacityCheck-返回结果
    */
   export type TUseCapacityCheckProps = Record<string, any>;
   ```

## 代码提交规范

1. **提交信息格式**:

   ```
   <type>(<scope>): <subject>

   <body>

   <footer>
   ```

2. **类型(type)定义**:
   - feat: 新功能
   - fix: 修复bug
   - docs: 文档更新
   - style: 代码格式调整
   - refactor: 重构
   - perf: 性能优化
   - test: 测试相关
   - chore: 构建过程或辅助工具变动

3. **分支管理**:
   - 主分支: master/main
   - 开发分支: develop
   - 功能分支: feature-\*
   - 修复分支: hotfix-\*

## 异常处理规范

1. **前端异常**:
   - 使用 try-catch 捕获可预见的异常
   - 使用 ErrorBoundary 组件捕获 React 渲染异常

2. **API 异常**:
   - 统一处理 API 请求异常，包括网络错误、业务错误等
   - 为用户提供友好的错误提示

3. **用户操作错误**:
   - 提供清晰的错误提示
   - 引导用户进行正确操作
   - 示例:
     ```tsx
     const handleSubmit = () => {
       if (!formData.name) {
         message.error('请输入名称');
         return;
       }
       // 提交表单
     };
     ```

## 测试规范

1. **单元测试**:
   - 组件测试文件放在组件目录下的 `__test__` 目录中
   - 工具函数应有对应的单元测试

2. **测试覆盖率**:
   - 核心组件和工具函数应有足够的测试覆盖率
   - 关键业务逻辑必须有测试用例

## 国际化规范

1. **文本管理**:
   - 所有用户可见文本应使用国际化配置
   - 不应硬编码中文字符串

2. **日期和数字格式**:
   - 考虑不同地区的日期和数字格式
   - 使用统一的格式化函数

## 总结

本规范文档旨在统一项目开发标准，提高代码质量和开发效率。所有团队成员应遵循以下核心原则：

1. **一致性**: 遵循统一的命名、结构和样式规范
2. **可维护性**: 编写清晰、简洁、易于理解的代码
3. **可重用性**: 抽象通用逻辑，避免重复代码
4. **性能优化**: 关注应用性能，避免不必要的渲染和计算
5. **用户体验**: 提供友好的交互和错误提示
