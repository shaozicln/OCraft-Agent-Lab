'use client';

import type {
  PackNpcReplyFlagRule,
  PackTriggerRule,
} from '@ocraft/shared';
import type { PackFormProps } from './fields';
import {
  AddButton,
  BoolCheck,
  FMT,
  FieldLabel,
  NumInput,
  RowCard,
  SectionCard,
  SelectInput,
  StringListInput,
  TextInput,
} from './fields';

export function PackTriggersForm({
  value,
  onChange,
  example,
  panelStyle,
}: PackFormProps) {
  const t = value.triggers;
  const ex = example?.triggers;
  const chapterOpts = value.world.chapters.map((c) => ({
    value: c.id,
    label: `${c.display_name} (${c.id})`,
  }));
  const flagOpts = value.world.flags.map((f) => ({
    value: f.name,
    label: f.name,
  }));

  const setTriggers = (patch: Partial<typeof t>) =>
    onChange({ ...value, triggers: { ...t, ...patch } });

  const updateRule = (i: number, next: PackTriggerRule) => {
    const rules = [...t.rules];
    rules[i] = next;
    setTriggers({ rules });
  };

  const updateReply = (i: number, next: PackNpcReplyFlagRule) => {
    const npc_reply_flag_rules = [...(t.npc_reply_flag_rules ?? [])];
    npc_reply_flag_rules[i] = next;
    setTriggers({ npc_reply_flag_rules });
  };

  return (
    <>
      <SectionCard
        id="pack-sec-triggers"
        title="触发器 · 章节推进"
        hint="from → to；require/set flags 从世界 flags 选。"
        panelStyle={panelStyle}
        actions={
          <AddButton
            label="+ 规则"
            onClick={() =>
              setTriggers({
                rules: [
                  ...t.rules,
                  {
                    id: `rule_${t.rules.length + 1}`,
                    enabled: true,
                    from_chapter: value.world.chapters[0]?.id ?? 'daily',
                    to_chapter: null,
                    min_affinity: 0,
                    require_flags: [],
                    player_triggers: [],
                    set_flags: [],
                  },
                ],
              })
            }
          />
        }
      >
        {t.rules.map((rule, i) => (
          <RowCard
            key={`${rule.id}-${i}`}
            title={`规则 ${i + 1}`}
            onRemove={() =>
              setTriggers({
                rules: t.rules.filter((_, j) => j !== i),
              })
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldLabel label="id" format={FMT.free}>
                <TextInput
                  value={rule.id}
                  placeholder={ex?.rules[i]?.id}
                  onChange={(id) => updateRule(i, { ...rule, id })}
                />
              </FieldLabel>
              <BoolCheck
                label="启用"
                checked={rule.enabled !== false}
                onChange={(enabled) => updateRule(i, { ...rule, enabled })}
              />
              <FieldLabel label="from_chapter" format={FMT.select}>
                <SelectInput
                  value={rule.from_chapter}
                  options={chapterOpts}
                  onChange={(from_chapter) =>
                    updateRule(i, { ...rule, from_chapter })
                  }
                />
              </FieldLabel>
              <FieldLabel
                label="to_chapter"
                format={`${FMT.optional}·${FMT.select}`}
              >
                <SelectInput
                  value={rule.to_chapter ?? ''}
                  allowEmpty
                  placeholder="（不升章）"
                  options={chapterOpts}
                  onChange={(to_chapter) =>
                    updateRule(i, {
                      ...rule,
                      to_chapter: to_chapter || null,
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel label="min_affinity" format={FMT.num}>
                <NumInput
                  value={rule.min_affinity}
                  onChange={(min_affinity) =>
                    updateRule(i, { ...rule, min_affinity })
                  }
                />
              </FieldLabel>
              <FieldLabel
                label="max_fatigue"
                format={`${FMT.optional}·${FMT.num}`}
              >
                <TextInput
                  value={
                    rule.max_fatigue != null ? String(rule.max_fatigue) : ''
                  }
                  onChange={(v) =>
                    updateRule(i, {
                      ...rule,
                      max_fatigue: v === '' ? undefined : Number(v),
                    })
                  }
                />
              </FieldLabel>
              <div className="sm:col-span-2">
                <FieldLabel label="玩家触发词" format={FMT.listFree}>
                  <StringListInput
                    value={rule.player_triggers}
                    placeholder={(ex?.rules[i]?.player_triggers ?? []).join(
                      '\n',
                    )}
                    onChange={(player_triggers) =>
                      updateRule(i, { ...rule, player_triggers })
                    }
                  />
                </FieldLabel>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel label="require_flags" format={FMT.listId}>
                  <StringListInput
                    value={rule.require_flags}
                    placeholder={flagOpts.map((f) => f.value).join('\n')}
                    onChange={(require_flags) =>
                      updateRule(i, { ...rule, require_flags })
                    }
                  />
                </FieldLabel>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel label="set_flags" format={FMT.setFlags}>
                  <StringListInput
                    value={rule.set_flags.map((s) =>
                      s.value && s.value !== 'true'
                        ? `${s.name}=${s.value}`
                        : s.name,
                    )}
                    placeholder="ch1_bonded"
                    onChange={(lines) =>
                      updateRule(i, {
                        ...rule,
                        set_flags: lines.map((line) => {
                          const [name, ...rest] = line.split('=');
                          return {
                            name: name.trim(),
                            value: rest.join('=').trim() || 'true',
                          };
                        }),
                      })
                    }
                  />
                </FieldLabel>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel
                  label="备注"
                  format={`${FMT.optional}·${FMT.free}`}
                >
                  <TextInput
                    value={rule.notes ?? ''}
                    placeholder={ex?.rules[i]?.notes}
                    onChange={(notes) =>
                      updateRule(i, {
                        ...rule,
                        notes: notes || undefined,
                      })
                    }
                  />
                </FieldLabel>
              </div>
            </div>
          </RowCard>
        ))}
      </SectionCard>

      <SectionCard
        id="pack-sec-reply-flags"
        title="触发器 · NPC 回复置 Flag"
        panelStyle={panelStyle}
        actions={
          <AddButton
            label="+ 规则"
            onClick={() =>
              setTriggers({
                npc_reply_flag_rules: [
                  ...(t.npc_reply_flag_rules ?? []),
                  {
                    id: `reply_${(t.npc_reply_flag_rules?.length ?? 0) + 1}`,
                    enabled: true,
                    when_chapter_in: [value.world.chapters[0]?.id ?? 'daily'],
                    set_flag: value.world.flags[0]?.name ?? 'flag',
                    value: 'true',
                    triggers: [],
                  },
                ],
              })
            }
          />
        }
      >
        {(t.npc_reply_flag_rules ?? []).map((rule, i) => (
          <RowCard
            key={`${rule.id}-${i}`}
            title={`回复规则 ${i + 1}`}
            onRemove={() =>
              setTriggers({
                npc_reply_flag_rules: (t.npc_reply_flag_rules ?? []).filter(
                  (_, j) => j !== i,
                ),
              })
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldLabel label="id" format={FMT.free}>
                <TextInput
                  value={rule.id}
                  onChange={(id) => updateReply(i, { ...rule, id })}
                />
              </FieldLabel>
              <BoolCheck
                label="启用"
                checked={rule.enabled !== false}
                onChange={(enabled) => updateReply(i, { ...rule, enabled })}
              />
              <div className="sm:col-span-2">
                <FieldLabel label="when_chapter_in" format={FMT.listId}>
                  <StringListInput
                    value={rule.when_chapter_in}
                    onChange={(when_chapter_in) =>
                      updateReply(i, { ...rule, when_chapter_in })
                    }
                  />
                </FieldLabel>
              </div>
              <FieldLabel label="set_flag" format={FMT.select}>
                <SelectInput
                  value={rule.set_flag}
                  options={flagOpts}
                  onChange={(set_flag) => updateReply(i, { ...rule, set_flag })}
                />
              </FieldLabel>
              <FieldLabel
                label="value"
                format="不限·bool 用 true / enum 用枚举值"
              >
                <TextInput
                  value={rule.value}
                  onChange={(v) => updateReply(i, { ...rule, value: v })}
                />
              </FieldLabel>
              <div className="sm:col-span-2">
                <FieldLabel label="triggers" format={FMT.listFree}>
                  <StringListInput
                    value={rule.triggers}
                    onChange={(triggers) =>
                      updateReply(i, { ...rule, triggers })
                    }
                  />
                </FieldLabel>
              </div>
            </div>
          </RowCard>
        ))}
      </SectionCard>
    </>
  );
}
