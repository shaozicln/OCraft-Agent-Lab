'use client';

import type { PackMemory, PackNpc } from '@ocraft/shared';
import type { PackFormProps } from './fields';
import {
  ANIMATION_OPTIONS,
  AddButton,
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

function synonymsToLines(
  syn: Record<string, string[]> | undefined,
): string[] {
  if (!syn) return [];
  return Object.entries(syn).map(([k, v]) => `${k}=${v.join(',')}`);
}

function linesToSynonyms(lines: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const vals = line
      .slice(eq + 1)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (key) out[key] = vals;
  }
  return out;
}

export function PackNpcsForm({
  value,
  onChange,
  example,
  panelStyle,
}: PackFormProps) {
  const animOpts = ANIMATION_OPTIONS.map((a) => ({ value: a, label: a }));
  const chapterOpts = value.world.chapters.map((c) => ({
    value: c.id,
    label: `${c.display_name} (${c.id})`,
  }));

  const updateNpc = (i: number, next: PackNpc) => {
    const npcs = [...value.npcs];
    npcs[i] = next;
    onChange({ ...value, npcs });
  };

  const updateMemory = (ni: number, mi: number, next: PackMemory) => {
    const npc = value.npcs[ni];
    const memories = [...npc.memories];
    memories[mi] = next;
    updateNpc(ni, { ...npc, memories });
  };

  return (
    <SectionCard
      id="pack-sec-npcs"
      title="NPC"
      hint="出场：appear_from_chapter / appear_require_flags 控制场景刷人；current_status 为写死动画；同义词：兴趣=同义词1,同义词2"
      panelStyle={panelStyle}
      actions={
        <AddButton
          label="+ NPC"
          onClick={() =>
            onChange({
              ...value,
              npcs: [
                ...value.npcs,
                {
                  npc_id: `npc_${value.npcs.length + 1}`,
                  name: '',
                  meta: {
                    avatar: '',
                    model_path: '',
                    scale: [1, 1, 1],
                    spawn_position: [0, 0, 0],
                  },
                  attributes: {
                    fatigue: 0,
                    max_fatigue: 100,
                    affinity: 0,
                    current_status: 'idle',
                    favorite_things: [],
                  },
                  system_prompt_template: '',
                  memories: [],
                  appear_require_flags: [],
                },
              ],
            })
          }
        />
      }
    >
      {value.npcs.map((npc, i) => {
        const ex = example?.npcs[i];
        return (
          <RowCard
            key={`${npc.npc_id}-${i}`}
            title={`NPC ${i + 1}: ${npc.name || npc.npc_id}`}
            onRemove={
              value.npcs.length > 1
                ? () =>
                    onChange({
                      ...value,
                      npcs: value.npcs.filter((_, j) => j !== i),
                    })
                : undefined
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldLabel label="npc_id" format={FMT.id}>
                <TextInput
                  value={npc.npc_id}
                  placeholder={ex?.npc_id}
                  onChange={(npc_id) => updateNpc(i, { ...npc, npc_id })}
                />
              </FieldLabel>
              <FieldLabel label="名字" format={FMT.free}>
                <TextInput
                  value={npc.name}
                  placeholder={ex?.name}
                  onChange={(name) => updateNpc(i, { ...npc, name })}
                />
              </FieldLabel>
              <FieldLabel label="avatar" format={FMT.path}>
                <TextInput
                  value={npc.meta.avatar}
                  placeholder={ex?.meta.avatar}
                  onChange={(avatar) =>
                    updateNpc(i, {
                      ...npc,
                      meta: { ...npc.meta, avatar },
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel label="model_path" format={FMT.path}>
                <TextInput
                  value={npc.meta.model_path}
                  placeholder={ex?.meta.model_path}
                  onChange={(model_path) =>
                    updateNpc(i, {
                      ...npc,
                      meta: { ...npc.meta, model_path },
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel label="scale (x,y,z)" format={FMT.xyz}>
                <TextInput
                  value={npc.meta.scale.join(',')}
                  placeholder={ex?.meta.scale.join(',')}
                  onChange={(v) => {
                    const parts = v.split(',').map((s) => Number(s.trim()));
                    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
                      updateNpc(i, {
                        ...npc,
                        meta: {
                          ...npc.meta,
                          scale: [parts[0], parts[1], parts[2]],
                        },
                      });
                    }
                  }}
                />
              </FieldLabel>
              <FieldLabel label="spawn_position (x,y,z)" format={FMT.xyz}>
                <TextInput
                  value={npc.meta.spawn_position.join(',')}
                  placeholder={ex?.meta.spawn_position.join(',')}
                  onChange={(v) => {
                    const parts = v.split(',').map((s) => Number(s.trim()));
                    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
                      updateNpc(i, {
                        ...npc,
                        meta: {
                          ...npc.meta,
                          spawn_position: [parts[0], parts[1], parts[2]],
                        },
                      });
                    }
                  }}
                />
              </FieldLabel>
              <FieldLabel
                label="出场起始章（空=开场即在）"
                format={FMT.id}
              >
                <SelectInput
                  value={npc.appear_from_chapter ?? ''}
                  allowEmpty
                  placeholder="（开场即在）"
                  options={chapterOpts}
                  onChange={(appear_from_chapter) =>
                    updateNpc(i, {
                      ...npc,
                      appear_from_chapter: appear_from_chapter || undefined,
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel
                label="出场所需 flags（全部置位才刷）"
                format={FMT.id}
              >
                <StringListInput
                  value={npc.appear_require_flags ?? []}
                  placeholder={
                    ex?.appear_require_flags?.length
                      ? ex.appear_require_flags.join('\n')
                      : 'flag_id_1\nflag_id_2'
                  }
                  onChange={(appear_require_flags) =>
                    updateNpc(i, { ...npc, appear_require_flags })
                  }
                />
              </FieldLabel>
              <FieldLabel label="fatigue（疲惫值，初始）" format={FMT.num}>
                <NumInput
                  value={npc.attributes.fatigue}
                  onChange={(fatigue) =>
                    updateNpc(i, {
                      ...npc,
                      attributes: { ...npc.attributes, fatigue },
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel label="max_fatigue（疲惫上限）" format={FMT.num}>
                <NumInput
                  value={npc.attributes.max_fatigue}
                  onChange={(max_fatigue) =>
                    updateNpc(i, {
                      ...npc,
                      attributes: { ...npc.attributes, max_fatigue },
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel label="affinity（好感度，初始）" format={FMT.num}>
                <NumInput
                  value={npc.attributes.affinity}
                  onChange={(affinity) =>
                    updateNpc(i, {
                      ...npc,
                      attributes: { ...npc.attributes, affinity },
                    })
                  }
                />
              </FieldLabel>
              <FieldLabel label="角色状态 current_status" format={FMT.select}>
                <SelectInput
                  value={npc.attributes.current_status}
                  options={animOpts}
                  onChange={(current_status) =>
                    updateNpc(i, {
                      ...npc,
                      attributes: { ...npc.attributes, current_status },
                    })
                  }
                />
              </FieldLabel>
              <div className="sm:col-span-2">
                <FieldLabel label="favorite_things" format={FMT.listFree}>
                  <StringListInput
                    value={npc.attributes.favorite_things}
                    placeholder={(ex?.attributes.favorite_things ?? []).join(
                      '\n',
                    )}
                    onChange={(favorite_things) =>
                      updateNpc(i, {
                        ...npc,
                        attributes: { ...npc.attributes, favorite_things },
                      })
                    }
                  />
                </FieldLabel>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel
                  label="favorite_synonyms"
                  format={FMT.synonyms}
                >
                  <StringListInput
                    value={synonymsToLines(npc.attributes.favorite_synonyms)}
                    placeholder={synonymsToLines(
                      ex?.attributes.favorite_synonyms,
                    ).join('\n')}
                    onChange={(lines) => {
                      const syn = linesToSynonyms(lines);
                      updateNpc(i, {
                        ...npc,
                        attributes: {
                          ...npc.attributes,
                          favorite_synonyms:
                            Object.keys(syn).length > 0 ? syn : undefined,
                        },
                      });
                    }}
                  />
                </FieldLabel>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel label="system_prompt_template" format={FMT.free}>
                  <TextAreaInput
                    rows={6}
                    value={npc.system_prompt_template}
                    placeholder={ex?.system_prompt_template}
                    onChange={(system_prompt_template) =>
                      updateNpc(i, { ...npc, system_prompt_template })
                    }
                  />
                </FieldLabel>
              </div>
            </div>

            <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">记忆</p>
                <AddButton
                  label="+ 记忆"
                  onClick={() =>
                    updateNpc(i, {
                      ...npc,
                      memories: [
                        ...npc.memories,
                        {
                          id: `mem_${npc.memories.length + 1}`,
                          tags: [],
                          keywords: [],
                          content: '',
                        },
                      ],
                    })
                  }
                />
              </div>
              {npc.memories.map((mem, mi) => (
                <RowCard
                  key={`${mem.id}-${mi}`}
                  title={`记忆 ${mi + 1}`}
                  onRemove={() =>
                    updateNpc(i, {
                      ...npc,
                      memories: npc.memories.filter((_, j) => j !== mi),
                    })
                  }
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <FieldLabel label="id" format={FMT.free}>
                      <TextInput
                        value={mem.id}
                        onChange={(id) =>
                          updateMemory(i, mi, { ...mem, id })
                        }
                      />
                    </FieldLabel>
                    <FieldLabel
                      label="min_chapter"
                      format={`${FMT.optional}·${FMT.select}`}
                    >
                      <SelectInput
                        value={mem.min_chapter ?? ''}
                        allowEmpty
                        options={chapterOpts}
                        onChange={(min_chapter) =>
                          updateMemory(i, mi, {
                            ...mem,
                            min_chapter: min_chapter || undefined,
                          })
                        }
                      />
                    </FieldLabel>
                    <FieldLabel label="tags" format={FMT.listFree}>
                      <StringListInput
                        value={mem.tags}
                        onChange={(tags) =>
                          updateMemory(i, mi, { ...mem, tags })
                        }
                      />
                    </FieldLabel>
                    <FieldLabel label="keywords" format={FMT.listFree}>
                      <StringListInput
                        value={mem.keywords}
                        onChange={(keywords) =>
                          updateMemory(i, mi, { ...mem, keywords })
                        }
                      />
                    </FieldLabel>
                    <div className="sm:col-span-2">
                      <FieldLabel label="content" format={FMT.free}>
                        <TextAreaInput
                          value={mem.content}
                          onChange={(content) =>
                            updateMemory(i, mi, { ...mem, content })
                          }
                        />
                      </FieldLabel>
                    </div>
                  </div>
                </RowCard>
              ))}
            </div>
          </RowCard>
        );
      })}
    </SectionCard>
  );
}
