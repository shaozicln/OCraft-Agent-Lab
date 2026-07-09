"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmMessageSchema = void 0;
const zod_1 = require("zod");
exports.llmMessageSchema = zod_1.z.object({
    role: zod_1.z.enum(['system', 'user', 'assistant']),
    content: zod_1.z.string(),
});
