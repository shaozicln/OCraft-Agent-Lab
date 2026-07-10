import { z } from 'zod';
/** 包内 ID：章节 / flag / NPC 等，由 Pack 声明，代码不写死业务枚举 */
export declare const packIdSchema: z.ZodString;
export declare const packChapterSchema: z.ZodObject<{
    id: z.ZodString;
    display_name: z.ZodString;
    hud_label: z.ZodOptional<z.ZodString>;
    rank: z.ZodNumber;
}, z.core.$strip>;
export declare const packFlagDefSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<{
        enum: "enum";
        bool: "bool";
    }>;
    description: z.ZodOptional<z.ZodString>;
    enum_values: z.ZodOptional<z.ZodArray<z.ZodString>>;
    irreversible: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const packMemorySchema: z.ZodObject<{
    id: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
    content: z.ZodString;
    min_chapter: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const packNpcSchema: z.ZodObject<{
    npc_id: z.ZodString;
    name: z.ZodString;
    meta: z.ZodObject<{
        avatar: z.ZodString;
        model_path: z.ZodString;
        scale: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        spawn_position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    }, z.core.$strip>;
    attributes: z.ZodObject<{
        fatigue: z.ZodNumber;
        max_fatigue: z.ZodNumber;
        affinity: z.ZodNumber;
        current_status: z.ZodString;
        favorite_things: z.ZodArray<z.ZodString>;
        favorite_synonyms: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
    }, z.core.$strip>;
    system_prompt_template: z.ZodString;
    memories: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
        content: z.ZodString;
        min_chapter: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const packFlagSetEntrySchema: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export declare const packTriggerRuleSchema: z.ZodObject<{
    id: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
    from_chapter: z.ZodString;
    to_chapter: z.ZodNullable<z.ZodString>;
    min_affinity: z.ZodDefault<z.ZodNumber>;
    max_fatigue: z.ZodOptional<z.ZodNumber>;
    require_flags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    player_triggers: z.ZodDefault<z.ZodArray<z.ZodString>>;
    set_flags: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const packNpcReplyFlagRuleSchema: z.ZodObject<{
    id: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
    when_chapter_in: z.ZodArray<z.ZodString>;
    set_flag: z.ZodString;
    value: z.ZodDefault<z.ZodString>;
    triggers: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const packTriggersFileSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodNumber>;
    rules: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
        from_chapter: z.ZodString;
        to_chapter: z.ZodNullable<z.ZodString>;
        min_affinity: z.ZodDefault<z.ZodNumber>;
        max_fatigue: z.ZodOptional<z.ZodNumber>;
        require_flags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        player_triggers: z.ZodDefault<z.ZodArray<z.ZodString>>;
        set_flags: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            value: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    npc_reply_flag_rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
        when_chapter_in: z.ZodArray<z.ZodString>;
        set_flag: z.ZodString;
        value: z.ZodDefault<z.ZodString>;
        triggers: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
/** 好感区间文案：affinity < max_exclusive 时命中（最后一档用极大 max） */
export declare const packAffinityTierSchema: z.ZodObject<{
    max_exclusive: z.ZodNumber;
    text: z.ZodString;
}, z.core.$strip>;
/** 疲惫提示：fatigue >= min 时命中，按 min 降序匹配第一条 */
export declare const packFatigueHintSchema: z.ZodObject<{
    min: z.ZodNumber;
    text: z.ZodString;
}, z.core.$strip>;
/**
 * Flag 约束条件（解释器求值）
 * - flag + set:true  → 已置位
 * - flag + set:false → 未置位
 * - chapter / chapter_not 可选收窄
 */
export declare const packFlagConstraintWhenSchema: z.ZodObject<{
    flag: z.ZodString;
    set: z.ZodBoolean;
    chapter: z.ZodOptional<z.ZodString>;
    chapter_not: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const packFlagConstraintSchema: z.ZodObject<{
    id: z.ZodString;
    when: z.ZodObject<{
        flag: z.ZodString;
        set: z.ZodBoolean;
        chapter: z.ZodOptional<z.ZodString>;
        chapter_not: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    text: z.ZodString;
}, z.core.$strip>;
export declare const packPromptsFileSchema: z.ZodObject<{
    affinity_tiers: z.ZodArray<z.ZodObject<{
        max_exclusive: z.ZodNumber;
        text: z.ZodString;
    }, z.core.$strip>>;
    fatigue_hints: z.ZodArray<z.ZodObject<{
        min: z.ZodNumber;
        text: z.ZodString;
    }, z.core.$strip>>;
    chapter_constraints: z.ZodRecord<z.ZodString, z.ZodString>;
    flag_constraints: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        when: z.ZodObject<{
            flag: z.ZodString;
            set: z.ZodBoolean;
            chapter: z.ZodOptional<z.ZodString>;
            chapter_not: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        text: z.ZodString;
    }, z.core.$strip>>>;
    reply_instruction: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export declare const packNumericToolsSchema: z.ZodObject<{
    fatigue_increase: z.ZodObject<{
        triggers: z.ZodArray<z.ZodString>;
        delta: z.ZodNumber;
        reason: z.ZodString;
    }, z.core.$strip>;
    interest_hit: z.ZodObject<{
        affinity_delta: z.ZodNumber;
        affinity_reason: z.ZodString;
        fatigue_delta: z.ZodNumber;
        fatigue_reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
/** 第一期支持的动画状态（与前端 Humanoid 一致） */
export declare const packAnimationIdSchema: z.ZodEnum<{
    idle: "idle";
    sleeping: "sleeping";
    talk: "talk";
    excited_talk: "excited_talk";
}>;
/**
 * 动画规则条件（按规则数组顺序，先命中先生效）
 * - fatigue_delta_gt / lt：本轮 updateFatigue 的 delta 合计
 * - message_triggers：玩家消息包含任一词
 * - interest_hit：命中 NPC favorite / synonyms
 * - current_status：当前动画状态等于该值
 */
export declare const packAnimationRuleWhenSchema: z.ZodObject<{
    fatigue_delta_gt: z.ZodOptional<z.ZodNumber>;
    fatigue_delta_lt: z.ZodOptional<z.ZodNumber>;
    message_triggers: z.ZodOptional<z.ZodArray<z.ZodString>>;
    interest_hit: z.ZodOptional<z.ZodBoolean>;
    current_status: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const packAnimationRuleSchema: z.ZodObject<{
    id: z.ZodString;
    enabled: z.ZodDefault<z.ZodBoolean>;
    when: z.ZodObject<{
        fatigue_delta_gt: z.ZodOptional<z.ZodNumber>;
        fatigue_delta_lt: z.ZodOptional<z.ZodNumber>;
        message_triggers: z.ZodOptional<z.ZodArray<z.ZodString>>;
        interest_hit: z.ZodOptional<z.ZodBoolean>;
        current_status: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    animation: z.ZodEnum<{
        idle: "idle";
        sleeping: "sleeping";
        talk: "talk";
        excited_talk: "excited_talk";
    }>;
}, z.core.$strip>;
export declare const packEndingSchema: z.ZodObject<{
    id: z.ZodString;
    display_name: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    performance_hint: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const packWorldFileSchema: z.ZodObject<{
    chapters: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        display_name: z.ZodString;
        hud_label: z.ZodOptional<z.ZodString>;
        rank: z.ZodNumber;
    }, z.core.$strip>>;
    flags: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<{
            enum: "enum";
            bool: "bool";
        }>;
        description: z.ZodOptional<z.ZodString>;
        enum_values: z.ZodOptional<z.ZodArray<z.ZodString>>;
        irreversible: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    default_chapter: z.ZodOptional<z.ZodString>;
    default_npc: z.ZodOptional<z.ZodString>;
    numeric_tools: z.ZodObject<{
        fatigue_increase: z.ZodObject<{
            triggers: z.ZodArray<z.ZodString>;
            delta: z.ZodNumber;
            reason: z.ZodString;
        }, z.core.$strip>;
        interest_hit: z.ZodObject<{
            affinity_delta: z.ZodNumber;
            affinity_reason: z.ZodString;
            fatigue_delta: z.ZodNumber;
            fatigue_reason: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>;
    animation_rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        enabled: z.ZodDefault<z.ZodBoolean>;
        when: z.ZodObject<{
            fatigue_delta_gt: z.ZodOptional<z.ZodNumber>;
            fatigue_delta_lt: z.ZodOptional<z.ZodNumber>;
            message_triggers: z.ZodOptional<z.ZodArray<z.ZodString>>;
            interest_hit: z.ZodOptional<z.ZodBoolean>;
            current_status: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        animation: z.ZodEnum<{
            idle: "idle";
            sleeping: "sleeping";
            talk: "talk";
            excited_talk: "excited_talk";
        }>;
    }, z.core.$strip>>>;
    endings: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        display_name: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
        performance_hint: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const packHeaderSchema: z.ZodObject<{
    schema_version: z.ZodNumber;
    world_id: z.ZodString;
    display_name: z.ZodString;
    created_at: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const worldManifestSchema: z.ZodObject<{
    world_id: z.ZodString;
    official_version_dir: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** 内存中组装后的完整 Pack（校验交叉引用后） */
export declare const storyPackSchema: z.ZodObject<{
    header: z.ZodObject<{
        schema_version: z.ZodNumber;
        world_id: z.ZodString;
        display_name: z.ZodString;
        created_at: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    world: z.ZodObject<{
        chapters: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            display_name: z.ZodString;
            hud_label: z.ZodOptional<z.ZodString>;
            rank: z.ZodNumber;
        }, z.core.$strip>>;
        flags: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodEnum<{
                enum: "enum";
                bool: "bool";
            }>;
            description: z.ZodOptional<z.ZodString>;
            enum_values: z.ZodOptional<z.ZodArray<z.ZodString>>;
            irreversible: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
        default_chapter: z.ZodOptional<z.ZodString>;
        default_npc: z.ZodOptional<z.ZodString>;
        numeric_tools: z.ZodObject<{
            fatigue_increase: z.ZodObject<{
                triggers: z.ZodArray<z.ZodString>;
                delta: z.ZodNumber;
                reason: z.ZodString;
            }, z.core.$strip>;
            interest_hit: z.ZodObject<{
                affinity_delta: z.ZodNumber;
                affinity_reason: z.ZodString;
                fatigue_delta: z.ZodNumber;
                fatigue_reason: z.ZodString;
            }, z.core.$strip>;
        }, z.core.$strip>;
        animation_rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            enabled: z.ZodDefault<z.ZodBoolean>;
            when: z.ZodObject<{
                fatigue_delta_gt: z.ZodOptional<z.ZodNumber>;
                fatigue_delta_lt: z.ZodOptional<z.ZodNumber>;
                message_triggers: z.ZodOptional<z.ZodArray<z.ZodString>>;
                interest_hit: z.ZodOptional<z.ZodBoolean>;
                current_status: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
            animation: z.ZodEnum<{
                idle: "idle";
                sleeping: "sleeping";
                talk: "talk";
                excited_talk: "excited_talk";
            }>;
        }, z.core.$strip>>>;
        endings: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            display_name: z.ZodString;
            notes: z.ZodOptional<z.ZodString>;
            performance_hint: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
    triggers: z.ZodObject<{
        version: z.ZodDefault<z.ZodNumber>;
        rules: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            enabled: z.ZodDefault<z.ZodBoolean>;
            from_chapter: z.ZodString;
            to_chapter: z.ZodNullable<z.ZodString>;
            min_affinity: z.ZodDefault<z.ZodNumber>;
            max_fatigue: z.ZodOptional<z.ZodNumber>;
            require_flags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            player_triggers: z.ZodDefault<z.ZodArray<z.ZodString>>;
            set_flags: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                value: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        npc_reply_flag_rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            enabled: z.ZodDefault<z.ZodBoolean>;
            when_chapter_in: z.ZodArray<z.ZodString>;
            set_flag: z.ZodString;
            value: z.ZodDefault<z.ZodString>;
            triggers: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
    prompts: z.ZodObject<{
        affinity_tiers: z.ZodArray<z.ZodObject<{
            max_exclusive: z.ZodNumber;
            text: z.ZodString;
        }, z.core.$strip>>;
        fatigue_hints: z.ZodArray<z.ZodObject<{
            min: z.ZodNumber;
            text: z.ZodString;
        }, z.core.$strip>>;
        chapter_constraints: z.ZodRecord<z.ZodString, z.ZodString>;
        flag_constraints: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            when: z.ZodObject<{
                flag: z.ZodString;
                set: z.ZodBoolean;
                chapter: z.ZodOptional<z.ZodString>;
                chapter_not: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
            text: z.ZodString;
        }, z.core.$strip>>>;
        reply_instruction: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>;
    npcs: z.ZodArray<z.ZodObject<{
        npc_id: z.ZodString;
        name: z.ZodString;
        meta: z.ZodObject<{
            avatar: z.ZodString;
            model_path: z.ZodString;
            scale: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
            spawn_position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, z.core.$strip>;
        attributes: z.ZodObject<{
            fatigue: z.ZodNumber;
            max_fatigue: z.ZodNumber;
            affinity: z.ZodNumber;
            current_status: z.ZodString;
            favorite_things: z.ZodArray<z.ZodString>;
            favorite_synonyms: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
        }, z.core.$strip>;
        system_prompt_template: z.ZodString;
        memories: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
            keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
            content: z.ZodString;
            min_chapter: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    version_dir: z.ZodString;
}, z.core.$strip>;
export type PackChapter = z.infer<typeof packChapterSchema>;
export type PackFlagDef = z.infer<typeof packFlagDefSchema>;
export type PackMemory = z.infer<typeof packMemorySchema>;
export type PackNpc = z.infer<typeof packNpcSchema>;
export type PackTriggerRule = z.infer<typeof packTriggerRuleSchema>;
export type PackNpcReplyFlagRule = z.infer<typeof packNpcReplyFlagRuleSchema>;
export type PackTriggersFile = z.infer<typeof packTriggersFileSchema>;
export type PackAffinityTier = z.infer<typeof packAffinityTierSchema>;
export type PackFatigueHint = z.infer<typeof packFatigueHintSchema>;
export type PackFlagConstraintWhen = z.infer<typeof packFlagConstraintWhenSchema>;
export type PackFlagConstraint = z.infer<typeof packFlagConstraintSchema>;
export type PackPromptsFile = z.infer<typeof packPromptsFileSchema>;
export type PackNumericTools = z.infer<typeof packNumericToolsSchema>;
export type PackAnimationId = z.infer<typeof packAnimationIdSchema>;
export type PackAnimationRuleWhen = z.infer<typeof packAnimationRuleWhenSchema>;
export type PackAnimationRule = z.infer<typeof packAnimationRuleSchema>;
export type PackEnding = z.infer<typeof packEndingSchema>;
export type PackWorldFile = z.infer<typeof packWorldFileSchema>;
export type PackHeader = z.infer<typeof packHeaderSchema>;
export type WorldManifest = z.infer<typeof worldManifestSchema>;
export type StoryPack = z.infer<typeof storyPackSchema>;
/** 交叉校验：触发/记忆/约束引用的章节与 flag 必须在 world 中声明 */
export declare function assertPackReferences(pack: StoryPack): void;
export declare function getDefaultChapterId(pack: StoryPack): string;
export declare function getDefaultNpcId(pack: StoryPack): string;
export declare function getChapterRankMap(pack: StoryPack): Record<string, number>;
/** chapterId → HUD / 列表显示名（优先 hud_label） */
export declare function getChapterLabelMap(pack: StoryPack): Record<string, string>;
