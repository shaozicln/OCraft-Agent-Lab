'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { StoryPack } from '@ocraft/shared';

export const ANIMATION_OPTIONS = [
  'idle',
  'sleeping',
  'talk',
  'excited_talk',
] as const;

export interface PackFormProps {
  value: StoryPack;
  onChange: (next: StoryPack) => void;
  example?: StoryPack | null;
  panelStyle: CSSProperties;
}

/** 字段格式提示（写在灰色标签括号里） */
export const FMT = {
  /** packId：^[a-zA-Z0-9_-]+$ */
  id: '仅英文数字_-',
  free: '不限',
  num: '仅数字',
  nonnegInt: '仅非负整数',
  path: '不限·路径',
  xyz: '仅数字·逗号分隔',
  listFree: '一行一个·不限',
  listId: '一行一个·仅英文数字_-',
  setFlags: '每行 name 或 name=value',
  synonyms: '每行 词=同1,同2',
  select: '下拉',
  optional: '可选',
} as const;

export function FieldLabel({
  label,
  format,
  children,
}: {
  label: string;
  /** 灰色括号提示，如「仅英文数字_-」「不限」 */
  format?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span style={{ color: 'var(--ui-fg-muted)' }}>
        {label}
        {format ? `（${format}）` : null}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputStyle: CSSProperties = {
  background: 'var(--ui-input)',
  borderColor: 'var(--ui-border)',
  color: 'var(--ui-fg)',
};

const placeholderClass = 'placeholder:text-[color:var(--ui-fg-muted)]';

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      readOnly={readOnly}
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${placeholderClass}`}
      style={{
        ...inputStyle,
        opacity: readOnly ? 0.7 : 1,
      }}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${placeholderClass}`}
      style={inputStyle}
      value={Number.isFinite(value) ? value : 0}
      placeholder={placeholder}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function TextAreaInput({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${placeholderClass}`}
      style={inputStyle}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  allowEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return (
    <select
      className="w-full rounded-lg border px-3 py-2 text-sm"
      style={inputStyle}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty && <option value="">{placeholder || '（未选）'}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** 一行一个字符串 → string[] */
export function StringListInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      className={`w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none ${placeholderClass}`}
      style={inputStyle}
      rows={Math.min(8, Math.max(2, value.length + 1))}
      value={value.join('\n')}
      placeholder={placeholder}
      onChange={(e) =>
        onChange(
          e.target.value
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
    />
  );
}

export function SectionCard({
  id,
  title,
  hint,
  panelStyle,
  children,
  actions,
}: {
  id?: string;
  title: string;
  hint?: string;
  panelStyle: CSSProperties;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24 rounded-2xl border p-5" style={panelStyle}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {hint && (
            <p className="mt-1 text-sm" style={{ color: 'var(--ui-fg-muted)' }}>
              {hint}
            </p>
          )}
        </div>
        {actions}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

export function RowCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="space-y-3 rounded-xl border p-3"
      style={{ borderColor: 'var(--ui-border)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {onRemove && (
          <button
            type="button"
            className="text-xs"
            style={{ color: 'var(--ui-danger)' }}
            onClick={onRemove}
          >
            删除
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border px-3 py-1.5 text-xs"
      style={{ borderColor: 'var(--ui-border)', color: 'var(--ui-accent)' }}
    >
      {label}
    </button>
  );
}

export function BoolCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
