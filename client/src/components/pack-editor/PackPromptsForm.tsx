'use client';

import type { PackFlagConstraint } from '@ocraft/shared';
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
  TextAreaInput,
  TextInput,
} from './fields';

export function PackPromptsForm({
  value,
  onChange,
  example,
  panelStyle,
}: PackFormProps) {
  const p = value.prompts;
  const ex = example?.prompts;
  const chapterOpts = value.world.chapters.map((c) => ({
    value: c.id,
    label: `${c.display_name} (${c.id})`,
  }));
  const flagOpts = value.world.flags.map((f) => ({
    value: f.name,
    label: f.name,
  }));

  const setPrompts = (patch: Partial<typeof p>) =>
    onChange({ ...value, prompts: { ...p, ...patch } });

  const updateFlagConstraint = (i: number, next: PackFlagConstraint) => {
    const flag_constraints = [...p.flag_constraints];
    flag_constraints[i] = next;
    setPrompts({ flag_constraints });
  };

  return (
    <>
      <SectionCard
        id="pack-sec-prompts-common"
        title="Prompt · 通用"
        panelStyle={panelStyle}
      >
        <FieldLabel label="reply_instruction" format={FMT.free}>
          <TextAreaInput
            rows={4}
            value={p.reply_instruction}
            placeholder={ex?.reply_instruction}
            onChange={(reply_instruction) =>
              setPrompts({ reply_instruction })
            }
          />
        </FieldLabel>
      </SectionCard>

      <SectionCard
        id="pack-sec-affinity"
        title="Prompt · 好感区间（affinity）"
        hint="当前好感 affinity &lt; max_exclusive 时命中该档；最后一档用很大的 max。"
        panelStyle={panelStyle}
        actions={
          <AddButton
            label="+ 档位"
            onClick={() =>
              setPrompts({
                affinity_tiers: [
                  ...p.affinity_tiers,
                  { max_exclusive: 100, text: '' },
                ],
              })
            }
          />
        }
      >
        {p.affinity_tiers.map((tier, i) => (
          <RowCard
            key={i}
            title={`档位 ${i + 1}`}
            onRemove={
              p.affinity_tiers.length > 1
                ? () =>
                    setPrompts({
                      affinity_tiers: p.affinity_tiers.filter((_, j) => j !== i),
                    })
                : undefined
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldLabel label="max_exclusive" format={FMT.num}>
                <NumInput
                  value={tier.max_exclusive}
                  onChange={(max_exclusive) => {
                    const affinity_tiers = [...p.affinity_tiers];
                    affinity_tiers[i] = { ...tier, max_exclusive };
                    setPrompts({ affinity_tiers });
                  }}
                />
              </FieldLabel>
              <div className="sm:col-span-2">
                <FieldLabel label="文案" format={FMT.free}>
                  <TextAreaInput
                    value={tier.text}
                    placeholder={ex?.affinity_tiers[i]?.text}
                    onChange={(text) => {
                      const affinity_tiers = [...p.affinity_tiers];
                      affinity_tiers[i] = { ...tier, text };
                      setPrompts({ affinity_tiers });
                    }}
                  />
                </FieldLabel>
              </div>
            </div>
          </RowCard>
        ))}
      </SectionCard>

      <SectionCard
        id="pack-sec-fatigue"
        title="Prompt · 疲惫提示（fatigue）"
        hint="当前疲惫 fatigue &gt;= min 时命中该档提示。"
        panelStyle={panelStyle}
        actions={
          <AddButton
            label="+ 提示"
            onClick={() =>
              setPrompts({
                fatigue_hints: [...p.fatigue_hints, { min: 0, text: '' }],
              })
            }
          />
        }
      >
        {p.fatigue_hints.map((hint, i) => (
          <RowCard
            key={i}
            title={`提示 ${i + 1}`}
            onRemove={
              p.fatigue_hints.length > 1
                ? () =>
                    setPrompts({
                      fatigue_hints: p.fatigue_hints.filter((_, j) => j !== i),
                    })
                : undefined
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldLabel label="min" format={FMT.num}>
                <NumInput
                  value={hint.min}
                  onChange={(min) => {
                    const fatigue_hints = [...p.fatigue_hints];
                    fatigue_hints[i] = { ...hint, min };
                    setPrompts({ fatigue_hints });
                  }}
                />
              </FieldLabel>
              <div className="sm:col-span-2">
                <FieldLabel label="文案" format={FMT.free}>
                  <TextAreaInput
                    value={hint.text}
                    placeholder={ex?.fatigue_hints[i]?.text}
                    onChange={(text) => {
                      const fatigue_hints = [...p.fatigue_hints];
                      fatigue_hints[i] = { ...hint, text };
                      setPrompts({ fatigue_hints });
                    }}
                  />
                </FieldLabel>
              </div>
            </div>
          </RowCard>
        ))}
      </SectionCard>

      <SectionCard
        id="pack-sec-chapter-c"
        title="Prompt · 章节约束"
        hint="每个章节一段约束正文。"
        panelStyle={panelStyle}
      >
        {value.world.chapters.map((ch) => (
          <FieldLabel
            key={ch.id}
            label={`${ch.display_name} (${ch.id})`}
            format={FMT.free}
          >
            <TextAreaInput
              rows={3}
              value={p.chapter_constraints[ch.id] ?? ''}
              placeholder={ex?.chapter_constraints[ch.id]}
              onChange={(text) =>
                setPrompts({
                  chapter_constraints: {
                    ...p.chapter_constraints,
                    [ch.id]: text,
                  },
                })
              }
            />
          </FieldLabel>
        ))}
      </SectionCard>

      <SectionCard
        id="pack-sec-flag-c"
        title="Prompt · Flag 约束"
        panelStyle={panelStyle}
        actions={
          <AddButton
            label="+ 约束"
            onClick={() =>
              setPrompts({
                flag_constraints: [
                  ...p.flag_constraints,
                  {
                    id: `fc_${p.flag_constraints.length + 1}`,
                    when: {
                      flag: value.world.flags[0]?.name ?? 'flag',
                      set: true,
                    },
                    text: '',
                  },
                ],
              })
            }
          />
        }
      >
        {p.flag_constraints.map((fc, i) => (
          <RowCard
            key={`${fc.id}-${i}`}
            title={`约束 ${i + 1}`}
            onRemove={() =>
              setPrompts({
                flag_constraints: p.flag_constraints.filter((_, j) => j !== i),
              })
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldLabel label="id" format={FMT.free}>
                <TextInput
                  value={fc.id}
                  onChange={(id) => updateFlagConstraint(i, { ...fc, id })}
                />
              </FieldLabel>
              <FieldLabel label="when.flag" format={FMT.select}>
                <SelectInput
                  value={fc.when.flag}
                  options={flagOpts}
                  onChange={(flag) =>
                    updateFlagConstraint(i, {
                      ...fc,
                      when: { ...fc.when, flag },
                    })
                  }
                />
              </FieldLabel>
              <BoolCheck
                label="when.set（已置位）"
                checked={fc.when.set}
                onChange={(set) =>
                  updateFlagConstraint(i, {
                    ...fc,
                    when: { ...fc.when, set },
                  })
                }
              />
              <FieldLabel
                label="when.chapter"
                format={`${FMT.optional}·${FMT.select}`}
              >
                <SelectInput
                  value={fc.when.chapter ?? ''}
                  allowEmpty
                  options={chapterOpts}
                  onChange={(chapter) =>
                    updateFlagConstraint(i, {
                      ...fc,
                      when: {
                        ...fc.when,
                        chapter: chapter || undefined,
                      },
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel
                label="when.chapter_not"
                format={`${FMT.optional}·${FMT.select}`}
              >
                <SelectInput
                  value={fc.when.chapter_not ?? ''}
                  allowEmpty
                  options={chapterOpts}
                  onChange={(chapter_not) =>
                    updateFlagConstraint(i, {
                      ...fc,
                      when: {
                        ...fc.when,
                        chapter_not: chapter_not || undefined,
                      },
                    })
                  }
                />
              </FieldLabel>
              <div className="sm:col-span-2">
                <FieldLabel label="约束文案" format={FMT.free}>
                  <TextAreaInput
                    value={fc.text}
                    placeholder={ex?.flag_constraints[i]?.text}
                    onChange={(text) =>
                      updateFlagConstraint(i, { ...fc, text })
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
