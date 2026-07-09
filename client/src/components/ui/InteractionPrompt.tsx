'use client';

interface InteractionPromptProps {
  visible: boolean;
  onInteract: () => void;
}

export function InteractionPrompt({ visible, onInteract }: InteractionPromptProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onInteract}
      className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-5 py-2.5 bg-white/90 border border-gray-200 rounded-full text-gray-700 text-sm hover:bg-white transition-colors shadow-md"
    >
      <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-700">F</kbd>
      <span>与 陈予 对话</span>
    </button>
  );
}
