'use client';

export type InteractTarget = {
  npcId: string;
  name: string;
};

interface InteractionPromptProps {
  visible: boolean;
  targets: InteractTarget[];
  onInteract: (npcId: string) => void;
}

export function InteractionPrompt({
  visible,
  targets,
  onInteract,
}: InteractionPromptProps) {
  if (!visible || targets.length === 0) return null;

  return (
    <div className="absolute bottom-32 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      {targets.map((t, i) => (
        <button
          key={t.npcId}
          type="button"
          onClick={() => onInteract(t.npcId)}
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-5 py-2.5 text-sm text-gray-700 shadow-md transition-colors hover:bg-white"
        >
          <kbd className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
            {i === 0 ? 'F' : '点击'}
          </kbd>
          <span>与 {t.name || 'NPC'} 对话</span>
        </button>
      ))}
    </div>
  );
}
