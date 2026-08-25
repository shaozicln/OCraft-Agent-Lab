/** 场景里玩家 / NPC 的实时位姿（供跟随与交互圈用） */

export type ScenePose = {
  x: number;
  y: number;
  z: number;
  /** 朝向（弧度），与 Player modelYaw 一致 */
  yaw: number;
};

const playerPose: ScenePose = { x: 0, y: 0, z: 4, yaw: Math.PI };
const npcPoses = new Map<string, ScenePose>();

export function setPlayerScenePose(
  x: number,
  y: number,
  z: number,
  yaw: number,
): void {
  playerPose.x = x;
  playerPose.y = y;
  playerPose.z = z;
  playerPose.yaw = yaw;
}

export function getPlayerScenePose(): ScenePose {
  return playerPose;
}

export function setNpcScenePose(
  npcId: string,
  x: number,
  y: number,
  z: number,
  yaw = 0,
): void {
  const cur = npcPoses.get(npcId);
  if (cur) {
    cur.x = x;
    cur.y = y;
    cur.z = z;
    cur.yaw = yaw;
  } else {
    npcPoses.set(npcId, { x, y, z, yaw });
  }
}

export function getNpcScenePose(npcId: string): ScenePose | null {
  return npcPoses.get(npcId) ?? null;
}

export function clearNpcScenePose(npcId: string): void {
  npcPoses.delete(npcId);
}
