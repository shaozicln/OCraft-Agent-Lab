'use client';

import type { ReactNode } from 'react';

type ScreenKind = 'loading' | 'empty' | 'error';

export function ScreenState({
  kind,
  title,
  detail,
  action,
}: {
  kind: ScreenKind;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  const busy = kind === 'loading';
  return (
    <main
      className="oc-screen"
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'loading' ? 'polite' : undefined}
      aria-busy={busy}
    >
      <div className="oc-screen__body">
        <p className="oc-screen__title">{title}</p>
        {detail ? <p className="oc-screen__detail">{detail}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </main>
  );
}
