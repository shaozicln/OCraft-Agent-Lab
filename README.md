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

#### 解决端口冲突

```bash
netstat -ano | findstr :端口号
taskkill /PID PID /F   // PID：端口号对应的进程
```

#### 后端（端口 3010）

```bash
cd server
npm run start:dev
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

## 协议速查

默认 HTTP：`http://localhost:4000` · WS：同端口 Socket.io（需登录 token）

### HTTP（Harness 相关）


| 方法             | 路径                               | 用途                              |
| -------------- | -------------------------------- | ------------------------------- |
| GET/PUT/DELETE | `/packs/selection`               | 选用 / 切换 / 取消剧情包                 |
| GET            | `/packs/runtime`                 | 进场摘要（章标签、NPC 列表）                |
| GET            | `/packs/worlds`…                 | 列世界 / 版本 / 拉 Pack               |
| GET            | `/agent/traces`                  | 本账号 Agent 决策轨迹（tool / 升章 / 互聊等） |
| DELETE         | `/agent/traces`                  | 清空 Trace                        |
| POST           | `/auth/login` · `/auth/register` | 登录注册（后续请求带 Bearer）              |


### WebSocket（对白 / 存档）


| 方向  | 事件                                                         | 用途 |
| --- | ---------------------------------------------------------- | --- |
| C→S | `player_chat`                                              | 玩家发言 → Harness；可选 `nearbyNpcIds`、`whisper` |
| S→C | `npc_stream`                                               | 对白流式输出 |
| S→C | `npc_state_update`                                         | 好感/疲惫/章/旗等 |
| S→C | `npc_exchange`                                             | 关系互聊旁听（写入 `scene_log`） |
| S→C | `npc_aside`                                                | 同场短接话（写入 `scene_log`，`meta.aside`） |
| S→C | `conversation_saved`                                       | 自动存档成功 |
| S→C | `conversation_loaded`                                      | 读档：`messages` + 可选 `scene_log`（整场流） |
| C→S | `list_conversation_archives` / `load_conversation_archive` | 列档 / 读档 |
| C→S | `start_new_run`                                            | 新开一个档 |
| C→S | `request_story_map`                                        | 剧情进度图 |
| C→S | `set_run_npc_selection`                                    | 本局出场 NPC 筛选 |

### 存档快照与 `scene_log`（v3）

当前写入版本 **`schema_version: 3`**（v2 + run 级整场对白时间线）。聊天窗平时展示整场流；LLM 仍只用分人 `messages` 子集（双写，互不替代）。

| 字段 / 约定 | 说明 |
| --- | --- |
| `scene_log: SceneUtterance[]` | 一局时间线：玩家↔NPC、互聊、旁听等 |
| `kind` | `player_to_npc` · `npc_to_player` · `npc_to_npc` · `system` |
| 玩家 id / 显示名 | `player` / `沈檐` |
| `meta.whisper` | 悄悄话：仅目标 NPC；跳过 aside / exchange |
| `meta.aside` | 同场短接话；含 `chat_npc_id`（当时焦点） |
| 写入时机 | 主对话成对写入；`npc_exchange` / `npc_aside` 推送时追加 |
| 读档 | `conversation_loaded.scene_log` → ChatBox；缺省则回退 `messages` |
| 进程重启 | 从活跃档 `ensureSceneLogHydrated` 灌回内存 |
| 首版不做 | 升章系统句不进 `scene_log`；无 `audience[]` |

*还要做好多东西啊。。。不然可能打不出预想中的自定义和多结局ORZ*

## Pack Eval（离线规则回归）

不启 Nest / 不调真 LLM。用例按世界分类：`server/eval/cases/{world}/{version}.json`（与 `story-packs` 对齐），跑同一套升章 / flag / 互聊 / 薄护栏逻辑。

```bash
cd server
npm run pack:eval:all          # 全部世界种子
npm run pack:eval              # 默认 feel 包
npm run pack:eval -- office official-mvp__20260710T1045
```

通过标准：终端 `OK all cases passed`，且 Summary 里 failed=0。失败会打印 turn Trace（章前后、命中规则、flags、互聊）。
