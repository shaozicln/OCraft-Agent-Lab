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
  { id: 'pack-sec-endings', label: '结局' },
  { id: 'pack-sec-numeric', label: '数值工具' },
  { id: 'pack-sec-anim', label: '动画规则' },
  { id: 'pack-sec-npcs', label: 'NPC' },
  { id: 'pack-sec-triggers', label: '章节触发' },
  { id: 'pack-sec-reply-flags', label: '回复置 Flag' },
  { id: 'pack-sec-prompts-common', label: 'Prompt 通用' },
  { id: 'pack-sec-affinity', label: '好感区间（affinity）' },
  { id: 'pack-sec-fatigue', label: '疲惫提示（fatigue）' },
  { id: 'pack-sec-chapter-c', label: '章节约束' },
  { id: 'pack-sec-flag-c', label: 'Flag 约束' },
] as const;

export function PackEditor({
  value,
  onChange,
  example,
  panelStyle,
  highlightTocId,
  distillToken,
  onDistillMessage,
}: {
  value: StoryPack;
  onChange: (next: StoryPack) => void;
  example?: StoryPack | null;
  panelStyle: CSSProperties;
  /** 生成进度：目录项 id 高亮 */
  highlightTocId?: string | null;
  distillToken?: string | null;
  onDistillMessage?: (msg: string) => void;
}) {
  const props = { value, onChange, example, panelStyle };
  return (
    <div className="relative flex gap-4">
      <div className="min-w-0 flex-1 space-y-4">
        <PackHeaderForm {...props} />
        <PackWorldForm {...props} />
        <PackNpcsForm
          {...props}
          distillToken={distillToken}
          onDistillMessage={onDistillMessage}
        />
        <PackTriggersForm {...props} />
        <PackPromptsForm {...props} />
      </div>
      <nav
        className="settings-pack-toc settings-panel sticky top-28 hidden h-fit w-40 shrink-0 lg:block"
        style={panelStyle}
      >
        <p className="settings-sidebar-label">目录</p>
        <ul className="settings-sidebar-nav">
          {TOC.map((item) => {
            const active = highlightTocId === item.id;
            return (
              <li key={item.id} className="contents">
                <a
                  href={`#${item.id}`}
                  className="settings-nav-btn"
                  data-active={active ? 'true' : 'false'}
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
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
