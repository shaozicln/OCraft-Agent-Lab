'use client';

import { Suspense, memo, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { OfficeScene } from './OfficeScene';
import { Player, type NearbyNpc } from './Player';
import { Humanoid, type HumanoidAnimation } from './Humanoid';

export type SceneNpc = {
  npcId: string;
  name: string;
  spawn: [number, number, number];
  color: string;
  headColor: string;
  animation: HumanoidAnimation;
};

export type { NearbyNpc };

interface GameCanvasProps {
  npcs: SceneNpc[];
  onPlayerMove: (nearby: NearbyNpc[]) => void;
  movementEnabled: boolean;
  lookEnabled: boolean;
  onPointerLockChange: (locked: boolean) => void;
  uiOverlayActive?: boolean;
  /** 旁听时当前开口的 NPC，头顶显示说话标记 */
  speakingNpcId?: string | null;
}

export const GameCanvas = memo(function GameCanvas({
  npcs,
  onPlayerMove,
  movementEnabled,
  lookEnabled,
  onPointerLockChange,
  uiOverlayActive = false,
  speakingNpcId = null,
}: GameCanvasProps) {
  const npcSpawns = useMemo(
    () => npcs.map((n) => ({ npcId: n.npcId, position: n.spawn })),
    [npcs],
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
          {npcs.map((n) => (
            <group key={n.npcId} position={n.spawn}>
              <Humanoid
                color={n.color}
                headColor={n.headColor}
                position={[0, 0, 0]}
                animation={n.animation}
              />
              {speakingNpcId === n.npcId && (
                <Html
                  position={[0, 1.55, 0]}
                  center
                  distanceFactor={8}
                  style={{ pointerEvents: 'none' }}
                >
                  <div className="rounded-full bg-violet-600/90 px-2 py-0.5 text-xs font-medium text-white shadow-md whitespace-nowrap">
                    {n.name} · 说话中
                  </div>
                </Html>
              )}
            </group>
          ))}
          <Player
            npcSpawns={npcSpawns}
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
