'use client';

import './game-overlay.css';

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
    <div className="game-interact">
      {targets.map((t, i) => (
        <button
          key={t.npcId}
          type="button"
          onClick={() => onInteract(t.npcId)}
          className="game-interact__btn"
        >
          <kbd className="oc-kbd">{i === 0 ? 'F' : '点'}</kbd>
          <span>与 {t.name || 'NPC'} 对话</span>
        </button>
      ))}
    </div>
  );
}
