'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OfficeScene } from './OfficeScene';
import { Player } from './Player';
import { Humanoid, HumanoidAnimation } from './Humanoid';
import type { NpcPublicResponse } from '@ocraft/shared';
import * as THREE from 'three';

interface GameCanvasProps {
  npc: NpcPublicResponse;
  npcAnimation: HumanoidAnimation;
  onPlayerMove: (pos: THREE.Vector3, distanceToNpc: number) => void;
  movementEnabled: boolean;
  lookEnabled: boolean;
  onPointerLockChange: (locked: boolean) => void;
  uiOverlayActive?: boolean;
}

export function GameCanvas({
  npc,
  npcAnimation,
  onPlayerMove,
  movementEnabled,
  lookEnabled,
  onPointerLockChange,
  uiOverlayActive = false,
}: GameCanvasProps) {
  const spawn = npc.meta.spawn_position;

  return (
    <div
      className="absolute inset-0"
      style={{ pointerEvents: uiOverlayActive ? 'none' : 'auto' }}
    >
      <Canvas
        shadows
        camera={{ position: [0, 1.6, 6], fov: 60 }}
        className="w-full h-full"
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
          <Humanoid
            color="#93C5FD"
            headColor="#BFDBFE"
            position={spawn}
            animation={npcAnimation}
          />
          <Player
            npcSpawn={spawn}
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
