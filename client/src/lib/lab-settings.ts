/** 实验室开关（仅本机；默关）。运行时接线后由 gateway/导演读取。 */

export const LAB_PEER_AGENTS_KEY = 'ocraft.lab.peer_agents';

export function getLabPeerAgentsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LAB_PEER_AGENTS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setLabPeerAgentsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(LAB_PEER_AGENTS_KEY, 'true');
    } else {
      window.localStorage.removeItem(LAB_PEER_AGENTS_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}
