-- 阶段 C：story_flags.value 改为 text，支持 ch5_player_stance 枚举
ALTER TABLE "story_flags"
  ALTER COLUMN "value" DROP DEFAULT;

ALTER TABLE "story_flags"
  ALTER COLUMN "value" TYPE text
  USING (
    CASE
      WHEN "value" IS TRUE THEN 'true'
      ELSE 'false'
    END
  );

ALTER TABLE "story_flags"
  ALTER COLUMN "value" SET DEFAULT 'true';

ALTER TABLE "story_flags"
  ALTER COLUMN "value" SET NOT NULL;

COMMENT ON COLUMN "story_flags"."value" IS '普通 flag 为 true；ch5_player_stance 为 help|leave|silence';
