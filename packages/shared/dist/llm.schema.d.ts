import { z } from 'zod';
export declare const llmMessageSchema: z.ZodObject<{
    role: z.ZodEnum<{
        user: "user";
        assistant: "assistant";
        system: "system";
    }>;
    content: z.ZodString;
}, z.core.$strip>;
export type LlmMessage = z.infer<typeof llmMessageSchema>;
