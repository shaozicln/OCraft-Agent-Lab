export type LlmConfigSource = 'player' | 'env' | 'none';

export interface ResolvedLlmConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  embedModel: string;
  directorModel: string;
  enableThinking: boolean;
  source: LlmConfigSource;
}
