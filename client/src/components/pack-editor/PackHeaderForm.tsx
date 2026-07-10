'use client';

import type { PackFormProps } from './fields';
import {
  FMT,
  FieldLabel,
  SectionCard,
  TextAreaInput,
  TextInput,
} from './fields';

export function PackHeaderForm({
  value,
  onChange,
  example,
  panelStyle,
}: PackFormProps) {
  const h = value.header;
  const ex = example?.header;

  return (
    <SectionCard
      id="pack-sec-header"
      title="包头"
      hint="世界 / 版本请在别处修改"
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
      </div>
    </SectionCard>
  );
}
