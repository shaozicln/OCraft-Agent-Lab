-- 四位 UID（0001）→ 三位（001）；序列上限改为 999
-- 适用于已执行旧版 0005（四位）的数据库

ALTER SEQUENCE player_uid_seq MAXVALUE 999;

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

-- 把纯数字 UID 统一规范成三位（0001→001；已是 001 则不变）
UPDATE "player_npc_state"
SET "player_id" = lpad(("player_id"::int)::text, 3, '0')
WHERE "player_id" ~ '^[0-9]+$';

UPDATE "story_flags"
SET "player_id" = lpad(("player_id"::int)::text, 3, '0')
WHERE "player_id" ~ '^[0-9]+$';

UPDATE "conversation_archives"
SET "player_id" = lpad(("player_id"::int)::text, 3, '0')
WHERE "player_id" ~ '^[0-9]+$';

UPDATE "players"
SET "id" = lpad(("id"::int)::text, 3, '0')
WHERE "id" ~ '^[0-9]+$';

ALTER TABLE "player_npc_state"
  ADD CONSTRAINT "player_npc_state_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "players"("id");

ALTER TABLE "story_flags"
  ADD CONSTRAINT "story_flags_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "players"("id");

ALTER TABLE "conversation_archives"
  ADD CONSTRAINT "conversation_archives_player_id_players_id_fk"
  FOREIGN KEY ("player_id") REFERENCES "players"("id");

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
