-- 玩家 ID：UUID → 三位数字 UID（001…999），注册时顺序分配
-- 已有账号按 created_at 重映射为 001、002…

CREATE SEQUENCE IF NOT EXISTS player_uid_seq START 1 INCREMENT 1 MINVALUE 1 MAXVALUE 999;

-- 1) 去掉所有指向 players 的外键（名称因历史迁移可能不一致）
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    WHERE c.confrelid = 'players'::regclass
      AND c.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- 2) 建旧→新 ID 映射（按注册时间）
CREATE TEMP TABLE _player_id_map AS
SELECT
  id::text AS old_id,
  lpad(row_number() OVER (ORDER BY created_at ASC, id ASC)::text, 3, '0') AS new_id
FROM players;

-- 3) 子表先改成 text，再换成新 UID
ALTER TABLE "player_npc_state" ALTER COLUMN "player_id" TYPE text USING "player_id"::text;
ALTER TABLE "story_flags" ALTER COLUMN "player_id" TYPE text USING "player_id"::text;
ALTER TABLE "conversation_archives" ALTER COLUMN "player_id" TYPE text USING "player_id"::text;

UPDATE "player_npc_state" s
SET "player_id" = m.new_id
FROM _player_id_map m
WHERE s."player_id" = m.old_id;

UPDATE "story_flags" s
SET "player_id" = m.new_id
FROM _player_id_map m
WHERE s."player_id" = m.old_id;

UPDATE "conversation_archives" s
SET "player_id" = m.new_id
FROM _player_id_map m
WHERE s."player_id" = m.old_id;

-- 4) players 主键改 text 并换新 UID
ALTER TABLE "players" ALTER COLUMN "id" TYPE text USING "id"::text;

UPDATE "players" p
SET "id" = m.new_id
FROM _player_id_map m
WHERE p."id" = m.old_id;

-- 5) 恢复外键
ALTER TABLE "player_npc_state"
  ADD CONSTRAINT "player_npc_state_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "players"("id");

ALTER TABLE "story_flags"
  ADD CONSTRAINT "story_flags_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "players"("id");

ALTER TABLE "conversation_archives"
  ADD CONSTRAINT "conversation_archives_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "players"("id");

-- 6) 序列接到当前最大 UID 之后（空表时下次 nextval = 1）
DO $$
DECLARE
  max_uid int;
BEGIN
  SELECT COALESCE(MAX(id::int), 0) INTO max_uid
  FROM players
  WHERE id ~ '^[0-9]{3}$';

  IF max_uid > 0 THEN
    PERFORM setval('player_uid_seq', max_uid, true);
  ELSE
    PERFORM setval('player_uid_seq', 1, false);
  END IF;
END $$;

COMMENT ON COLUMN "players"."id" IS '玩家 UID：三位数字 001–999，注册顺序分配';
COMMENT ON SEQUENCE "player_uid_seq" IS '玩家 UID 序号（nextval 后 lpad 成三位）';
