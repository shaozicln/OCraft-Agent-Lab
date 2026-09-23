-- 玩家在前端填写自己的 AI 接口（按账号隔离；未填则回退 server/.env）

ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "llm_base_url" text,
  ADD COLUMN IF NOT EXISTS "llm_api_key_enc" text,
  ADD COLUMN IF NOT EXISTS "llm_model" text,
  ADD COLUMN IF NOT EXISTS "llm_embed_model" text,
  ADD COLUMN IF NOT EXISTS "llm_director_model" text,
  ADD COLUMN IF NOT EXISTS "llm_enable_thinking" text;

COMMENT ON COLUMN "players"."llm_base_url" IS '玩家自填 OpenAI 兼容 Base URL；空则回退 LLM_BASE_URL';
COMMENT ON COLUMN "players"."llm_api_key_enc" IS 'AES-GCM 加密后的 API Key；空则回退 LLM_API_KEY';
COMMENT ON COLUMN "players"."llm_model" IS '对话模型名；空则回退 LLM_MODEL';
COMMENT ON COLUMN "players"."llm_embed_model" IS '嵌入模型名；空则回退 LLM_EMBED_MODEL';
COMMENT ON COLUMN "players"."llm_director_model" IS '导演模型名；空则回退 DIRECTOR_MODEL / 对话模型';
COMMENT ON COLUMN "players"."llm_enable_thinking" IS 'true/false；空则回退 LLM_ENABLE_THINKING';
