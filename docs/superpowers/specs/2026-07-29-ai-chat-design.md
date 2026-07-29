# 智能问答 (AI Chat) 设计

**Date:** 2026-07-29

## 目标

实现 `/ai/chat` 模块,完整覆盖临时文档 `docs/ai-chat-temp.md` 列出的 4 个核心能力:

1. 流式输出 + 思考链展示(SSE 双层折叠 UI)
2. 训练记录关联与 RAG(基于 pgvector + Anthropic SDK Function Calling 替代方案)
3. 多轮对话压缩(滑动窗口 + 背景摘要)
4. 聊天内容模糊搜索(BM25 + 向量双路)

**本期不实现统计面板,但 schema/观测字段就位**(为未来统计预留),训练计划/会话模块补齐后端 CRUD 以便 RAG 拉取数据,前端暂不暴露新页面/导航。

## 现状

已就位(无需改动):
- 路由 `/ai/chat`(`apps/web/src/routes/index.tsx`)和导航模块(`apps/web/src/config/modules.ts`)
- 占位页 `apps/web/src/pages/Layout/AI/Chat.tsx`(渲染 `PlaceholderPage`)
- NestJS `AuthModule` 提供 `JwtAuthGuard`
- Prisma 表 `User` / `Workout` / `WorkoutExcercises` / `TrainingSession`(已有 schema,缺业务模块)
- BFF 透明代理 `/api/*` 到 `http://api:3001`
- 设计 token 主色 `#FF6B35`、卡片 `rounded-2xl` 阴影体系、Tailwind v4 safelist 模式
- 没有任何 AI/LLM/向量依赖,本期全部新增

## 已确认的关键决策

| 决策 | 选定 |
|---|---|
| 模型 | **多 provider 可插拔**:本期默认 `MiniMax-M3`(对话) + `MiniMax-M3-haiku`(摘要),通过 `ModelRegistry` 注册表抽象,后续可零代码切换到 DeepSeek / 其他 OpenAI 兼容模型(只新增 adapter,不修改业务调用方) |
| 流式协议 | NestJS `@Sse()` + BFF ReadableStream pipe + 前端 `fetch + ReadableStream` 自解析 |
| 向量库 | Postgres + pgvector 扩展,emb 由 MiniMax-M3 端点产出 |
| RAG 数据源 | `TrainingSession` + `Workout` + `WorkoutExcercises` + `Excercises` + `MuscleGroup`(全部按 `userId` 过滤) |
| 压缩策略 | 滑动窗口 N=6 + 后台异步摘要(独立 fire-and-forget) |
| 搜索 | BM25(tsvector)+ 向量双路 + RRF |
| 持久化 | Postgres,userId 严格隔离,跨用户访问返回 403 |
| 统计 | 本期不实现 UI,但 schema 写好观测字段(`promptTokens`/`completionTokens`/`ragHits` 等) |
| 布局 | 三栏(左历史 + 中对话流 + 右设置) |

补充(实现方设计时替用户定,低风险):
- 嵌入存储用独立 `AiEmbedding` 表(非业务表加列),统一 `chunkText` + `vector(1024)`
- 训练计划/会话模块本期**只补后端 API**,前端不新增页面/导航(避免被误读为完整业务模块上线)
- 嵌入写入走业务模块 service 层显式调 `EmbeddingsService.upsert(...)`,**不**靠后台 rebuild
- 压缩任务用 fire-and-forget(流响应不等摘要,失败写日志下次重试)
- 鉴权沿用 `JwtAuthGuard`,userId 来自 token,所有 RAG 召回结果**必须**再次校验 owner 归属

## 环境配置

通过 `apps/api/.env` 注入,`apps/api/src/main.ts` 启动期载入(沿用现有 `dotenv/config`):

```
# 模块级:不同调用场景的默认模型 id
AI_CHAT_MODEL=MiniMax-M3
AI_CHAT_SUMMARY_MODEL=MiniMax-M3-haiku
AI_CHAT_EMBED_MODEL=MiniMax-M3

# 行为阈值
AI_CHAT_TEMPERATURE=0.7
AI_CHAT_WINDOW_SIZE=6
AI_CHAT_COMPRESS_COOLDOWN_MS=300000
AI_CHAT_RAG_TIMEOUT_MS=600
AI_CHAT_EMBED_TIMEOUT_MS=2000
AI_CHAT_EMBED_DIM=1024

# 模型 provider 注册(可同时启用多个 provider,模块级 *_MODEL 取对应 provider 的 model id)
# provider 协议 = anthropic | openai-compatible
MODELS_PROVIDER_MINIMAX_ID=MiniMax-M3
MODELS_PROVIDER_MINIMAX_PROTOCOL=anthropic
MODELS_PROVIDER_MINIMAX_API_KEY=<...>
MODELS_PROVIDER_MINIMAX_BASE_URL=<...>
MODELS_PROVIDER_MINIMAX_CHAT_MODEL=MiniMax-M3
MODELS_PROVIDER_MINIMAX_SUMMARY_MODEL=MiniMax-M3-haiku
MODELS_PROVIDER_MINIMAX_EMBED_MODEL=MiniMax-M3
MODELS_PROVIDER_MINIMAX_EMBED_DIM=1024

# 备选 provider 示例(本期不启用,仅展示可扩展形态)
# MODELS_PROVIDER_DEEPSEEK_ID=deepseek-chat
# MODELS_PROVIDER_DEEPSEEK_PROTOCOL=openai-compatible
# MODELS_PROVIDER_DEEPSEEK_API_KEY=<...>
# MODELS_PROVIDER_DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# MODELS_PROVIDER_DEEPSEEK_CHAT_MODEL=deepseek-chat
# MODELS_PROVIDER_DEEPSEEK_EMBED_DIM=1024
```

`AiModule` 注册 `ConfigModule.forFeature(...)`,在 service 构造时读出。维度 `1024` 与 MiniMax-M3 emb 端点协商后调整(迁移文件 `comment` 已标注)。

**provider 切换语义**:换模型只需要改 `AI_CHAT_MODEL` / `AI_CHAT_SUMMARY_MODEL` 指向的 `MODELS_PROVIDER_*_ID`,或在 `.env` 启用/停用某个 provider 块。**业务 service 的调用签名不变**(`ModelRegistry.resolve(providerId).streamChat({...})`),参数/接口格式调整本期**暂不考虑**,留作未来 issue。

## 枚举与常量(前后端共享定义)

通过 `packages/shared-types/src/ai.ts`(本期新建)共享:

```ts
export const AI_MESSAGE_ROLE = { USER: 'user', ASSISTANT: 'assistant', SYSTEM: 'system' } as const;
export type TAiMessageRole = typeof AI_MESSAGE_ROLE[keyof typeof AI_MESSAGE_ROLE];

export const AI_RAG_OWNER_TYPE = {
  TRAINING_SESSION: 'training_session',
  WORKOUT: 'workout',
  EXCERCISE: 'excercise',
  MUSCLE_GROUP: 'muscle_group',
  MESSAGE: 'message',
} as const;
export type TAiRagOwnerType = typeof AI_RAG_OWNER_TYPE[keyof typeof AI_RAG_OWNER_TYPE];

export const AI_EVENT = {
  META: 'meta',
  REASONING: 'reasoning',
  CONTENT: 'content',
  CITATIONS: 'citations',
  USAGE: 'usage',
  DONE: 'done',
  ERROR: 'error',
} as const;
export type TAiEvent = typeof AI_EVENT[keyof typeof AI_EVENT];

export interface IAiCitation { type: TAiRagOwnerType; id: string; score: number; snippet: string }
export interface IAiUsage { promptTokens: number; completionTokens: number; ragHits: number; compressed: boolean }
export interface IAiError { code: string; message: string; retryable: boolean }

/**
 * Provider 协议族(本期只实现 'anthropic' 一族,'openai-compatible' 留作扩展位)。
 * 后续若接 DeepSeek / 通义千问 / 本地 vllm,只需新增对应 adapter,
 * 不动 ModelRegistry / 业务调用方。
 */
export const MODEL_PROTOCOL = {
  ANTHROPIC: 'anthropic',
  OPENAI_COMPATIBLE: 'openai-compatible',
} as const;
export type TModelProtocol = typeof MODEL_PROTOCOL[keyof typeof MODEL_PROTOCOL];

/**
 * Provider 能力位 — 业务调用方按能力选择 provider,不绑死 model 名。
 * 例:CompressionService 用 hasCapability('summarize') 的 provider,
 * 不直接写 'MiniMax-M3-haiku'。
 */
export const MODEL_CAPABILITY = {
  STREAM_CHAT: 'streamChat',
  SUMMARIZE: 'summarize',
  EMBED: 'embed',
} as const;
export type TModelCapability = typeof MODEL_CAPABILITY[keyof typeof MODEL_CAPABILITY];

/**
 * 业务调用方统一入参(provider 由 ModelRegistry 解析,model 名按 provider 内部约定传)。
 */
export interface IStreamChatParams {
  system: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  /** 走 provider 的 reasoning/thinking 通道;若 provider 不支持,adapter 内部降级 */
  thinking?: boolean;
}

export type TStreamChatEventType = 'reasoning' | 'content' | 'usage' | 'done' | 'error';

export interface IStreamChatEvent {
  type: TStreamChatEventType;
  delta?: string;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
  error?: IAiError;
}

export interface ISummarizeParams {
  prompt: string;
  maxTokens?: number;
  /** 输出形态:freeform(纯文本) | structured(JSON) */
  format?: 'freeform' | 'structured';
}

export interface IEmbedParams {
  input: string | string[];
}
```

Web 端 `apps/web/src/services/aiService.ts` import 上述类型,确保事件 schema 单一来源。

## 数据模型(新增 + 改动)

`apps/api/prisma/schema.prisma` 追加:

```prisma
/// pgvector 扩展必须先建:CREATE EXTENSION IF NOT EXISTS vector;
/// 该扩展由 Prisma migration 文件顶部手写 SQL 启用,见 _pgvector_init migration。

model AiConversation {
  id          String   @id @default(cuid())
  userId      String
  title       String?
  summary     String?
  /// Provider id,与 ModelRegistry 中注册的 provider 一致(默认 'MiniMax-M3')。
  /// 切换模型只需把这里的值改成已注册 provider 的 id;不修改 schema。
  model       String   @default("MiniMax-M3")
  temperature Float    @default(0.7)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages    AiMessage[]
  @@index([userId, updatedAt])
}

model AiMessage {
  id               String   @id @default(cuid())
  conversationId   String
  role             String   // 'user' | 'assistant' | 'system'
  content          String
  reasoning        String?
  /// 命中的 RAG 来源列表(IAiCitation[])。用于统计与回溯。
  ragContext       Json?
  /// 实际产出本条消息的 provider id(可能与 conversation.model 不同,
  /// 例如对话用 MiniMax-M3,本条因 RAG 过长走兜底 provider)。便于事后分析。
  providerId       String?
  promptTokens     Int      @default(0)
  completionTokens Int      @default(0)
  compressed       Boolean  @default(false)
  createdAt        DateTime @default(now())
  conversation     AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId, createdAt])
}

/// vector(N) 维度由当前注册 embed provider 的维度(MODELS_PROVIDER_*_EMBED_DIM)决定,
/// 默认 1024。若换 embed provider 且维度不同:1) 新 migration 改列类型;2) 清空
/// AiEmbedding;3) 重新 upsert。不支持在线维度切换。
model AiEmbedding {
  id        String                              @id @default(cuid())
  ownerType String                              // TAiRagOwnerType
  ownerId   String
  /// 本条 embedding 由哪个 provider 产出(便于混合 provider 时区分)。
  providerId String?
  chunkText String
  /// NOTE: dimension depends on registered embed provider. Update via new migration if needed.
  embedding Unsupported("vector(1024)")
  createdAt DateTime                             @default(now())
  @@unique([ownerType, ownerId, chunkText])
  @@index([ownerType])
}
```

`User` 关系补一行:`aiConversations AiConversation[]`。

新增 Prisma migration:
- `20260729000000_ai_chat_init`:建 pgvector 扩展(`CREATE EXTENSION IF NOT EXISTS vector;`)+ 三张表 + 索引
- 文件顶部注释:「vector(N) 维度若改,需新 migration 改列 + 清表 + 重 embed」

## 后端架构

`apps/api/src/modules/ai/`(全新,镜像 `excercises` 模板):

```
ai/
├── ai.module.ts                    导入 ModelsModule;注册 providers / controllers
├── ai.controller.ts                @Controller('ai') @UseGuards(JwtAuthGuard)
├── ai-chat.service.ts              顶层编排
├── rag.service.ts                  三步召回
├── compression.service.ts          滑动窗口 + 摘要
├── embeddings.service.ts           调用 ModelRegistry 解析出的 embed provider + LRU cache
├── search.service.ts               双路召回 + RRF
├── ai-conversation.repository.ts
├── ai-message.repository.ts
└── dto/
    ├── create-conversation.dto.ts
    ├── update-conversation.dto.ts
    ├── send-message.dto.ts         { content: string, regenerate?: boolean, model?: string }
    └── stream-event.dto.ts         zod schema,共享 types
```

### ModelRegistry 与 Adapter(`apps/api/src/modules/models/`,全新)

支撑多 provider 可插拔的核心抽象,**所有业务 service 通过它调用模型**,不直接 import 任何 SDK。

```
models/
├── models.module.ts                全局模块(@Global()),其他模块直接注入 ModelRegistry
├── model-registry.service.ts       注册表 + resolve(providerId, capability) + 默认 provider 选择
├── model-provider.interface.ts     IModelProvider 接口(streamChat / summarize / embed)
├── providers/
│   ├── anthropic.provider.ts       本期实现,@anthropic-ai/sdk(支持 MiniMax-M3 / 任意 Anthropic 兼容端点)
│   └── openai-compatible.provider.ts  扩展位(本期 stub,不启用;DeepSeek / 通义 / vllm 共用)
└── model-config.loader.ts          读 MODELS_PROVIDER_* 环境变量,构造 provider 实例
```

**`IModelProvider`**(在 `packages/shared-types/src/ai.ts` 同处导出,API/BFF 都用):

```ts
export interface IModelProvider {
  readonly id: string;                     // 'MiniMax-M3' / 'deepseek-chat'
  readonly protocol: TModelProtocol;       // 'anthropic' | 'openai-compatible'
  readonly capabilities: TModelCapability[];
  readonly embedDim?: number;              // 仅当 capabilities 含 'embed' 时有意义

  /** 流式对话,统一产出 IStreamChatEvent;reasoning 不支持的 provider 直接不产出 reasoning 事件 */
  streamChat(params: IStreamChatParams, signal?: AbortSignal): AsyncIterable<IStreamChatEvent>;

  /** 摘要(压缩 / RAG 生成)。失败抛 ModelProviderError */
  summarize(params: ISummarizeParams, signal?: AbortSignal): Promise<string>;

  /** 嵌入;不支持时方法不存在(provider 校验 capabilities.includes('embed')) */
  embed(params: IEmbedParams, signal?: AbortSignal): Promise<number[][]>;
}
```

**`ModelRegistry` 用法**(业务侧典型调用):

```ts
// 取对话 provider(默认用 AI_CHAT_MODEL 指向的 provider;也可按 conversation.model 切换)
const chatProvider = this.registry.resolveForCapability(MODEL_CAPABILITY.STREAM_CHAT, {
  preferredId: conversation.model ?? this.cfg.get('AI_CHAT_MODEL'),
  fallback: 'MiniMax-M3',
});

// 取摘要 provider(默认用 AI_CHAT_SUMMARY_MODEL)
const summaryProvider = this.registry.resolveForCapability(MODEL_CAPABILITY.SUMMARIZE, {
  preferredId: this.cfg.get('AI_CHAT_SUMMARY_MODEL'),
  fallback: chatProvider.id,
});

// 取 embed provider(用于 AiEmbedding 写入 / 向量召回)
const embedProvider = this.registry.resolveForCapability(MODEL_CAPABILITY.EMBED, {
  preferredId: this.cfg.get('AI_CHAT_EMBED_MODEL'),
  fallback: undefined,    // 若无 embed provider,RAG 降级仅走关键词
});
```

**provider 配置解析规则**(`ModelConfigLoader`):
- 扫描所有 `MODELS_PROVIDER_*` 前缀环境变量,按 `*_ID` 聚合
- 每个 provider 块包含:`PROTOCOL` / `API_KEY` / `BASE_URL` / `CHAT_MODEL` / `SUMMARY_MODEL` / `EMBED_MODEL` / `EMBED_DIM`(均为可选,缺啥不注册啥能力)
- 同一 protocol 只能注册一个实例(避免 SDK client 重复)
- provider 启动时构造对应 SDK client;懒构造,首次 resolve 时实例化

**`AiChatService.stream(userId, conversationId, dto)` 编排顺序**(更新后):
1. `ConversationRepo.assertOwned(conversationId, userId)` → 不属当前 user 抛 `ForbiddenException`
2. `RagService.retrieve(userId, dto.content)`(超时 `AI_CHAT_RAG_TIMEOUT_MS`);失败/超时降级返回 `[]`(内部用 `embedProvider` 做向量召回)
3. 取最近 `AI_CHAT_WINDOW_SIZE=6` 条 `compressed=false` 的消息 + 可选 `conversation.summary` 拼成 system block
4. `chatProvider.streamChat({ system, messages, temperature, thinking:true }, signal)`(由 `dto.model ?? conversation.model ?? AI_CHAT_MODEL` 解析 provider);统一从 `IStreamChatEvent` 取出 chunk
5. 逐 chunk 发 SSE(事件名映射与之前一致):
   - 首事件 `meta`
   - `type === 'reasoning'` → `event: reasoning`
   - `type === 'content'` → `event: content`
   - `type === 'usage' \| 'done'` → 一次性发 `citations` + `usage` + `done`
   - `type === 'error'` → `event: error`
6. 末尾:`MessageRepo.appendMessage(user, assistant, { providerId, ragHits, tokens })` + `EmbeddingsService.upsert('message', msgId, content)` × 2(走 `embedProvider`)
7. `if (messages.count > AI_CHAT_WINDOW_SIZE && now - lastCompressedAt > AI_CHAT_COMPRESS_COOLDOWN_MS) setImmediate(() => CompressionService.run(conversationId))`(摘要走 `summaryProvider`)

**AbortController 中断**:`@Sse()` 的 Observable 在客户端断开时自动 `unsubscribe`,在 `finalize` 里把 `AbortSignal` 传给 `streamChat` / `summarize` / `embed`,provider adapter 内部取消 SDK 请求。

### RAG 召回细节

```sql
-- 向量召回(全库,ownerType 白名单)
SELECT "ownerType", "ownerId", chunktext,
       1 - (embedding <=> $1::vector) AS score
FROM "AiEmbedding"
WHERE "ownerType" IN ('training_session','workout','excercise','muscle_group')
ORDER BY embedding <=> $1::vector
LIMIT 12;

-- 关键词召回(并行,tsvector)
SELECT "ownerType", "ownerId", chunktext,
       ts_rank(to_tsvector('simple', chunktext), plainto_tsquery('simple', $1)) AS score
FROM "AiEmbedding"
WHERE to_tsvector('simple', chunktext) @@ plainto_tsquery('simple', $1)
  AND "ownerType" IN ('training_session','workout','excercise','muscle_group')
ORDER BY score DESC LIMIT 12;

-- userId 隔离(并行,每个 hit 验 owner 归属)
SELECT 'training_session' AS type, id FROM "TrainingSession"
WHERE id = ANY($1::text[]) AND "userId" = $2
UNION ALL
SELECT 'workout', id FROM "Workout"
WHERE id = ANY($2::text[]) AND "userId" = $3
UNION ALL
SELECT 'excercise', id FROM "Excercises"
WHERE id = ANY($4::text[]) AND (
  $5::text IS NULL OR id IN (
    SELECT e.id FROM "Excercises" e
    LEFT JOIN "WorkoutExcercises" we ON we."excerciseId" = e.id
    LEFT JOIN "Workout" w ON w.id = we."workoutId" AND w."userId" = $5
    WHERE w.id IS NOT NULL
  )
)
-- 注:Excercises 是动作库本身,不直接属 user,只能通过被 workout 引用间接属 user。
-- 若 workout 关联为空则该动作公开可见,所有人能查。
```

RRF 合并:`score = Σ 1 / (k + rank)`,k=60,top-5。

### 压缩任务

`CompressionService.run(conversationId)`:
1. 取所有 `compressed=false` 消息
2. 拼成对话串 + system prompt:`你是摘要助手,把以下对话压缩成结构化 JSON {userGoals, keyConclusions, pendingQuestions}`
3. 调 `AI_CHAT_SUMMARY_MODEL`(MiniMax-M3-haiku)
4. 成功:`UPDATE AiConversation SET summary = $newSummary`,`UPDATE AiMessage SET compressed=true WHERE id IN (...)`
5. 失败:写 `apps/api/src/common/logs/compression-failures.log`(JSONL),不抛错

### 嵌入写入

业务模块改动:
- `MuscleGroupsService.create/update/remove` → 调 `EmbeddingsService.upsert('muscle_group', id, \`${name}\n${description ?? ''}\`)`
- `ExcercisesService.create/update/remove` → 同上 `'excercise'`
- `WorkoutsService.create/update/remove`(本期新建模块,见下)→ 同上 `'workout'`,把 `WorkoutExcercises` 关联的动作摘要也拼进 chunkText
- `TrainingSessionsService.create/update/remove`(本期新建)→ 同上 `'training_session'`
- `AiChatService` 流末尾:`EmbeddingsService.upsert('message', userMsgId, userContent)` + `'message', assistantMsgId, assistantContent`

upsert SQL:
```sql
INSERT INTO "AiEmbedding"(id, "ownerType", "ownerId", "chunkText", embedding)
VALUES (gen_random_uuid()::text, $1, $2, $3, $4::vector)
ON CONFLICT ("ownerType", "ownerId", "chunkText") DO UPDATE
  SET embedding = EXCLUDED.embedding;
DELETE FROM "AiEmbedding" WHERE "ownerType"=$1 AND "ownerId"=$2 AND "chunkText" <> $3;
```

删除时:`DELETE FROM "AiEmbedding" WHERE "ownerType"=$1 AND "ownerId"=$2`。

### 训练计划 / 会话模块(本期新建,后端 only)

- `apps/api/src/modules/workouts/`:`CRUD + 关联动作管理`,`WorkoutsService` 写 embedding
- `apps/api/src/modules/training-sessions/`:`CRUD + startSession/doneSession`,`TrainingSessionsService` 写 embedding
- 注册到 `app.module.ts` 的 `imports`
- 前端**不**新增页面/导航;**不**在本 spec 范围

## REST API

`@Controller('ai') @UseGuards(JwtAuthGuard)`,全部经 BFF `/api/ai/*` 转发:

| Method | Path | Body / Query | Response |
|---|---|---|---|
| POST | `/ai/conversations` | `{}` | `IAiConversation` |
| GET | `/ai/conversations?limit&cursor` | — | `IAiConversation[]` |
| GET | `/ai/conversations/:id` | — | `IAiConversation & { messages: IAiMessage[] }`(压缩消息不返原文) |
| PATCH | `/ai/conversations/:id` | `{ title? model? temperature? }` | `IAiConversation` |
| DELETE | `/ai/conversations/:id` | — | `{ deleted: true }` |
| POST | `/ai/conversations/:id/messages` | `{ content, regenerate? }` | **SSE** |
| GET | `/ai/conversations/:id/messages?since` | — | `IAiMessage[]`(增量拉取) |
| GET | `/ai/search?q&limit` | — | `IAiSearchHit[]` |
| POST | `/ai/admin/embeddings/rebuild` | `{ ownerTypes?: string[] }` | `{ enqueued: true }`(运维触发) |

DTO 全部 `class-validator`,与现有模块同模式。

## SSE 事件协议

```
event: meta
data: {"conversationId":"...","messageId":"..."}

event: reasoning
data: {"delta":"我需要先查看他最近的训练记录..."}

event: content
data: {"delta":"根据你最近的训练记录,"}

event: citations
data: {"hits":[{"type":"training_session","id":"...","score":0.84,"snippet":"..."}]}

event: usage
data: {"promptTokens":1240,"completionTokens":380,"ragHits":3,"compressed":false}

event: done
data: {"finishReason":"stop"}

event: error
data: {"code":"MODEL_OVERLOADED","message":"...","retryable":true}
```

事件类型枚举见 §"枚举与常量"。BFF `apps/bff/src/app/api/ai/[...path]/route.ts`(本期新增)用 `ReadableStream` pipe 转发,保持事件名 / data / 心跳。前端 `fetch + reader.read()` 自解析。

## 前端架构

**新文件**:
- `apps/web/src/services/aiService.ts`(import 共享 types)
- `apps/web/src/hooks/useConversations.ts` / `useConversation.ts` / `useChatStream.ts` / `useSearchConversations.ts`
- `apps/web/src/components/ai/{AiSidebar,SearchBox,ConversationList,ChatPane,ChatHeader,MessageList,ChatMessage,ReasoningSection,MarkdownStream,CitationList,StreamingDots,ChatInput,AiSettingsPopover,index}.tsx`
- `apps/web/src/pages/Layout/AI/Chat.tsx`(替换占位)

**核心 hook `useChatStream(conversationId)`**:
- 状态机:`idle | streaming | done | errored`
- `fetch(/api/ai/conversations/:id/messages, { method:'POST', body, signal })` + `AbortController`
- 解析循环:`while(!done) { const {value, done} = await reader.read(); ... }`
- 流结束:`invalidateQueries(['conversation', id])`
- Markdown 防抖:buffer 累加,`requestAnimationFrame` 或 50ms throttle 一次 re-render

**布局**(沿用设计 token):
- 三栏,左 280px、中 flex、右 280px(可折叠到 80px)
- 流中:输入框禁用 + 「停止」按钮(`AbortController.abort()`)
- 错误:toast + 「重试」按钮(本期 toast 用现有项目模式,若没有则临时 `window.alert` 占位)
- 思考折叠:ChevronRight icon,点击展开 `ReasoningSection`
- Markdown:仅 `react-markdown` + `remark-gfm`,不引入编辑器

**样式**:新 Tailwind 类用之前 grep `styles/index.css` safelist,缺啥补啥(沿用 `f8bee4a` 模式)。

## 错误处理 & 降级

| 场景 | 处理 |
|---|---|
| M3 SDK 5xx / 超时 | 发 `event: error {code:'MODEL_UNAVAILABLE', retryable:true}`;前端 toast + 「重试」 |
| M3 SDK 4xx(context too long) | 同步触发压缩(600ms 超时),再重试;仍 4xx → `error {code:'CONTEXT_TOO_LONG'}` |
| RAG 超时 / 错 | 跳过 RAG,`usage {ragHits:0}`,基础 prompt |
| Embeddings 5xx | LRU 缓存命中 → 用缓存;否则跳过向量召回,只走关键词 |
| 压缩失败 | 写 `compression-failures.log`,下次重试 |
| FTS 索引未建 | 降级 `ILIKE '%q%'` |
| 用户切对话 / 离开 | `AbortController.abort()` → Observable `finalize` → `sdkStream.controller.abort()` |
| 跨用户访问 | 403,日志记录 userId + 目标 id |

## 关键流程图(单轮对话)

```
[Browser]
  │ POST /api/ai/conversations/:id/messages {content}
  ▼
[BFF /api/ai/[...path]/route.ts] ── pipe ──▶ [NestJS /ai/*]
                                                       │
   ┌── RagService.retrieve(userId, content) ◀───────────┤
   │      ├─ embed(query) ─→ embedProvider ─→ pgvector top-12
   │      ├─ tsvector rank top-12 (parallel)
   │      ├─ 验 owner.userId = current
   │      └─ RRF → top-5 → system block
   │
   ├── AiConversationRepo.getRecent(N=6) + summary
   ├── chatProvider.streamChat({system, messages, thinking}) ─→ IStreamChatEvent ─→ SSE
   ├── 流末尾: appendMessage(user, assistant, {providerId, ragHits, tokens})
   │          + EmbeddingsService.upsert('message', ...) × 2 (走 embedProvider)
   └── if (count>6 && cooldown) setImmediate(CompressionService.run) (走 summaryProvider)
                                                       │
                                                       ▼
                                              SSE pipe → Browser
                                                       │
                                              useChatStream 解析
```

### Provider 切换示意

切换模型只需改 `.env`(无须代码改动):

| 场景 | 改动 | 业务代码改动 |
|---|---|---|
| 换对话模型 | `AI_CHAT_MODEL=MiniMax-M3` → `AI_CHAT_MODEL=deepseek-chat` + 启用 `MODELS_PROVIDER_DEEPSEEK_*` | 无 |
| 摘要换 DeepSeek | `AI_CHAT_SUMMARY_MODEL=deepseek-chat` + 启用 provider | 无 |
| Embedding 换 1536 维 | 启 `MODELS_PROVIDER_*_EMBED_MODEL=...-large` + `MODELS_PROVIDER_*_EMBED_DIM=1536` + 新 migration 改列 | 无 |
| 不同会话用不同模型 | `PATCH /api/ai/conversations/:id { model: 'deepseek-chat' }`(本期支持,但 UI 不暴露) | 无 |

> 注:不同 provider 的入参/接口格式差异(例如 Anthropic 的 `system` 字段 vs OpenAI 的 `messages:[{role:'system'}]`)**由各 provider adapter 内部消化**,业务 service 只看到统一 `IStreamChatParams` / `IStreamChatEvent` 接口。本期不实现参数/格式适配的「差异抹平」,但接口已留好扩展位。

## 修改/新增文件

| 文件 | 变更 |
|---|---|
| `apps/api/prisma/schema.prisma` | 追加 `AiConversation` / `AiMessage` / `AiEmbedding`,`User` 加 `aiConversations` |
| `apps/api/prisma/migrations/20260729000000_ai_chat_init/migration.sql` | **新增**:CREATE EXTENSION + 建表 + 索引 |
| `apps/api/src/modules/ai/{ai.module,ai.controller,ai-chat.service,rag.service,compression.service,embeddings.service,search.service,ai-conversation.repository,ai-message.repository}.ts` | **新增** |
| `apps/api/src/modules/ai/dto/{create-conversation,update-conversation,send-message,stream-event}.ts` | **新增** |
| `apps/api/src/app.module.ts` | imports 加入 `AiModule` |
| `apps/api/src/modules/excercises/excercises.service.ts` | create/update/remove 调 `EmbeddingsService.upsert('excercise', ...)` |
| `apps/api/src/modules/muscle-groups/muscle-groups.service.ts` | 同上 `'muscle_group'` |
| `apps/api/src/modules/workouts/{workouts.controller,workouts.service,workouts.module,dto/*}.ts` | **新增**,service 写 embedding |
| `apps/api/src/modules/training-sessions/{training-sessions.controller,training-sessions.service,training-sessions.module,dto/*}.ts` | **新增**,service 写 embedding |
| `apps/api/src/common/logs/.gitkeep` | **新增** |
| `apps/api/src/main.ts` | 加载新增 env(若已有 dotenv 全量加载,无需改) |
| `apps/api/src/modules/models/{models.module,model-registry.service,model-config.loader,model-provider.interface}.ts` | **新增**:ModelRegistry + 配置加载 + 接口契约 |
| `apps/api/src/modules/models/providers/anthropic.provider.ts` | **新增**:Anthropic SDK adapter,支持 MiniMax-M3 / 任意 Anthropic 兼容端点 |
| `apps/api/src/modules/models/providers/openai-compatible.provider.ts` | **新增**:OpenAI 兼容 adapter stub(本期不启用,占扩展位) |
| `packages/shared-types/src/ai.ts` | **新增**:枚举 + 共享类型(增补 `IModelProvider` / `IStreamChatParams` / `IStreamChatEvent` / `MODEL_PROTOCOL` / `MODEL_CAPABILITY`) |
| `packages/shared-types/src/index.ts` | export `ai` 模块 |
| `apps/bff/src/app/api/ai/[...path]/route.ts` | **新增**:SSE pipe route handler |
| `apps/web/src/services/aiService.ts` | **新增** |
| `apps/web/src/hooks/{useConversations,useConversation,useChatStream,useSearchConversations}.ts` | **新增** |
| `apps/web/src/components/ai/*.tsx`(14 个文件)+ `index.ts` | **新增** |
| `apps/web/src/pages/Layout/AI/Chat.tsx` | 替换占位为完整三栏实现 |
| `apps/web/src/styles/index.css` | 按需追加 safelist 新增的 arbitrary class |
| `apps/api/.env.example` | 追加 `MODELS_PROVIDER_*` / `AI_CHAT_*` 变量示例 |
| `docs/ai-chat-temp.md` | 标记 deprecated(指向本 spec) |

## 不修改

- 路由 `apps/web/src/routes/index.tsx`(`/ai/chat` 已就位)
- 导航 `apps/web/src/config/modules.ts`(本期不新增子菜单)
- `apps/web/src/pages/Layout/AI/Plan.tsx`(本期不动)
- 现有 `AuthModule` / `JwtAuthGuard`(复用即可)
- 现有 muscle-groups / excercises / auth 模块(只追加 `EmbeddingsService.upsert` 一行调用,不重构)
- 任何前端其他模块

## 验证

1. `apps/api tsc --noEmit` 0;`apps/web tsc -b` 0;`apps/bff tsc --noEmit` 0
2. `apps/api jest` 全过(包含新模块单测)
3. 迁移执行:`pnpm --filter api exec prisma migrate dev` → pgvector 扩展已建 + 3 表已建 + 索引存在
4. CDP 走查 `/ai/chat`:
   - 三栏布局 + 折叠态
   - 新对话 → 输入 → 流式 reasoning + content 渲染,UI 不抖动
   - 思考链点击展开 / 折叠
   - 引用来源折叠
   - 流中切对话 → abort 生效
   - 错误:关掉 ANTHROPIC_API_KEY → `event: error` → toast + 重试按钮
   - 搜索:跨对话关键词 / 语义命中
   - 流断网:刷新页面 → 消息保留
5. 安全手测:
   - 用户 A 创建对话 → 复制 id → 用户 B `GET /api/ai/conversations/:id` → 403
   - 用户 A 删除对话 → 引用 ownerType=message 的 embedding 也清掉
6. RAG 召回验证:`psql` 查 `AiEmbedding` 表有几条 + 流末尾 `usage {ragHits}` 数字对得上
7. 压缩触发:发第 7 条消息 → `apps/api/src/common/logs/compression-failures.log` 暂无,`AiMessage.compressed=true` 的行数 > 0
8. 无回归:`/training/exercises` 列表/新建/编辑/删除正常;`/login` / 注册正常

## 风险与缓解

- **vector 维度**:1024 是占位,与 MiniMax-M3 emb 端点协商后改迁移文件;spec 注释已标明「维度变更需要新 migration + 清表 + 重 embed」
- **RAG 超时**:600ms 是 P95 预算,真实数据多时建议异步改同步(本期不优化),`rag.service` 加 metric 字段便于未来排查
- **流中断**:本期不做自动重连(避免重复 user 消息),只暴露「重试」按钮;UX 上断网场景靠消息持久化 + 增量 `since` 拉取补足
- **压缩任务资源**:haiku 调用次数与对话量成正比,本期不限流;若上线后负载高,加 `compression-failures.log` 大小监控(每分钟行数)
- **训练计划/会话模块**:新建后端 + 不补前端,容易让人误以为「完整业务模块上线」;spec 顶部明示「本期仅后端」,导航/页面**不**加
- **嵌入 upsert 失败**:业务写入已成功 → 写日志,不回滚业务(用户能正常用,但下次问该 entity 时召回不全);本期不实现后台补偿
- **pgvector 扩展权限**:共享 Postgres 可能无 superuser 权限;迁移前在 `.docker/.env` 确认 `POSTGRES_USER=fitness` 有 `CREATE EXTENSION` 权限
- **跨包共享类型**:`packages/shared-types` 必须先 `pnpm --filter @fitness/shared-types build` 再被 web/api 消费;CI 检查顺序(本期手动)
- **Provider 切换的协议差异**:本期 Anthropic provider 已实现;OpenAI-compatible 为扩展位,接 DeepSeek / 通义 / vllm 时需补 `openai-compatible.provider.ts` 的 system-prompt / tool-call / 流事件差异抹平(spec 已留位,业务 service 无须改);若 provider 不支持 `thinking`,adapter 内部忽略 `IStreamChatParams.thinking`,**不产出** `reasoning` 事件
- **Provider 配置漂移**:`.env` 拼写错误(`MODELS_PROVIDER_*_ID` 漏写)→ 启动期 `ModelConfigLoader` 抛清晰错误,列出当前已注册 provider id,提示缺失块