'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid, type HumanoidAnimation } from './Humanoid';

/** 进场：从 spawn 外侧固定偏移走进来（Q4=A） */
const ENTER_OFFSET: [number, number, number] = [0, 0, 3.2];
const ENTER_SECONDS = 1.35;
const LEAVE_SECONDS = 1.15;

export type NpcActorPhase = 'entering' | 'present' | 'leaving';

export type NpcActorProps = {
  npcId: string;
  name: string;
  spawn: [number, number, number];
  color: string;
  headColor: string;
  animation: HumanoidAnimation;
  modelPath?: string;
  phase: NpcActorPhase;
  speaking?: boolean;
  onLeaveDone?: (npcId: string) => void;
};

function publicModelUrl(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, '');
  return `/${trimmed}`;
}

function GltfBody({
  scene,
  opacity,
}: {
  scene: THREE.Object3D;
  opacity: number;
}) {
  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;
        const m = mat as THREE.MeshStandardMaterial;
        m.transparent = opacity < 0.999;
        m.opacity = opacity;
        m.depthWrite = opacity >= 0.999;
        m.needsUpdate = true;
      }
    });
  }, [scene, opacity]);

  return <primitive object={scene} />;
}

function NpcVisual({
  color,
  headColor,
  animation,
  modelPath,
  opacity,
  rotationY,
}: {
  color: string;
  headColor: string;
  animation: HumanoidAnimation;
  modelPath?: string;
  opacity: number;
  rotationY: number;
}) {
  const [gltfScene, setGltfScene] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    if (!modelPath) {
      setGltfScene(null);
      return;
    }

    let cancelled = false;
    const url = publicModelUrl(modelPath);
    setGltfScene(null);

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (!cancelled) setGltfScene(gltf.scene.clone(true));
      },
      undefined,
      () => {
        // 404 / 解析失败：静默回退 Humanoid，不抛到 Next runtime
        if (!cancelled) setGltfScene(null);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [modelPath]);

  const fallback = (
    <Humanoid
      color={color}
      headColor={headColor}
      animation={animation}
      opacity={opacity}
      rotationY={0}
    />
  );

  return (
    <group rotation={[0, rotationY, 0]}>
      {gltfScene ? (
        <GltfBody scene={gltfScene} opacity={opacity} />
      ) : (
        fallback
      )}
    </group>
  );
}

export function NpcActor({
  npcId,
  name,
  spawn,
  color,
  headColor,
  animation,
  modelPath,
  phase,
  speaking = false,
  onLeaveDone,
}: NpcActorProps) {
  const groupRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(phase);
  const progressRef = useRef(0);
  const leaveNotified = useRef(false);
  const [opacity, setOpacity] = useState(1);
  const onLeaveDoneRef = useRef(onLeaveDone);
  onLeaveDoneRef.current = onLeaveDone;
  phaseRef.current = phase;

  const enterFrom = useMemo(
    (): [number, number, number] => [
      spawn[0] + ENTER_OFFSET[0],
      spawn[1] + ENTER_OFFSET[1],
      spawn[2] + ENTER_OFFSET[2],
    ],
    [spawn],
  );

  useEffect(() => {
    progressRef.current = 0;
    leaveNotified.current = false;
    if (phase === 'present') {
      setOpacity(1);
      if (groupRef.current) {
        groupRef.current.position.set(spawn[0], spawn[1], spawn[2]);
      }
    } else if (phase === 'entering') {
      setOpacity(1);
      if (groupRef.current) {
        groupRef.current.position.set(...enterFrom);
      }
    } else if (phase === 'leaving') {
      setOpacity(1);
    }
  }, [phase, spawn, enterFrom]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const p = phaseRef.current;

    if (p === 'present') {
      g.position.set(spawn[0], spawn[1], spawn[2]);
      return;
    }

    if (p === 'entering') {
      progressRef.current = Math.min(1, progressRef.current + dt / ENTER_SECONDS);
      const t = progressRef.current;
      const ease = 1 - (1 - t) * (1 - t);
      g.position.set(
        THREE.MathUtils.lerp(enterFrom[0], spawn[0], ease),
        THREE.MathUtils.lerp(enterFrom[1], spawn[1], ease),
        THREE.MathUtils.lerp(enterFrom[2], spawn[2], ease),
      );
      g.position.y += Math.abs(Math.sin(t * Math.PI * 4)) * 0.03;
      return;
    }

    if (p === 'leaving') {
      progressRef.current = Math.min(1, progressRef.current + dt / LEAVE_SECONDS);
      const t = progressRef.current;
      const ease = t * t;
      g.position.set(
        THREE.MathUtils.lerp(spawn[0], enterFrom[0], ease),
        THREE.MathUtils.lerp(spawn[1], enterFrom[1], ease),
        THREE.MathUtils.lerp(spawn[2], enterFrom[2], ease),
      );
      g.position.y += Math.abs(Math.sin(t * Math.PI * 4)) * 0.03;
      const nextOpacity = 1 - ease;
      setOpacity((prev) =>
        Math.abs(prev - nextOpacity) > 0.03 ? nextOpacity : prev,
      );
      if (t >= 1 && !leaveNotified.current) {
        leaveNotified.current = true;
        onLeaveDoneRef.current?.(npcId);
      }
    }
  });

  const faceYaw =
    phase === 'entering'
      ? Math.atan2(-(spawn[0] - enterFrom[0]), -(spawn[2] - enterFrom[2]))
      : phase === 'leaving'
        ? Math.atan2(-(enterFrom[0] - spawn[0]), -(enterFrom[2] - spawn[2]))
        : 0;

  const displayAnim: HumanoidAnimation =
    phase === 'entering' || phase === 'leaving' ? 'idle' : animation;

  return (
    <group ref={groupRef} position={spawn}>
      <NpcVisual
        color={color}
        headColor={headColor}
        animation={displayAnim}
        modelPath={modelPath}
        opacity={opacity}
        rotationY={faceYaw}
      />
      {speaking && phase !== 'leaving' && (
        <Html
          position={[0, 1.55, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
          <div className="rounded-full bg-violet-600/90 px-2 py-0.5 text-xs font-medium text-white shadow-md whitespace-nowrap">
            {name} · 说话中
          </div>
        </Html>
      )}
    </group>
  );
}
