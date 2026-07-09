import { z } from 'zod';

export const updateAffinitySchema = z.object({
  delta: z.number().int().min(-100).max(100),
  reason: z.string().optional(),
});

export const updateFatigueSchema = z.object({
  delta: z.number().int().min(-100).max(100),
  reason: z.string().optional(),
});

export type UpdateAffinityArgs = z.infer<typeof updateAffinitySchema>;
export type UpdateFatigueArgs = z.infer<typeof updateFatigueSchema>;
