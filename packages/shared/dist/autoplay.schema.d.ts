import { z } from 'zod';
import { type AutoPlayProgressSnapshot } from './autoplay-reachability';
export type { AutoPlayProgressSnapshot } from './autoplay-reachability';
/** 自动演目标：由「当前 Pack + 用户设置」组装，禁止运行时写死 feel */
export declare const autoPlayGoalSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    world_id: z.ZodOptional<z.ZodString>;
    pack_version_id: z.ZodOptional<z.ZodString>;
    npc_id: z.ZodString;
    target_chapter: z.ZodOptional<z.ZodString>;
    target_exchange: z.ZodOptional<z.ZodString>;
    target_ending: z.ZodOptional<z.ZodString>;
    stop_at_final_chapter: z.ZodDefault<z.ZodBoolean>;
    final_chapter_id: z.ZodOptional<z.ZodString>;
    chapter_speak_cap: z.ZodDefault<z.ZodNumber>;
    max_turns: z.ZodDefault<z.ZodNumber>;
    wait_ms: z.ZodDefault<z.ZodNumber>;
    style_id: z.ZodDefault<z.ZodString>;
    takeover_mode: z.ZodDefault<z.ZodEnum<{
        allow: "allow";
        watch_only: "watch_only";
    }>>;
    enter_epilogue: z.ZodDefault<z.ZodBoolean>;
    epilogue_mode: z.ZodOptional<z.ZodEnum<{
        a: "a";
        b: "b";
        c: "c";
    }>>;
    accelerate: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type AutoPlayGoal = z.infer<typeof autoPlayGoalSchema>;
export declare const autoPlayEpilogueModeSchema: z.ZodEnum<{
    a: "a";
    b: "b";
    c: "c";
}>;
export type AutoPlayEpilogueMode = z.infer<typeof autoPlayEpilogueModeSchema>;
export declare const AUTO_PLAY_EPILOGUE_MODE_LABELS: Record<AutoPlayEpilogueMode, string>;
/** 正片 / 杀青 */
export type AutoPlayPhase = 'main' | 'epilogue';
export declare const autoPlayStatusSchema: z.ZodEnum<{
    abort: "abort";
    done: "done";
    idle: "idle";
    running: "running";
    paused: "paused";
}>;
export type AutoPlayStatus = z.infer<typeof autoPlayStatusSchema>;
/** AP-1：导演排场一拍里的一句（玩家演出位 stub = speaker_id `player`） */
export declare const autoPlayBeatLineSchema: z.ZodObject<{
    speaker_kind: z.ZodEnum<{
        player: "player";
        npc: "npc";
    }>;
    speaker_id: z.ZodString;
    text: z.ZodString;
}, z.core.$strip>;
export type AutoPlayBeatLine = z.infer<typeof autoPlayBeatLineSchema>;
export declare const autoPlayNextProposalSchema: z.ZodObject<{
    say: z.ZodOptional<z.ZodString>;
    lines: z.ZodDefault<z.ZodArray<z.ZodObject<{
        speaker_kind: z.ZodEnum<{
            player: "player";
            npc: "npc";
        }>;
        speaker_id: z.ZodString;
        text: z.ZodString;
    }, z.core.$strip>>>;
    done: z.ZodBoolean;
    reason: z.ZodDefault<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<{
        agent: "agent";
        mock: "mock";
    }>>;
}, z.core.$strip>;
export type AutoPlayNextProposal = z.infer<typeof autoPlayNextProposalSchema>;
/** 风格预设（产品写死；深浅与每拍 N 藏在风格里） */
export declare const AUTO_PLAY_STYLE_PRESETS: readonly [{
    readonly id: "bare";
    readonly label: "裸 AI";
    readonly depth: "none";
    readonly blurb: "少约束，模型自由发挥（仍禁改章）";
    readonly prompt_hint: "少加风格约束，自然口语即可。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
}, {
    readonly id: "direct";
    readonly label: "直给推进";
    readonly depth: "shallow";
    readonly blurb: "少铺垫，尽快碰关键事件";
    readonly prompt_hint: "风格：直给推进。少铺垫，尽快碰到关键异常/事件；避免长篇关系戏。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
}, {
    readonly id: "daily";
    readonly label: "日常感";
    readonly depth: "shallow_mid";
    readonly blurb: "先像同学闲聊，再碰到事";
    readonly prompt_hint: "风格：日常感。先闲聊口吻，再自然碰到事，别上来揭底。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
}, {
    readonly id: "rumor";
    readonly label: "传言慢热";
    readonly depth: "mid";
    readonly blurb: "先传闻/八卦，再坐实异常";
    readonly prompt_hint: "风格：传言慢热。先提传闻/八卦，再逐步坐实，勿第一句揭底。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
}, {
    readonly id: "bond";
    readonly label: "关系优先";
    readonly depth: "mid_deep";
    readonly blurb: "先把人和羁绊说清再推进";
    readonly prompt_hint: "风格：关系优先。先照顾同学关系/态度，再推进事件。";
    readonly light_npc_tint: true;
    readonly max_speakers: 3;
}, {
    readonly id: "suspense";
    readonly label: "悬疑压步";
    readonly depth: "deep";
    readonly blurb: "信息憋着给，多疑点少答案";
    readonly prompt_hint: "风格：悬疑压步。多暗示少结论，信息憋着给。";
    readonly light_npc_tint: true;
    readonly max_speakers: 3;
}, {
    readonly id: "warm";
    readonly label: "温情向";
    readonly depth: "mid";
    readonly blurb: "冲突也偏软、少刀";
    readonly prompt_hint: "风格：温情向。语气偏软、关心，少锋利对抗。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
}, {
    readonly id: "sharp";
    readonly label: "锋利短句";
    readonly depth: "shallow_mid";
    readonly blurb: "对话干脆、少解释";
    readonly prompt_hint: "风格：锋利短句。短、干脆，少解释少内心独白。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
}, {
    readonly id: "funny";
    readonly label: "搞笑";
    readonly depth: "shallow_mid";
    readonly blurb: "轻喜剧节奏；玩笑不破禁区";
    readonly prompt_hint: "风格：搞笑。轻喜剧节奏，玩笑不剧透、不破 Pack 禁区。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
}];
export type AutoPlayStyleId = (typeof AUTO_PLAY_STYLE_PRESETS)[number]['id'];
export declare const autoPlayStyleIdSchema: z.ZodEnum<{
    direct: "direct";
    bare: "bare";
    daily: "daily";
    rumor: "rumor";
    bond: "bond";
    suspense: "suspense";
    warm: "warm";
    sharp: "sharp";
    funny: "funny";
}>;
export declare const DEFAULT_AUTO_PLAY_STYLE_ID: AutoPlayStyleId;
export declare const DEFAULT_CHAPTER_SPEAK_CAP = 100;
/** 超过此值须提示 token/费用风险 */
export declare const CHAPTER_SPEAK_CAP_COST_WARN = 200;
export declare function getAutoPlayStylePreset(id: string | undefined): {
    readonly id: "bare";
    readonly label: "裸 AI";
    readonly depth: "none";
    readonly blurb: "少约束，模型自由发挥（仍禁改章）";
    readonly prompt_hint: "少加风格约束，自然口语即可。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
} | {
    readonly id: "direct";
    readonly label: "直给推进";
    readonly depth: "shallow";
    readonly blurb: "少铺垫，尽快碰关键事件";
    readonly prompt_hint: "风格：直给推进。少铺垫，尽快碰到关键异常/事件；避免长篇关系戏。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
} | {
    readonly id: "daily";
    readonly label: "日常感";
    readonly depth: "shallow_mid";
    readonly blurb: "先像同学闲聊，再碰到事";
    readonly prompt_hint: "风格：日常感。先闲聊口吻，再自然碰到事，别上来揭底。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
} | {
    readonly id: "rumor";
    readonly label: "传言慢热";
    readonly depth: "mid";
    readonly blurb: "先传闻/八卦，再坐实异常";
    readonly prompt_hint: "风格：传言慢热。先提传闻/八卦，再逐步坐实，勿第一句揭底。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
} | {
    readonly id: "bond";
    readonly label: "关系优先";
    readonly depth: "mid_deep";
    readonly blurb: "先把人和羁绊说清再推进";
    readonly prompt_hint: "风格：关系优先。先照顾同学关系/态度，再推进事件。";
    readonly light_npc_tint: true;
    readonly max_speakers: 3;
} | {
    readonly id: "suspense";
    readonly label: "悬疑压步";
    readonly depth: "deep";
    readonly blurb: "信息憋着给，多疑点少答案";
    readonly prompt_hint: "风格：悬疑压步。多暗示少结论，信息憋着给。";
    readonly light_npc_tint: true;
    readonly max_speakers: 3;
} | {
    readonly id: "warm";
    readonly label: "温情向";
    readonly depth: "mid";
    readonly blurb: "冲突也偏软、少刀";
    readonly prompt_hint: "风格：温情向。语气偏软、关心，少锋利对抗。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
} | {
    readonly id: "sharp";
    readonly label: "锋利短句";
    readonly depth: "shallow_mid";
    readonly blurb: "对话干脆、少解释";
    readonly prompt_hint: "风格：锋利短句。短、干脆，少解释少内心独白。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
} | {
    readonly id: "funny";
    readonly label: "搞笑";
    readonly depth: "shallow_mid";
    readonly blurb: "轻喜剧节奏；玩笑不破禁区";
    readonly prompt_hint: "风格：搞笑。轻喜剧节奏，玩笑不剧透、不破 Pack 禁区。";
    readonly light_npc_tint: false;
    readonly max_speakers: 2;
};
/** 风格隐含的每拍最多说话人数（不对用户单独暴露） */
export declare function getAutoPlayStyleMaxSpeakers(id: string | undefined): number;
/** 把 say / lines 归一成拍内台词列表 */
export declare function normalizeAutoPlayBeatLines(proposal: Pick<AutoPlayNextProposal, 'say' | 'lines'>): AutoPlayBeatLine[];
/** 开演前用户设置（本局可覆盖 Pack 默认风格） */
export declare const autoPlayPrefsSchema: z.ZodObject<{
    style_id: z.ZodDefault<z.ZodEnum<{
        direct: "direct";
        bare: "bare";
        daily: "daily";
        rumor: "rumor";
        bond: "bond";
        suspense: "suspense";
        warm: "warm";
        sharp: "sharp";
        funny: "funny";
    }>>;
    stop_at_chapter: z.ZodOptional<z.ZodString>;
    ending_mode: z.ZodDefault<z.ZodEnum<{
        specific: "specific";
        random: "random";
        final_chapter: "final_chapter";
    }>>;
    target_ending_id: z.ZodOptional<z.ZodString>;
    takeover_mode: z.ZodDefault<z.ZodEnum<{
        allow: "allow";
        watch_only: "watch_only";
    }>>;
    wait_ms: z.ZodDefault<z.ZodNumber>;
    chapter_speak_cap: z.ZodDefault<z.ZodNumber>;
    enter_epilogue: z.ZodDefault<z.ZodBoolean>;
    epilogue_mode: z.ZodOptional<z.ZodEnum<{
        a: "a";
        b: "b";
        c: "c";
    }>>;
}, z.core.$strip>;
export type AutoPlayPrefs = z.infer<typeof autoPlayPrefsSchema>;
export type AutoPlayEndingOption = {
    id: string;
    display_name: string;
    enabled?: boolean;
    /** AP-3 门控（运行时下发；缺省时仅按 enabled） */
    chapter?: string;
    require_flags?: string[];
    require_any_flags?: string[];
    forbid_flags?: string[];
    set_flags?: Array<{
        name: string;
        value?: string;
    }>;
};
export type AutoPlayStopKind = 'ending' | 'chapter' | 'final_chapter' | null;
/**
 * 由当前 Pack 摘要 + 用户设置组装本局目标（AP-0b）。
 * 不读取 FEEL 常量。传入 progress 时按 AP-3 只从可达结局中抽目标。
 */
export declare function buildAutoPlayGoal(opts: {
    npcId: string;
    prefs: AutoPlayPrefs;
    pack?: {
        world_id?: string;
        version_dir?: string;
        display_name?: string;
        endings?: AutoPlayEndingOption[];
        chapters?: {
            id: string;
        }[];
    };
    /** AP-3：当前章 / flags / rank → 可达结局筛选 */
    progress?: AutoPlayProgressSnapshot | null;
}): AutoPlayGoal;
/** 完成时属于哪种停因（杀青仅 ending） */
export declare function resolveAutoPlayStopKind(goal: AutoPlayGoal, actual: {
    chapter?: string;
    endingId?: string | null;
    sawTargetExchange?: boolean;
}): AutoPlayStopKind;
/**
 * @deprecated 仅离线 eval / 历史对照；运行时禁止作为默认目标。
 */
export declare const FEEL_DEMO_AUTO_GOAL: AutoPlayGoal;
