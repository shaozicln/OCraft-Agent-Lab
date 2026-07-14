-- 存档自定义显示名（filename 仍作稳定键）
ALTER TABLE "conversation_archives" ADD COLUMN IF NOT EXISTS "display_name" text;
COMMENT ON COLUMN "conversation_archives"."display_name" IS '玩家自定义存档名；空则界面回退到 filename';
