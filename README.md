# OCraft Game

OCraft系列游戏的技术向探索，用于学习和测试 Agent 工程在 npc 上的应用，有 Api-Key 就能玩，大概玩法是有新点子填填设定就能对话

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

#### 配置环境变量

```bash
cd d:\OCraft\ocraft-ai-game\server
copy .env.example .env
```

`.env` 里填 `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`，并设置 `AUTH_SECRET`（登录 token 签名密钥）。

---

### 方式 A：Docker 一键全栈（推荐演示 / 不想本机装依赖时）

在**仓库根目录**：

```bash
docker compose up --build
# 或：npm run docker:up
```

会起三个容器：

| 服务 | 地址 |
| --- | --- |
| 前端 Next | http://localhost:3300 |
| 后端 Nest | http://localhost:4400 |
| Postgres | localhost:15432 |

首次启动会自动跑数据库迁移。停掉：`docker compose down`（或 `npm run docker:down`）。看日志：`npm run docker:logs`。

> 密钥来自 `server/.env`（compose `env_file`）；容器内 `DATABASE_URL` 会被覆盖为连 `postgres` 服务。本机 `.env` 里的 `localhost:15432` 只给本机 npm 开发用。

**只要数据库**（前后端仍本机跑）：

```bash
docker compose up -d postgres
# 或旧习惯：cd server && docker compose up -d
```

---

### 方式 B：本机开发（热更新）

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

#### 启动 PostgreSQL

```bash
docker compose up -d postgres
docker compose ps
```

应看到 `ocraft-postgres` 为 `healthy` / `running`。

#### 建表

```bash
cd server
npm run db:generate
npm run db:migrate
npm run db:studio
```

`npm run db:migrate` 失败多为网络问题。Drizzle Studio 见终端提示的本地地址。

#### 一键起前后端

*先确保 Docker 里 Postgres 已起*

```text
Ctrl+Shift+B
```

效果：

1. 先在**底部终端**跑 `dev:prep`（清端口）
2. 再**并行**开 3 个底部终端：`db:studio` / `server:dev` / `client:dev`

若无响应：`Ctrl+Shift+P` → **Tasks: Run Task** → **dev:all**

自定义启动按键：`Ctrl+Shift+P` → Preferences: Open Keyboard Shortcuts (JSON)：

```json
[
    {
        "key": "ctrl+shift+b",
        "command": "workbench.action.tasks.runTask",
        "args": "dev:all"
    }
]
```

#### 分别启动

解决端口冲突：

```bash
netstat -ano | findstr :端口号
taskkill /PID PID /F
```

后端（默认 `PORT=4400`，见 `server/.env`）：

```bash
cd server
npm run start:dev
```

前端（3300）：

```bash
cd client
npm run dev
```

浏览器打开 http://localhost:3300 。首次进入需 **注册或登录**。

> 首次若报 `@ocraft/shared` 找不到：  
> `cd packages/shared && npm install && npm run build`

客户端默认连 `NEXT_PUBLIC_GAME_SERVER_URL`（未设时回退 `http://localhost:4000`）。本机请与 `server/.env` 的 `PORT` 对齐，例如：

```bash
# client 启动前
set NEXT_PUBLIC_GAME_SERVER_URL=http://localhost:4400
```

---

*还要做好多东西啊。。。不然可能打不出预想中的自定义和多结局ORZ*
