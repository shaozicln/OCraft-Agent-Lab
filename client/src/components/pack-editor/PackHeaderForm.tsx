'use client';

import {
  AUTO_PLAY_STYLE_PRESETS,
  DEFAULT_AUTO_PLAY_STYLE_ID,
  type PackPlayablePlayer,
} from '@ocraft/shared';
import type { PackFormProps } from './fields';
import {
  FMT,
  FieldLabel,
  SectionCard,
  TextAreaInput,
  TextInput,
} from './fields';

function playableFromHeader(
  raw: PackPlayablePlayer | undefined,
): PackPlayablePlayer {
  return {
    enabled: raw?.enabled !== false,
    id: raw?.id?.trim() || 'player',
    appear_from_chapter: raw?.appear_from_chapter,
    appear_require_flags: raw?.appear_require_flags ?? [],
  };
}

export function PackHeaderForm({
  value,
  onChange,
  example,
  panelStyle,
}: PackFormProps) {
  const h = value.header;
  const ex = example?.header;
  const chapters = value.world.chapters;
  const playable = playableFromHeader(h.playable_player);
  const styleId = h.default_style_id ?? DEFAULT_AUTO_PLAY_STYLE_ID;

  const patchPlayable = (next: PackPlayablePlayer) => {
    onChange({
      ...value,
      header: {
        ...h,
        // 显式写入，避免「省略=兼容开启」与编辑器关位冲突
        playable_player: next,
      },
    });
  };

  return (
    <SectionCard
      id="pack-sec-header"
      title="包头"
      hint="世界 / 版本请在别处修改；下方为自动演默认风格与可演出玩家位"
      panelStyle={panelStyle}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="世界 ID" format={`只读·${FMT.id}`}>
          <TextInput value={h.world_id} readOnly onChange={() => undefined} />
        </FieldLabel>
        <FieldLabel label="版本目录" format="只读">
          <TextInput
            value={value.version_dir}
            readOnly
            onChange={() => undefined}
          />
        </FieldLabel>
        <FieldLabel label="版本名" format={`只读·${FMT.free}`}>
          <TextInput
            value={h.display_name}
            readOnly
            onChange={() => undefined}
            placeholder={ex?.display_name}
          />
        </FieldLabel>
        <FieldLabel label="创建时间" format="只读">
          <TextInput value={h.created_at} readOnly onChange={() => undefined} />
        </FieldLabel>
        <div className="sm:col-span-2">
          <FieldLabel label="备注" format={FMT.free}>
            <TextAreaInput
              value={h.notes ?? ''}
              placeholder={ex?.notes}
              onChange={(notes) =>
                onChange({
                  ...value,
                  header: { ...h, notes: notes || undefined },
                })
              }
            />
          </FieldLabel>
        </div>

        <div className="sm:col-span-2 border-t pt-3" style={{ borderColor: 'var(--ui-border)' }}>
          <p className="mb-2 text-xs" style={{ color: 'var(--ui-fg-muted)' }}>
            自动演（正片）· 写在生成草稿/大纲上方的 Pack 默认值；玩家开演可覆盖、不写回
          </p>
        </div>

        <FieldLabel label="默认风格" format={FMT.select}>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{
              background: 'var(--ui-input)',
              borderColor: 'var(--ui-border)',
              color: 'var(--ui-fg)',
            }}
            value={styleId}
            onChange={(e) =>
              onChange({
                ...value,
                header: {
                  ...h,
                  default_style_id: e.target.value || undefined,
                },
              })
            }
          >
            {AUTO_PLAY_STYLE_PRESETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — {s.blurb}
              </option>
            ))}
          </select>
        </FieldLabel>

        <FieldLabel label="可演出玩家位" format={FMT.select}>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{
              background: 'var(--ui-input)',
              borderColor: 'var(--ui-border)',
              color: 'var(--ui-fg)',
            }}
            value={playable.enabled ? 'on' : 'off'}
            onChange={(e) =>
              patchPlayable({
                ...playable,
                enabled: e.target.value === 'on',
              })
            }
          >
            <option value="on">开启（导演可点玩家说戏内一句）</option>
            <option value="off">关闭（正片纯 NPC）</option>
          </select>
        </FieldLabel>

        {playable.enabled ? (
          <>
            <FieldLabel label="玩家位 ID" format={FMT.id}>
              <TextInput
                value={playable.id}
                placeholder="player"
                onChange={(id) =>
                  patchPlayable({
                    ...playable,
                    id: id.trim() || 'player',
                  })
                }
              />
            </FieldLabel>
            <FieldLabel label="出场章节" format={`${FMT.optional}·${FMT.select}`}>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  background: 'var(--ui-input)',
                  borderColor: 'var(--ui-border)',
                  color: 'var(--ui-fg)',
                }}
                value={playable.appear_from_chapter ?? ''}
                onChange={(e) =>
                  patchPlayable({
                    ...playable,
                    appear_from_chapter: e.target.value || undefined,
                  })
                }
              >
                <option value="">开场即可点</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.hud_label || c.display_name || c.id}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <div className="sm:col-span-2">
              <FieldLabel label="出场需 flags" format={FMT.listId}>
                <TextAreaInput
                  value={(playable.appear_require_flags ?? []).join('\n')}
                  placeholder="一行一个 flag id；空=不额外要求"
                  onChange={(raw) =>
                    patchPlayable({
                      ...playable,
                      appear_require_flags: raw
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </FieldLabel>
            </div>
          </>
        ) : null}
      </div>
    </SectionCard>
  );
}
