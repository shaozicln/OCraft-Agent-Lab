'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { NpcFollowState } from '@ocraft/shared';
import { Humanoid, type HumanoidAnimation } from './Humanoid';
import { SpeechBubbleHtml } from './SpeechBubbleHtml';
import { useSpeechBubble } from '@/lib/useSpeechBubble';
import {
  clearNpcScenePose,
  getNpcScenePose,
  getPlayerScenePose,
  setNpcScenePose,
} from '@/lib/scenePositions';
import { PLAYER_SPEED } from '@/config/game';

/** 进场：从 spawn 外侧走进来 */
const ENTER_OFFSET: [number, number, number] = [0, 0, 3.2];
const ENTER_SECONDS = 1.55;
const LEAVE_SECONDS = 1.25;
/** 说话时朝镜头走近的距离（米） */
const APPROACH_METERS = 0.55;
const APPROACH_LERP = 0.08;
const YAW_LERP = 0.12;
/** 跟随：落在玩家身后的距离 */
const FOLLOW_BEHIND = 1.25;
/** 跟随：到目标点多近算「跟上」 */
const FOLLOW_CATCH_DIST = 0.55;
/** to_npc：离目标 NPC 多近算到达 */
const FOLLOW_ARRIVE_DIST = 2.05;
const FOLLOW_SPEED = PLAYER_SPEED * 0.92;

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
  follow?: NpcFollowState | null;
  onLeaveDone?: (npcId: string) => void;
  onFollowArrive?: (npcId: string, targetNpcId: string) => void;
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

  return (
    <group rotation={[0, rotationY, 0]}>
      {gltfScene ? (
        <GltfBody scene={gltfScene} opacity={opacity} />
      ) : (
        <Humanoid
          color={color}
          headColor={headColor}
          animation={animation}
          opacity={opacity}
        />
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
  follow = null,
  onLeaveDone,
  onFollowArrive,
}: NpcActorProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const bubbleText = useSpeechBubble(npcId);
  const [opacity, setOpacity] = useState(1);
  const [locomotion, setLocomotion] = useState<'idle' | 'walk'>('idle');

  const phaseRef = useRef(phase);
  const engagingRef = useRef(Boolean(speaking));
  const followRef = useRef(follow);
  const delayLeftRef = useRef(motionDelay);
  const progressRef = useRef(0);
  const faceYawRef = useRef(0);
  const leaveNotified = useRef(false);
  const arriveNotified = useRef(false);
  const homeRef = useRef({ x: spawn[0], y: spawn[1], z: spawn[2] });
  const wasFollowingRef = useRef(false);
  const onLeaveDoneRef = useRef(onLeaveDone);
  const onFollowArriveRef = useRef(onFollowArrive);

  phaseRef.current = phase;
  engagingRef.current = Boolean(speaking);
  followRef.current = follow;
  onLeaveDoneRef.current = onLeaveDone;
  onFollowArriveRef.current = onFollowArrive;

  const enterFrom = useMemo(
    (): [number, number, number] => [
      spawn[0] + ENTER_OFFSET[0],
      spawn[1] + ENTER_OFFSET[1],
      spawn[2] + ENTER_OFFSET[2],
    ],
    [spawn],
  );

  useEffect(() => {
    delayLeftRef.current = motionDelay;
    progressRef.current = 0;
    leaveNotified.current = false;
    arriveNotified.current = false;
    homeRef.current = { x: spawn[0], y: spawn[1], z: spawn[2] };
    setOpacity(1);
    if (groupRef.current) {
      if (phase === 'entering') {
        groupRef.current.position.set(...enterFrom);
      } else if (phase === 'present') {
        groupRef.current.position.set(spawn[0], spawn[1], spawn[2]);
      }
    }
  }, [phase, spawn, enterFrom, motionDelay]);

  useEffect(() => {
    arriveNotified.current = false;
  }, [
    follow?.mode,
    follow && 'target_npc_id' in follow ? follow.target_npc_id : null,
  ]);

  useEffect(() => {
    return () => {
      clearNpcScenePose(npcId);
    };
  }, [npcId]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const p = phaseRef.current;
    let walking = false;

    if (delayLeftRef.current > 0) {
      delayLeftRef.current = Math.max(0, delayLeftRef.current - dt);
      if (p === 'entering') {
        g.position.set(...enterFrom);
      } else if (p === 'present') {
        g.position.set(spawn[0], spawn[1], spawn[2]);
      }
      setNpcScenePose(
        npcId,
        g.position.x,
        g.position.y,
        g.position.z,
        faceYawRef.current,
      );
      return;
    }

    if (p === 'present') {
      const followState = followRef.current;
      if (followState) {
        wasFollowingRef.current = true;
        const player = getPlayerScenePose();
        const targetX = player.x - Math.sin(player.yaw) * FOLLOW_BEHIND;
        const targetZ = player.z - Math.cos(player.yaw) * FOLLOW_BEHIND;
        const targetY = spawn[1];

        if (followState.mode === 'to_npc') {
          const dest = getNpcScenePose(followState.target_npc_id);
          if (dest) {
            const distToDest = Math.hypot(
              g.position.x - dest.x,
              g.position.z - dest.z,
            );
            if (distToDest <= FOLLOW_ARRIVE_DIST) {
              if (!arriveNotified.current) {
                arriveNotified.current = true;
                homeRef.current = {
                  x: g.position.x,
                  y: g.position.y,
                  z: g.position.z,
                };
                onFollowArriveRef.current?.(npcId, followState.target_npc_id);
              }
              const wantYaw = yawToward(
                g.position.x,
                g.position.z,
                dest.x,
                dest.z,
              );
              faceYawRef.current = THREE.MathUtils.lerp(
                faceYawRef.current,
                wantYaw,
                YAW_LERP,
              );
              g.rotation.y = faceYawRef.current;
              setNpcScenePose(
                npcId,
                g.position.x,
                g.position.y,
                g.position.z,
                faceYawRef.current,
              );
              setLocomotion((prev) => (prev === 'idle' ? prev : 'idle'));
              return;
            }
          }
        }

        const dx = targetX - g.position.x;
        const dz = targetZ - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > FOLLOW_CATCH_DIST) {
          const step = Math.min(dist, FOLLOW_SPEED * dt);
          g.position.x += (dx / dist) * step;
          g.position.z += (dz / dist) * step;
          walking = true;
          const wantYaw = yawToward(
            g.position.x,
            g.position.z,
            targetX,
            targetZ,
          );
          faceYawRef.current = THREE.MathUtils.lerp(
            faceYawRef.current,
            wantYaw,
            YAW_LERP,
          );
        } else {
          const wantYaw = yawToward(
            g.position.x,
            g.position.z,
            player.x,
            player.z,
          );
          faceYawRef.current = THREE.MathUtils.lerp(
            faceYawRef.current,
            wantYaw,
            YAW_LERP,
          );
        }
        g.position.y = targetY;
        g.rotation.y = faceYawRef.current;
        setNpcScenePose(
          npcId,
          g.position.x,
          g.position.y,
          g.position.z,
          faceYawRef.current,
        );
        setLocomotion((prev) => {
          const next = walking ? 'walk' : 'idle';
          return prev === next ? prev : next;
        });
        return;
      }

      if (wasFollowingRef.current) {
        wasFollowingRef.current = false;
        homeRef.current = {
          x: g.position.x,
          y: g.position.y,
          z: g.position.z,
        };
      }

      const home = homeRef.current;
      const cam = camera.position;
      const dx = cam.x - home.x;
      const dz = cam.z - home.z;
      const len = Math.hypot(dx, dz) || 1;
      const approachX = home.x + (dx / len) * APPROACH_METERS;
      const approachZ = home.z + (dz / len) * APPROACH_METERS;
      const targetX = engagingRef.current ? approachX : home.x;
      const targetZ = engagingRef.current ? approachZ : home.z;
      g.position.x = THREE.MathUtils.lerp(g.position.x, targetX, APPROACH_LERP);
      g.position.y = home.y;
      g.position.z = THREE.MathUtils.lerp(g.position.z, targetZ, APPROACH_LERP);

      const wantYaw = engagingRef.current
        ? yawToward(g.position.x, g.position.z, cam.x, cam.z)
        : faceYawRef.current;
      faceYawRef.current = THREE.MathUtils.lerp(
        faceYawRef.current,
        wantYaw,
        YAW_LERP,
      );
      g.rotation.y = faceYawRef.current;
      setNpcScenePose(
        npcId,
        g.position.x,
        g.position.y,
        g.position.z,
        faceYawRef.current,
      );
      setLocomotion((prev) => (prev === 'idle' ? prev : 'idle'));
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
      setNpcScenePose(
        npcId,
        g.position.x,
        g.position.y,
        g.position.z,
        faceYawRef.current,
      );
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
      setNpcScenePose(
        npcId,
        g.position.x,
        g.position.y,
        g.position.z,
        faceYawRef.current,
      );
      if (t >= 1 && !leaveNotified.current) {
        leaveNotified.current = true;
        onLeaveDoneRef.current?.(npcId);
      }
    }
  });

  const displayAnim: HumanoidAnimation =
    phase === 'entering' || phase === 'leaving' || locomotion === 'walk'
      ? 'walk'
      : speaking
        ? animation === 'excited_talk' || animation === 'talk'
          ? animation
          : 'talk'
        : animation;

  const showSpeakingFallback = speaking && !bubbleText;

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
