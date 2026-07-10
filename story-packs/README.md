# Story Packs

可运行的剧情包（与 `Docs/Story/` 作者笔记分离）。

## 布局

```text
story-packs/
  <worldId>/
    manifest.json                 # 世界元数据 + 官方默认版本目录名
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
