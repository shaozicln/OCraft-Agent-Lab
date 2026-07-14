'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
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
}

export function GameCanvas({
  npcs,
  onPlayerMove,
  movementEnabled,
  lookEnabled,
  onPointerLockChange,
  uiOverlayActive = false,
}: GameCanvasProps) {
  return (
    <div
      className="absolute inset-0"
      style={{ pointerEvents: uiOverlayActive ? 'none' : 'auto' }}
    >
      <Canvas
        shadows
        camera={{ position: [0, 1.6, 6], fov: 60 }}
        className="h-full w-full"
        style={{ background: '#FFFFFF' }}
      >
        <color attach="background" args={['#FFFFFF']} />
        <ambientLight intensity={0.85} />
        <hemisphereLight args={['#FFFFFF', '#EFEFEF', 0.6]} />
        <directionalLight
          castShadow
          position={[6, 10, 4]}
          intensity={0.55}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={30}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />
        <Suspense fallback={null}>
          <OfficeScene />
          {npcs.map((n) => (
            <Humanoid
              key={n.npcId}
              color={n.color}
              headColor={n.headColor}
              position={n.spawn}
              animation={n.animation}
            />
          ))}
          <Player
            npcSpawns={npcs.map((n) => ({
              npcId: n.npcId,
              position: n.spawn,
            }))}
            onMove={onPlayerMove}
            movementEnabled={movementEnabled}
            lookEnabled={lookEnabled}
            onPointerLockChange={onPointerLockChange}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
