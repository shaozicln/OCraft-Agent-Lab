# OCraft Game

测试 Agent 回复，根据npc状态变化走剧情的一小段网页端剧情，有 Api-Key 就能玩

- **前端**：Next.js + React Three Fiber（3D）+ Socket.io  
- **后端**：NestJS（HTTP + WebSocket）+  LLM  
- **共享包**：`@ocraft/shared`（前后端类型与 Schema）

---

## 快速启动

需要 **Node.js 18+**，开两个终端。

### 1. 后端（端口 3010）

```bash
cd server
npm install          # 首次
npm run start:dev
```

### 2. 前端（端口 3000）

```bash
cd client
npm install          # 首次
npm run dev
```

浏览器打开 [http://localhost:3000。](http://localhost:3000。)

> 首次若报 `@ocraft/shared` 找不到，先执行：  
> `cd packages/shared && npm install && npm run build`

### 3. 接入自己的大模型

```bash
cd server
cp .env.example .env
```

编辑 `.env` 填入 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`（OpenAI 兼容接口，推荐阿里百炼，有新手额度还方便）。

### 3.1 玩家进度持久化（PostgreSQL + Drizzle）

刷新页面后好感/章节/对话上下文会按 `localStorage` 里的 `playerId` 续玩。需先起数据库：

```bash
cd server
cp .env.example .env   # 含 DATABASE_URL
docker compose up -d   # 本地 PG（pgvector/pg16）
npm run db:migrate     # Drizzle 建表
```

未配置 `DATABASE_URL` 时服务端可启动，但进度仅内存、刷新即丢。


| 改什么             | 文件                                                            | 说明                                                          |
| --------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| NPC 人设、口癖、初始数值  | `server/src/mock-data/npc.json`                               | 名字、`system_prompt_template`、好感/疲惫初值、`favorite_things` + 同义词 |
| NPC 长期记忆（RAG）   | 同上 `memories[]`                                               | 每条记忆有 `keywords`、`content`；`min_chapter` 控制哪章节能检索到          |
| 3D 位置 / 模型 / 头像 | 同上 `meta`                                                     | `spawn_position`、`model_path`、`avatar`                      |
| 章节剧情边界          | `server/src/npc/prompt-builder.ts`                            | `daily` / `uneasy` / `dream_reveal` 各能说什么、不能说什么             |
| 章节推进触发词         | `server/src/agent/chapter-transition.ts`                      | 如「没睡好」进 uneasy，「做梦」进 dream_reveal；含好感门槛                     |
| 聊天触发数值变化        | `server/src/agent/agent-harness.service.ts`                   | 工作词加疲惫、兴趣词加好感减疲惫；数值 delta 在这里                               |
| Mock 固定回复       | `packages/shared/src/mock-reply.ts`                           | 没配 LLM Key 时走这里，不是真 AI                                      |
| 对话存档            | PostgreSQL `conversation_archives` / `conversation_snapshots` | 按 `playerId` 隔离；旧 `conversation-archives/*.json` 不再写入       |
| 移动 / 交互距离 / 镜头  | `client/src/config/game.ts`                                   | 速度、按 F 的距离、相机远近                                             |
| 后端地址            | `client/.env` 或 `NEXT_PUBLIC_GAME_SERVER_URL`                 | 本项目启动默认 `http://localhost:3010`                             |
| 大模型             | `server/.env`                                                 | `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`                    |


**改完 npc.json 后**：重启 server；若改了 `packages/shared`，需 `npm run build`。

PS：未配置 LLM Key 时，是写死的固定回复。

*还要做好多东西啊。。。不然可能打不出预想中的多结局ORZ*