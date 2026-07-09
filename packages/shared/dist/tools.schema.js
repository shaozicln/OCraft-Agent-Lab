"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFatigueSchema = exports.updateAffinitySchema = void 0;
const zod_1 = require("zod");
exports.updateAffinitySchema = zod_1.z.object({
    delta: zod_1.z.number().int().min(-100).max(100),
    reason: zod_1.z.string().optional(),
});
exports.updateFatigueSchema = zod_1.z.object({
    delta: zod_1.z.number().int().min(-100).max(100),
    reason: zod_1.z.string().optional(),
});
