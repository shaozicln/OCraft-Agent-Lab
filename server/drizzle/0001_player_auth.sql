-- 阶段 B+：用户名 + 密码登录
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "password_hash" text;

CREATE UNIQUE INDEX IF NOT EXISTS "players_username_idx" ON "players" ("username");

COMMENT ON COLUMN "players"."username" IS '登录用户名（小写，全局唯一）';
COMMENT ON COLUMN "players"."password_hash" IS 'scrypt 密码哈希';
