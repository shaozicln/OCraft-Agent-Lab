'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Humanoid, type HumanoidAnimation } from './Humanoid';
import { SpeechBubbleHtml } from './SpeechBubbleHtml';
import { useSpeechBubble } from '@/lib/useSpeechBubble';

/** 进场：从 spawn 外侧走进来 */
const ENTER_OFFSET: [number, number, number] = [0, 0, 3.2];
const ENTER_SECONDS = 1.55;
const LEAVE_SECONDS = 1.25;
/** 说话时朝镜头走近的距离（米） */
const APPROACH_METERS = 0.55;
const APPROACH_LERP = 0.08;
const YAW_LERP = 0.12;

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
  /** 换场错开：进/离场开始前等待秒数 */
  motionDelay?: number;
  onLeaveDone?: (npcId: string) => void;
};

function publicModelUrl(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, '');
  return `/${trimmed}`;
}

function yawToward(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): number {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
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
  motionDelay = 0,
  onLeaveDone,
}: NpcActorProps) {
  const groupRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(phase);
  const progressRef = useRef(0);
  const delayLeftRef = useRef(0);
  const leaveNotified = useRef(false);
  const faceYawRef = useRef(0);
  const [opacity, setOpacity] = useState(1);
  const onLeaveDoneRef = useRef(onLeaveDone);
  onLeaveDoneRef.current = onLeaveDone;
  phaseRef.current = phase;

  const { camera } = useThree();
  const bubbleText = useSpeechBubble(npcId);
  const engaging = (speaking || Boolean(bubbleText)) && phase === 'present';
  const engagingRef = useRef(engaging);
  engagingRef.current = engaging;
  const showSpeakingFallback = speaking && !bubbleText && phase !== 'leaving';

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
    delayLeftRef.current = Math.max(0, motionDelay);
    if (phase === 'present') {
      setOpacity(1);
      faceYawRef.current = 0;
      if (groupRef.current) {
        groupRef.current.position.set(spawn[0], spawn[1], spawn[2]);
        groupRef.current.rotation.y = 0;
      }
    } else if (phase === 'entering') {
      setOpacity(1);
      faceYawRef.current = yawToward(
        enterFrom[0],
        enterFrom[2],
        spawn[0],
        spawn[2],
      );
      if (groupRef.current) {
        groupRef.current.position.set(...enterFrom);
        groupRef.current.rotation.y = faceYawRef.current;
      }
    } else if (phase === 'leaving') {
      setOpacity(1);
      faceYawRef.current = yawToward(
        spawn[0],
        spawn[2],
        enterFrom[0],
        enterFrom[2],
      );
      if (groupRef.current) {
        groupRef.current.rotation.y = faceYawRef.current;
      }
    }
  }, [phase, spawn, enterFrom, motionDelay]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const p = phaseRef.current;

    if (delayLeftRef.current > 0) {
      delayLeftRef.current = Math.max(0, delayLeftRef.current - dt);
      if (p === 'entering') {
        g.position.set(...enterFrom);
      } else if (p === 'present') {
        g.position.set(spawn[0], spawn[1], spawn[2]);
      }
      return;
    }

    if (p === 'present') {
      const cam = camera.position;
      const dx = cam.x - spawn[0];
      const dz = cam.z - spawn[2];
      const len = Math.hypot(dx, dz) || 1;
      const approachX = spawn[0] + (dx / len) * APPROACH_METERS;
      const approachZ = spawn[2] + (dz / len) * APPROACH_METERS;
      const targetX = engagingRef.current ? approachX : spawn[0];
      const targetZ = engagingRef.current ? approachZ : spawn[2];
      g.position.x = THREE.MathUtils.lerp(g.position.x, targetX, APPROACH_LERP);
      g.position.y = spawn[1];
      g.position.z = THREE.MathUtils.lerp(g.position.z, targetZ, APPROACH_LERP);

      const wantYaw = engagingRef.current
        ? yawToward(g.position.x, g.position.z, cam.x, cam.z)
        : 0;
      faceYawRef.current = THREE.MathUtils.lerp(
        faceYawRef.current,
        wantYaw,
        YAW_LERP,
      );
      g.rotation.y = faceYawRef.current;
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
      const wantYaw = yawToward(
        g.position.x,
        g.position.z,
        spawn[0],
        spawn[2],
      );
      faceYawRef.current = THREE.MathUtils.lerp(
        faceYawRef.current,
        wantYaw,
        YAW_LERP,
      );
      g.rotation.y = faceYawRef.current;
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
      const wantYaw = yawToward(
        g.position.x,
        g.position.z,
        enterFrom[0],
        enterFrom[2],
      );
      faceYawRef.current = THREE.MathUtils.lerp(
        faceYawRef.current,
        wantYaw,
        YAW_LERP,
      );
      g.rotation.y = faceYawRef.current;
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

  const displayAnim: HumanoidAnimation =
    phase === 'entering' || phase === 'leaving'
      ? 'walk'
      : engaging
        ? animation === 'excited_talk' || animation === 'talk'
          ? animation
          : 'talk'
        : animation;

  return (
    <group ref={groupRef} position={spawn}>
      <NpcVisual
        color={color}
        headColor={headColor}
        animation={displayAnim}
        modelPath={modelPath}
        opacity={opacity}
        rotationY={0}
      />
      <SpeechBubbleHtml
        text={phase === 'leaving' ? null : bubbleText}
      />
      {showSpeakingFallback && (
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
