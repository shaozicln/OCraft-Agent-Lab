'use client';

import type {
  PackAnimationRule,
  PackChapter,
  PackEnding,
  PackFlagDef,
} from '@ocraft/shared';
import type { PackFormProps } from './fields';
import {
  ANIMATION_OPTIONS,
  AddButton,
  BoolCheck,
  FMT,
  FieldLabel,
  NumInput,
  RowCard,
  SectionCard,
  SelectInput,
  StringListInput,
  TextAreaInput,
  TextInput,
} from './fields';

export function PackWorldForm({
  value,
  onChange,
  example,
  panelStyle,
}: PackFormProps) {
  const w = value.world;
  const ex = example?.world;
  const chapterOpts = w.chapters.map((c) => ({
    value: c.id,
    label: `${c.display_name} (${c.id})`,
  }));
  const npcOpts = value.npcs.map((n) => ({
    value: n.npc_id,
    label: `${n.name} (${n.npc_id})`,
  }));
  const animOpts = ANIMATION_OPTIONS.map((a) => ({ value: a, label: a }));

  const setWorld = (patch: Partial<typeof w>) =>
    onChange({ ...value, world: { ...w, ...patch } });

  const updateChapter = (i: number, next: PackChapter) => {
    const chapters = [...w.chapters];
    chapters[i] = next;
    setWorld({ chapters });
  };

  const updateFlag = (i: number, next: PackFlagDef) => {
    const flags = [...w.flags];
    flags[i] = next;
    setWorld({ flags });
  };

  const updateAnim = (i: number, next: PackAnimationRule) => {
    const animation_rules = [...w.animation_rules];
    animation_rules[i] = next;
    setWorld({ animation_rules });
  };

  const updateEnding = (i: number, next: PackEnding) => {
    const endings = [...(w.endings ?? [])];
    endings[i] = next;
    setWorld({ endings });
  };

  return (
    <>
      <SectionCard
        id="pack-sec-chapters"
        title="世界 · 章节"
        hint="章节 id 供触发器/Prompt 引用；rank 越大越靠后。"
        panelStyle={panelStyle}
        actions={
          <AddButton
            label="+ 章节"
            onClick={() =>
              setWorld({
                chapters: [
                  ...w.chapters,
                  {
                    id: `chapter_${w.chapters.length + 1}`,
                    display_name: '',
                    hud_label: '',
                    rank: w.chapters.length,
                  },
                ],
              })
            }
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel label="默认章节" format={`${FMT.optional}·${FMT.select}`}>
            <SelectInput
              value={w.default_chapter ?? ''}
              allowEmpty
              placeholder="（取 rank 最小）"
              options={chapterOpts}
              onChange={(default_chapter) =>
                setWorld({
                  default_chapter: default_chapter || undefined,
                })
              }
            />
          </FieldLabel>
          <FieldLabel label="默认 NPC" format={`${FMT.optional}·${FMT.select}`}>
            <SelectInput
              value={w.default_npc ?? ''}
              allowEmpty
              placeholder="（取列表第一个）"
              options={npcOpts}
              onChange={(default_npc) =>
                setWorld({ default_npc: default_npc || undefined })
              }
            />
          </FieldLabel>
        </div>
        {w.chapters.map((ch, i) => (
          <RowCard
            key={`${ch.id}-${i}`}
            title={`章节 ${i + 1}`}
            onRemove={
              w.chapters.length > 1
                ? () =>
                    setWorld({
                      chapters: w.chapters.filter((_, j) => j !== i),
                    })
                : undefined
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldLabel label="id" format={FMT.id}>
                <TextInput
                  value={ch.id}
                  placeholder={ex?.chapters[i]?.id}
                  onChange={(id) => updateChapter(i, { ...ch, id })}
                />
              </FieldLabel>
              <FieldLabel label="rank" format={FMT.nonnegInt}>
                <NumInput
                  value={ch.rank}
                  onChange={(rank) => updateChapter(i, { ...ch, rank })}
                />
              </FieldLabel>
              <FieldLabel label="章节名" format={FMT.free}>
                <TextInput
                  value={ch.display_name}
                  placeholder={ex?.chapters[i]?.display_name}
                  onChange={(display_name) =>
                    updateChapter(i, { ...ch, display_name })
                  }
                />
              </FieldLabel>
              <FieldLabel
                label="HUD 短名"
                format={`${FMT.optional}·${FMT.free}`}
              >
                <TextInput
                  value={ch.hud_label ?? ''}
                  placeholder={ex?.chapters[i]?.hud_label}
                  onChange={(hud_label) =>
                    updateChapter(i, {
                      ...ch,
                      hud_label: hud_label || undefined,
                    })
                  }
                />
              </FieldLabel>
            </div>
          </RowCard>
        ))}
      </SectionCard>

      <SectionCard
        id="pack-sec-flags"
        title="世界 · Flags"
        hint="bool 置位存 true，是触发条件；enum 需填写枚举值（一行一个），是剧情分叉关键词。"
        panelStyle={panelStyle}
        actions={
          <AddButton
            label="+ Flag"
            onClick={() =>
              setWorld({
                flags: [
                  ...w.flags,
                  {
                    name: `flag_${w.flags.length + 1}`,
                    type: 'bool',
                    description: '',
                    irreversible: true,
                  },
                ],
              })
            }
          />
        }
      >
        {w.flags.map((f, i) => (
          <RowCard
            key={`${f.name}-${i}`}
            title={`Flag ${i + 1}`}
            onRemove={
              w.flags.length > 1
                ? () =>
                    setWorld({
                      flags: w.flags.filter((_, j) => j !== i),
                    })
                : undefined
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldLabel label="name" format={FMT.id}>
                <TextInput
                  value={f.name}
                  placeholder={ex?.flags[i]?.name}
                  onChange={(name) => updateFlag(i, { ...f, name })}
                />
              </FieldLabel>
              <FieldLabel label="类型" format={FMT.select}>
                <SelectInput
                  value={f.type}
                  options={[
                    { value: 'bool', label: 'bool' },
                    { value: 'enum', label: 'enum' },
                  ]}
                  onChange={(type) =>
                    updateFlag(i, {
                      ...f,
                      type: type as 'bool' | 'enum',
                    })
                  }
                />
              </FieldLabel>
              <div className="sm:col-span-2">
                <FieldLabel
                  label="描述"
                  format={`${FMT.optional}·${FMT.free}`}
                >
                  <TextInput
                    value={f.description ?? ''}
                    placeholder={ex?.flags[i]?.description}
                    onChange={(description) =>
                      updateFlag(i, {
                        ...f,
                        description: description || undefined,
                      })
                    }
                  />
                </FieldLabel>
              </div>
              {f.type === 'enum' && (
                <div className="sm:col-span-2">
                  <FieldLabel label="枚举值" format={FMT.listFree}>
                    <StringListInput
                      value={f.enum_values ?? []}
                      placeholder={(ex?.flags[i]?.enum_values ?? []).join('\n')}
                      onChange={(enum_values) =>
                        updateFlag(i, { ...f, enum_values })
                      }
                    />
                  </FieldLabel>
                </div>
              )}
              <BoolCheck
                label="不可回退"
                checked={f.irreversible !== false}
                onChange={(irreversible) => updateFlag(i, { ...f, irreversible })}
              />
            </div>
          </RowCard>
        ))}
      </SectionCard>

      <SectionCard
        id="pack-sec-endings"
        title="世界 · 结局（占位）"
        panelStyle={panelStyle}
        actions={
          <AddButton
            label="+ 结局"
            onClick={() =>
              setWorld({
                endings: [
                  ...(w.endings ?? []),
                  {
                    id: `ending_${(w.endings?.length ?? 0) + 1}`,
                    display_name: '',
                  },
                ],
              })
            }
          />
        }
      >
        {(w.endings ?? []).length === 0 && (
          <p className="text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
            暂无结局条目
          </p>
        )}
        {(w.endings ?? []).map((e, i) => (
          <RowCard
            key={`${e.id}-${i}`}
            title={`结局 ${i + 1}`}
            onRemove={() =>
              setWorld({
                endings: (w.endings ?? []).filter((_, j) => j !== i),
              })
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldLabel label="id" format={FMT.id}>
                <TextInput
                  value={e.id}
                  onChange={(id) => updateEnding(i, { ...e, id })}
                />
              </FieldLabel>
              <FieldLabel label="显示名" format={FMT.free}>
                <TextInput
                  value={e.display_name}
                  onChange={(display_name) =>
                    updateEnding(i, { ...e, display_name })
                  }
                />
              </FieldLabel>
              <div className="sm:col-span-2">
                <FieldLabel
                  label="备注"
                  format={`${FMT.optional}·${FMT.free}`}
                >
                  <TextAreaInput
                    value={e.notes ?? ''}
                    onChange={(notes) =>
                      updateEnding(i, { ...e, notes: notes || undefined })
                    }
                  />
                </FieldLabel>
              </div>
            </div>
          </RowCard>
        ))}
      </SectionCard>

      <SectionCard
        id="pack-sec-numeric"
        title="世界 · 数值工具"
        hint="疲惫触发词 / 兴趣命中加减值。"
        panelStyle={panelStyle}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel label="疲惫触发词" format={FMT.listFree}>
              <StringListInput
                value={w.numeric_tools.fatigue_increase.triggers}
                placeholder={(
                  ex?.numeric_tools.fatigue_increase.triggers ?? []
                ).join('\n')}
                onChange={(triggers) =>
                  setWorld({
                    numeric_tools: {
                      ...w.numeric_tools,
                      fatigue_increase: {
                        ...w.numeric_tools.fatigue_increase,
                        triggers,
                      },
                    },
                  })
                }
              />
            </FieldLabel>
          </div>
          <FieldLabel label="疲惫 delta（每次增加量）" format={FMT.num}>
            <NumInput
              value={w.numeric_tools.fatigue_increase.delta}
              onChange={(delta) =>
                setWorld({
                  numeric_tools: {
                    ...w.numeric_tools,
                    fatigue_increase: {
                      ...w.numeric_tools.fatigue_increase,
                      delta,
                    },
                  },
                })
              }
            />
          </FieldLabel>
          <FieldLabel label="疲惫原因文案" format={FMT.free}>
            <TextInput
              value={w.numeric_tools.fatigue_increase.reason}
              placeholder={ex?.numeric_tools.fatigue_increase.reason}
              onChange={(reason) =>
                setWorld({
                  numeric_tools: {
                    ...w.numeric_tools,
                    fatigue_increase: {
                      ...w.numeric_tools.fatigue_increase,
                      reason,
                    },
                  },
                })
              }
            />
          </FieldLabel>
          <FieldLabel label="兴趣好感 delta（命中兴趣时加减）" format={FMT.num}>
            <NumInput
              value={w.numeric_tools.interest_hit.affinity_delta}
              onChange={(affinity_delta) =>
                setWorld({
                  numeric_tools: {
                    ...w.numeric_tools,
                    interest_hit: {
                      ...w.numeric_tools.interest_hit,
                      affinity_delta,
                    },
                  },
                })
              }
            />
          </FieldLabel>
          <FieldLabel label="兴趣疲惫 delta（命中兴趣时加减）" format={FMT.num}>
            <NumInput
              value={w.numeric_tools.interest_hit.fatigue_delta}
              onChange={(fatigue_delta) =>
                setWorld({
                  numeric_tools: {
                    ...w.numeric_tools,
                    interest_hit: {
                      ...w.numeric_tools.interest_hit,
                      fatigue_delta,
                    },
                  },
                })
              }
            />
          </FieldLabel>
          <FieldLabel label="兴趣好感原因" format={FMT.free}>
            <TextInput
              value={w.numeric_tools.interest_hit.affinity_reason}
              placeholder={ex?.numeric_tools.interest_hit.affinity_reason}
              onChange={(affinity_reason) =>
                setWorld({
                  numeric_tools: {
                    ...w.numeric_tools,
                    interest_hit: {
                      ...w.numeric_tools.interest_hit,
                      affinity_reason,
                    },
                  },
                })
              }
            />
          </FieldLabel>
          <FieldLabel label="兴趣疲惫原因" format={FMT.free}>
            <TextInput
              value={w.numeric_tools.interest_hit.fatigue_reason}
              placeholder={ex?.numeric_tools.interest_hit.fatigue_reason}
              onChange={(fatigue_reason) =>
                setWorld({
                  numeric_tools: {
                    ...w.numeric_tools,
                    interest_hit: {
                      ...w.numeric_tools.interest_hit,
                      fatigue_reason,
                    },
                  },
                })
              }
            />
          </FieldLabel>
        </div>
      </SectionCard>

      <SectionCard
        id="pack-sec-anim"
        title="世界 · 动画规则"
        hint="按顺序匹配；动画状态为写死枚举。"
        panelStyle={panelStyle}
        actions={
          <AddButton
            label="+ 规则"
            onClick={() =>
              setWorld({
                animation_rules: [
                  ...w.animation_rules,
                  {
                    id: `anim_${w.animation_rules.length + 1}`,
                    enabled: true,
                    when: {},
                    animation: 'talk',
                  },
                ],
              })
            }
          />
        }
      >
        {w.animation_rules.map((rule, i) => (
          <RowCard
            key={`${rule.id}-${i}`}
            title={`规则 ${i + 1}`}
            onRemove={() =>
              setWorld({
                animation_rules: w.animation_rules.filter((_, j) => j !== i),
              })
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldLabel label="id" format={FMT.free}>
                <TextInput
                  value={rule.id}
                  placeholder={ex?.animation_rules[i]?.id}
                  onChange={(id) => updateAnim(i, { ...rule, id })}
                />
              </FieldLabel>
              <FieldLabel label="动画" format={FMT.select}>
                <SelectInput
                  value={rule.animation}
                  options={animOpts}
                  onChange={(animation) =>
                    updateAnim(i, {
                      ...rule,
                      animation: animation as (typeof ANIMATION_OPTIONS)[number],
                    })
                  }
                />
              </FieldLabel>
              <BoolCheck
                label="启用"
                checked={rule.enabled !== false}
                onChange={(enabled) => updateAnim(i, { ...rule, enabled })}
              />
              <FieldLabel
                label="when.fatigue_delta_gt（本轮疲惫增量大于）"
                format={`${FMT.optional}·${FMT.num}`}
              >
                <TextInput
                  value={
                    rule.when.fatigue_delta_gt != null
                      ? String(rule.when.fatigue_delta_gt)
                      : ''
                  }
                  placeholder="例如 0"
                  onChange={(v) =>
                    updateAnim(i, {
                      ...rule,
                      when: {
                        ...rule.when,
                        fatigue_delta_gt: v === '' ? undefined : Number(v),
                      },
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel
                label="when.fatigue_delta_lt（本轮疲惫增量小于）"
                format={`${FMT.optional}·${FMT.num}`}
              >
                <TextInput
                  value={
                    rule.when.fatigue_delta_lt != null
                      ? String(rule.when.fatigue_delta_lt)
                      : ''
                  }
                  onChange={(v) =>
                    updateAnim(i, {
                      ...rule,
                      when: {
                        ...rule.when,
                        fatigue_delta_lt: v === '' ? undefined : Number(v),
                      },
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel
                label="when.interest_hit"
                format={`${FMT.optional}·${FMT.select}`}
              >
                <SelectInput
                  value={
                    rule.when.interest_hit === undefined
                      ? ''
                      : rule.when.interest_hit
                        ? 'true'
                        : 'false'
                  }
                  allowEmpty
                  placeholder="（不限）"
                  options={[
                    { value: 'true', label: 'true' },
                    { value: 'false', label: 'false' },
                  ]}
                  onChange={(v) =>
                    updateAnim(i, {
                      ...rule,
                      when: {
                        ...rule.when,
                        interest_hit:
                          v === '' ? undefined : v === 'true',
                      },
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel
                label="when.current_status"
                format={`${FMT.optional}·${FMT.select}`}
              >
                <SelectInput
                  value={rule.when.current_status ?? ''}
                  allowEmpty
                  placeholder="（不限）"
                  options={animOpts}
                  onChange={(current_status) =>
                    updateAnim(i, {
                      ...rule,
                      when: {
                        ...rule.when,
                        current_status: current_status || undefined,
                      },
                    })
                  }
                />
              </FieldLabel>
              <div className="sm:col-span-2">
                <FieldLabel
                  label="when.message_triggers"
                  format={`${FMT.optional}·${FMT.listFree}`}
                >
                  <StringListInput
                    value={rule.when.message_triggers ?? []}
                    placeholder={(
                      ex?.animation_rules[i]?.when.message_triggers ?? []
                    ).join('\n')}
                    onChange={(message_triggers) =>
                      updateAnim(i, {
                        ...rule,
                        when: {
                          ...rule.when,
                          message_triggers:
                            message_triggers.length > 0
                              ? message_triggers
                              : undefined,
                        },
                      })
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
