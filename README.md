# OCraft Game

测试 Agent 回复，根据npc状态变化走可自定义剧情的一小段网页端剧情，有 Api-Key 就能玩，大概玩法是有新点子填填设定就能对话

- **前端**：Next.js + React Three Fiber（3D）+ Socket.io  
- **后端**：NestJS（HTTP + WebSocket）+  LLM  
- **共享包**：`@ocraft/shared`（前后端类型与 Schema）

---

## 项目启动

### 0. 前置

#### 环境要求

```bash
Node.js 18+
Docker Desktop
```

#### 安装依赖

```bash
cd d:\OCraft\ocraft-ai-game\packages\shared
npm install
npm run build
cd d:\OCraft\ocraft-ai-game\server
npm install
cd d:\OCraft\ocraft-ai-game\client
npm install 
```

### 1. 数据库配置

1.1 **配置环境变量**

```bash
cd d:\OCraft\ocraft-ai-game\server
copy .env.example .env
```

`.env` 里除 `DATABASE_URL`、大模型 Key 外，建议设置 `AUTH_SECRET`（登录 token 签名密钥，生产环境务必改成随机长字符串）。

1.2 **启动 PostgreSQL 容器 （也可以直接装PG）**

```bash
docker compose up -d
# 验证
docker compose ps
```

应看到 `ocraft-postgres` 状态为 `healthy` 或 `running`。

1.3 **建表**

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

`npm run db:migrate`失败就是网络问题

`Drizzle Studio is up and running on` [https://local.drizzle.studio](https://local.drizzle.studio) 查看可视化数据库表

### 2. 接入自己的大模型

编辑 `.env` 填入 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`（OpenAI 兼容接口，快速体验推荐阿里百炼，有新手额度还方便）。

### 3. 一键启动

*先启动Docker*

```text
Ctrl+Shift+B
```

效果：

1. 先在**底部终端**跑 `dev:prep`（清端口 + build shared）
2. 再**并行**开 3 个底部终端：`db:studio` / `server:dev` / `client:dev`

若无响应：`Ctrl+Shift+P` → **Tasks: Run Task** → **dev:all**

若要自定义启动按键：

1. 编译器内按 Ctrl+Shift+P，输入 Preferences: Open Keyboard Shortcuts (JSON)。
2. 在 keybindings.json 中写入：

```json
[
    {
        "key": "ctrl+shift+b", // 按键组合
        "command": "workbench.action.tasks.runTask",
        "args": "dev:all"
    }
]
```

保存即可

### 4. 分别启动



#### 后端（端口 3010）

```bash
cd server
npm run start:dev
```、
```

#### 前端（端口 3000）

```bash
cd client
npm run dev
```

浏览器打开 [http://localhost:3000。](http://localhost:3000。)

*首次进入需 **注册或登录**（用户名 + 密码）*

> 首次若报 `@ocraft/shared` 找不到，先执行：  
> `cd packages/shared && npm install && npm run build`

## 自定义更改（已做可视化页面）


| 改什么             | 文件                                                            | 说明                                                          |
| --------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| NPC 人设、口癖、初始数值  | `server/src/mock-data/npc.json`                               | 名字、`system_prompt_template`、好感/疲惫初值、`favorite_things` + 同义词 |
| NPC 长期记忆（RAG）   | 同上 `memories[]`                                               | 每条记忆有 `keywords`、`content`；`min_chapter` 控制哪章节能检索到          |
| 3D 位置 / 模型 / 头像 | 同上 `meta`                                                     | spawn_position`、`model_path`、`avatar`                       |
| 章节剧情边界          | `server/src/npc/prompt-builder.ts`                            | `daily` / `uneasy` / `dream_reveal` 各能说什么、不能说什么             |
| 章节推进触发词         | `srver/src/agent/chapter-transition.ts`                       | 如「没睡好」进 uneasy，「做梦」进 dream_reveal；含好感门槛                     |
| 聊天触发数值变化        | `server/src/agent/agent-harness.service.ts`                   | 工作词加疲惫、兴趣词加好感减疲惫；数值 delta 在这里                               |
| Mock 固定回复       | `packages/shared/src/mock-reply.ts`                           | 没配 LLM Key 时走这里，不是真 AI                                      |
| 对话存档            | PostgreSQL `conversation_archives` / `conversation_snapshots` | 按 `playerId` 隔离；旧 `conversation-archives/*.json` 不再写入       |
| 移动 / 交互距离 / 镜头  | `client/src/config/game.ts`                                   | 速度、按 F 的距离、相机远近                                             |
| 后端地址            | `client/.env` 或 `NEXT_PUBLIC_GAME_SERVER_URL`                 | 本项目启动默认 `http://localhost:3010`                             |
| 大模型             | `server/.env`                                                 | `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`                    |


**改完 npc.json 后**：重启 server；若改了 `packages/shared`，需 `npm run build`。

PS：未配置 LLM Key 时，是写死的固定回复。

*还要做好多东西啊。。。不然可能打不出预想中的自定义和多结局ORZ*

下一步：扩展各种自定义方式