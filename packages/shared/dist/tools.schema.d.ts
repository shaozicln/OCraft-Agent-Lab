import { z } from 'zod';
export declare const updateAffinitySchema: z.ZodObject<{
    delta: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateFatigueSchema: z.ZodObject<{
    delta: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type UpdateAffinityArgs = z.infer<typeof updateAffinitySchema>;
export type UpdateFatigueArgs = z.infer<typeof updateFatigueSchema>;
