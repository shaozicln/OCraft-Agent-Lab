'use client';

import type { CSSProperties } from 'react';
import type { StoryPack } from '@ocraft/shared';
import { PackHeaderForm } from './PackHeaderForm';
import { PackWorldForm } from './PackWorldForm';
import { PackTriggersForm } from './PackTriggersForm';
import { PackPromptsForm } from './PackPromptsForm';
import { PackNpcsForm } from './PackNpcsForm';

const TOC = [
  { id: 'pack-sec-header', label: '包头' },
  { id: 'pack-sec-chapters', label: '章节' },
  { id: 'pack-sec-flags', label: 'Flags' },
  { id: 'pack-sec-numeric', label: '数值工具' },
  { id: 'pack-sec-anim', label: '动画规则' },
  { id: 'pack-sec-endings', label: '结局' },
  { id: 'pack-sec-triggers', label: '章节触发' },
  { id: 'pack-sec-reply-flags', label: '回复置 Flag' },
  { id: 'pack-sec-prompts-common', label: 'Prompt 通用' },
  { id: 'pack-sec-affinity', label: '好感区间' },
  { id: 'pack-sec-fatigue', label: '疲惫提示' },
  { id: 'pack-sec-chapter-c', label: '章节约束' },
  { id: 'pack-sec-flag-c', label: 'Flag 约束' },
  { id: 'pack-sec-npcs', label: 'NPC' },
] as const;

export function PackEditor({
  value,
  onChange,
  example,
  panelStyle,
}: {
  value: StoryPack;
  onChange: (next: StoryPack) => void;
  example?: StoryPack | null;
  panelStyle: CSSProperties;
}) {
  const props = { value, onChange, example, panelStyle };
  return (
    <div className="relative flex gap-4">
      <div className="min-w-0 flex-1 space-y-4">
        <PackHeaderForm {...props} />
        <PackWorldForm {...props} />
        <PackTriggersForm {...props} />
        <PackPromptsForm {...props} />
        <PackNpcsForm {...props} />
      </div>
      <nav
        className="sticky top-20 hidden h-fit w-40 shrink-0 rounded-xl border p-3 lg:block"
        style={panelStyle}
      >
        <p
          className="mb-2 text-xs font-medium"
          style={{ color: 'var(--ui-fg-muted)' }}
        >
          目录
        </p>
        <ul className="space-y-1">
          {TOC.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="block rounded px-2 py-1 text-xs hover:underline"
                style={{ color: 'var(--ui-fg)' }}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(item.id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
