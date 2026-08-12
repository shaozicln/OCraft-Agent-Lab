'use client';

import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { OfficeScene } from './OfficeScene';
import { Player, type NearbyNpc } from './Player';
import { type HumanoidAnimation } from './Humanoid';
import { NpcActor, type NpcActorPhase } from './NpcActor';

export type SceneNpc = {
  npcId: string;
  name: string;
  spawn: [number, number, number];
  color: string;
  headColor: string;
  animation: HumanoidAnimation;
  modelPath?: string;
};

export type { NearbyNpc };

type StagedNpc = SceneNpc & {
  phase: NpcActorPhase;
  /** 进/离场错开秒数 */
  motionDelay: number;
};

const ENTER_STAGGER = 0.28;
const LEAVE_STAGGER = 0.22;

interface GameCanvasProps {
  npcs: SceneNpc[];
  onPlayerMove: (nearby: NearbyNpc[]) => void;
  movementEnabled: boolean;
  lookEnabled: boolean;
  onPointerLockChange: (locked: boolean) => void;
  uiOverlayActive?: boolean;
  /** 旁听时当前开口的 NPC，头顶显示说话标记 */
  speakingNpcId?: string | null;
  /**
   * 读档 / 新开 / 首次 hydrate：当前在场 NPC 直接站在 spawn，不播进场。
   * 每次需要「瞬现对齐」时递增。
   */
  presenceSnapToken?: number;
}

export const GameCanvas = memo(function GameCanvas({
  npcs,
  onPlayerMove,
  movementEnabled,
  lookEnabled,
  onPointerLockChange,
  uiOverlayActive = false,
  speakingNpcId = null,
  presenceSnapToken = 0,
}: GameCanvasProps) {
  const [staged, setStaged] = useState<StagedNpc[]>([]);
  /** boot：站桩对齐；live：增量进/离场 */
  const modeRef = useRef<'boot' | 'live'>('boot');
  const lastSnapRef = useRef(presenceSnapToken);

  useEffect(() => {
    const snapped = presenceSnapToken !== lastSnapRef.current;
    if (snapped) {
      lastSnapRef.current = presenceSnapToken;
      modeRef.current = 'live';
      setStaged(
        npcs.map((n) => ({ ...n, phase: 'present' as const, motionDelay: 0 })),
      );
      return;
    }

    if (modeRef.current === 'boot') {
      setStaged(
        npcs.map((n) => ({ ...n, phase: 'present' as const, motionDelay: 0 })),
      );
      return;
    }

    setStaged((prev) => {
      const prevById = new Map(prev.map((p) => [p.npcId, p]));
      const nextIds = new Set(npcs.map((n) => n.npcId));
      const next: StagedNpc[] = [];
      let enterIdx = 0;
      let leaveIdx = 0;

      for (const n of npcs) {
        const old = prevById.get(n.npcId);
        if (!old) {
          next.push({
            ...n,
            phase: 'entering',
            motionDelay: enterIdx * ENTER_STAGGER,
          });
          enterIdx += 1;
        } else if (old.phase === 'leaving') {
          // 离场中途又该在场：立刻站回
          next.push({ ...n, phase: 'present', motionDelay: 0 });
        } else if (old.phase === 'entering') {
          next.push({
            ...n,
            phase: 'entering',
            motionDelay: old.motionDelay,
          });
        } else {
          next.push({ ...n, phase: 'present', motionDelay: 0 });
        }
      }

      for (const old of prev) {
        if (nextIds.has(old.npcId)) continue;
        if (old.phase === 'leaving') {
          next.push(old);
        } else {
          next.push({
            ...old,
            phase: 'leaving',
            motionDelay: leaveIdx * LEAVE_STAGGER,
          });
          leaveIdx += 1;
        }
      }

      return next;
    });
  }, [npcs, presenceSnapToken]);

  const handleLeaveDone = useCallback((npcId: string) => {
    setStaged((prev) => prev.filter((p) => p.npcId !== npcId));
  }, []);

  const interactSpawns = useMemo(
    () =>
      staged
        .filter((n) => n.phase !== 'leaving')
        .map((n) => ({ npcId: n.npcId, position: n.spawn })),
    [staged],
  );

  return (
    <div
      className="absolute inset-0"
      style={{ pointerEvents: uiOverlayActive ? 'none' : 'auto' }}
    >
      <Canvas
        shadows={{ type: THREE.BasicShadowMap }}
        dpr={1}
        frameloop="always"
        camera={{ position: [0, 1.6, 6], fov: 60 }}
        className="h-full w-full"
        style={{ background: '#FFFFFF' }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          stencil: false,
          alpha: false,
        }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={['#FFFFFF']} />
        <ambientLight intensity={0.9} />
        <hemisphereLight args={['#FFFFFF', '#EFEFEF', 0.5]} />
        <directionalLight
          castShadow
          position={[6, 10, 4]}
          intensity={0.5}
          shadow-mapSize={[512, 512]}
          shadow-bias={-0.0005}
          shadow-camera-far={24}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <Suspense fallback={null}>
          <OfficeScene />
          {staged.map((n) => (
            <NpcActor
              key={n.npcId}
              npcId={n.npcId}
              name={n.name}
              spawn={n.spawn}
              color={n.color}
              headColor={n.headColor}
              animation={n.animation}
              modelPath={n.modelPath}
              phase={n.phase}
              motionDelay={n.motionDelay}
              speaking={speakingNpcId === n.npcId}
              onLeaveDone={handleLeaveDone}
            />
          ))}
          <Player
            npcSpawns={interactSpawns}
            onMove={onPlayerMove}
            movementEnabled={movementEnabled}
            lookEnabled={lookEnabled}
            onPointerLockChange={onPointerLockChange}
          />
        </Suspense>
      </Canvas>
    </div>
  );
});
