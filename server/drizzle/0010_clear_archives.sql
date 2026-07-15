-- 清空全部历史存档（改为一局档 + 自动存后重新开始）
DELETE FROM "conversation_snapshots";
DELETE FROM "conversation_archives";
