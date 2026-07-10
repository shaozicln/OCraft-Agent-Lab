# Story Packs

可运行的剧情包（与 `Docs/Story/` 作者笔记分离）。

## 布局

```text
story-packs/
  <worldId>/
    manifest.json                 # 世界元数据 + 默认默认版本目录名
    versions/
      <displayName>__yyyyMMddTHHmm/
        pack.json
        world.json
        triggers.json
        prompts.json
        npcs/*.json
```

- **displayName**：给人看的名字（目录里用安全字符；中文显示名写在 `pack.json` 的 `display_name`）。
- **时间戳**：系统落盘用 `yyyyMMddTHHmm`；UI 展示时主标题用 `display_name`，时间戳小字。

## 校验

```bash
cd server
npm run pack:validate
```

## 环境变量

见 `server/.env.example`：`STORY_PACKS_ROOT`、`OFFICIAL_WORLD`、`OFFICIAL_VERSION_DIR`。

## 运行时

服务端启动时 `PackService` 加载默认包；WS 按玩家选用包（`players.selected_*`，空则默认）进入 AsyncLocalStorage 上下文。  
`chapter-transition` / `prompt-builder` / `agent-harness` / `NpcService` 均读当前上下文 Pack。

改包内容后需重启 server（或重新 seed）。进度与选用相关迁移：

```bash
cd server
npm run db:migrate
```

## 命令

```bash
cd server
npm run pack:validate
npm run pack:seed                                          # 默认包灌库
npm run pack:seed -- office official-mvp__20260710T1045
npm run pack:save -- --name 我的改版                       # 另存新版本目录（+ 有 DB 则 seed）
```

## HTTP API（需登录的带 `Authorization: Bearer <token>`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/packs/worlds` | 列世界与版本 |
| GET | `/packs/worlds/:worldId/versions` | 某世界版本列表 |
| POST | `/packs/seed` | `{ worldId, versionDir }` 灌库 |
| POST | `/packs/save-as` | `{ worldId?, fromVersionDir?, displayName, notes? }` 另存 |
| GET | `/packs/selection` | 当前选用 |
| GET | `/packs/runtime` | 进场摘要：默认 NPC、章节标签、NPC 列表 |
| GET | `/packs/worlds/:worldId/versions/:versionDir` | 拉取完整 Pack（编辑用） |
| PUT | `/packs/worlds/:worldId/versions/:versionDir` | 写回 Pack（校验后落盘 + seed） |
| PUT | `/packs/selection` | `{ worldId, packVersionId }` 切换包 |
| DELETE | `/packs/selection` | 回到默认默认 |
| GET/PUT | `/players/me` | 当前玩家资料 |

动画规则写在包内 `world.json` → `animation_rules`（触发词 / 数值变化 → `idle|sleeping|talk|excited_talk`）。
章节展示名用 `chapters[].hud_label`（或 `display_name`）。
默认进场 NPC 用 `world.default_npc`（省略则取第一个 NPC）。

前端：游戏内 **Esc** 左侧栏；完整设定在 **`/settings`**（外观主题、资料、剧情包、Pack 字段编辑）。
