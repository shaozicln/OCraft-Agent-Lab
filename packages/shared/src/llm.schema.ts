import { z } from 'zod';

export const llmMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export type LlmMessage = z.infer<typeof llmMessageSchema>;
