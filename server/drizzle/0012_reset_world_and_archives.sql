-- 验收前重置：清空全部存档 + 初始化世界/会话进度
-- 玩家账号与 Pack 选用保留；下次进游戏由 ensureHydrated 写入默认章

DELETE FROM "conversation_snapshots";
DELETE FROM "conversation_archives";

DELETE FROM "world_flags";
DELETE FROM "world_progress";

DELETE FROM "story_flags";

DELETE FROM "player_npc_state";

COMMENT ON TABLE "world_progress" IS '共享世界章节（L2）；0012 后空表，进游戏再 hydrate';
