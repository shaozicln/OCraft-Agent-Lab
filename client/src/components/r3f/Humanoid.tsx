'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type HumanoidAnimation =
  | 'idle'
  | 'sleeping'
  | 'talk'
  | 'excited_talk'
  /** 客户端进/离场用，不进 Pack schema */
  | 'walk';

/** Target standing height ~1.65m */
export const HUMANOID_HEIGHT = 1.65;

interface HumanoidProps {
  color: string;
  headColor?: string;
  position?: [number, number, number];
  animation?: HumanoidAnimation;
  rotationY?: number;
  /** 离场淡出用，默认 1 */
  opacity?: number;
}

export function Humanoid({
  color,
  headColor,
  position = [0, 0, 0],
  animation = 'idle',
  rotationY = 0,
  opacity = 1,
}: HumanoidProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const animationRef = useRef(animation);
  const rotationYRef = useRef(rotationY);
  const baseYRef = useRef(position[1]);
  animationRef.current = animation;
  rotationYRef.current = rotationY;
  baseYRef.current = position[1];

  useFrame((state) => {
    if (!groupRef.current || !bodyRef.current) return;
    const anim = animationRef.current;
    const targetYaw = rotationYRef.current;
    const baseY = baseYRef.current;
    const t = state.clock.elapsedTime;

    const yawDelta = Math.abs(groupRef.current.rotation.y - targetYaw);
    if (yawDelta > 0.001) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetYaw,
        0.15,
      );
    }

    const resetLimbs = () => {
      if (headRef.current) headRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
    };

    if (anim === 'idle') {
      if (Math.abs(groupRef.current.rotation.x) > 0.001) {
        groupRef.current.rotation.x = THREE.MathUtils.lerp(
          groupRef.current.rotation.x,
          0,
          0.08,
        );
      } else {
        groupRef.current.rotation.x = 0;
      }
      groupRef.current.position.y = baseY;
      bodyRef.current.rotation.z = 0;
      resetLimbs();
      return;
    }

    if (anim === 'walk') {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        0,
        0.12,
      );
      const step = Math.sin(t * 10);
      groupRef.current.position.y = baseY + Math.abs(step) * 0.045;
      bodyRef.current.rotation.z = step * 0.06;
      if (headRef.current) headRef.current.rotation.x = step * 0.04;
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = step * 0.55;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -step * 0.55;
      }
      return;
    }

    if (anim === 'sleeping') {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        0.62,
        0.06,
      );
      groupRef.current.position.y = baseY + Math.sin(t * 1.2) * 0.015;
      bodyRef.current.rotation.z = 0;
      resetLimbs();
      return;
    }

    // talk / excited_talk：幅度加大，旁听时一眼能看出谁在开口
    const excited = anim === 'excited_talk';
    const bobAmp = excited ? 0.07 : 0.05;
    const bobHz = excited ? 9 : 7;
    const sway = excited ? 0.1 : 0.07;
    const arm = excited ? 0.55 : 0.4;
    const nod = excited ? 0.22 : 0.16;

    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      0,
      0.12,
    );
    groupRef.current.position.y =
      baseY + Math.abs(Math.sin(t * bobHz)) * bobAmp;
    bodyRef.current.rotation.z = Math.sin(t * (excited ? 8 : 6)) * sway;
    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(t * bobHz * 1.1) * nod;
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = -arm + Math.sin(t * bobHz) * 0.25;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = -arm * 0.7 + Math.cos(t * bobHz) * 0.3;
    }
  });

  const transparent = opacity < 0.999;

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[-0.1, 0.21, 0]} castShadow>
        <boxGeometry args={[0.14, 0.42, 0.14]} />
        <meshLambertMaterial
          color={color}
          transparent={transparent}
          opacity={opacity}
          depthWrite={!transparent}
        />
      </mesh>
      <mesh position={[0.1, 0.21, 0]} castShadow>
        <boxGeometry args={[0.14, 0.42, 0.14]} />
        <meshLambertMaterial
          color={color}
          transparent={transparent}
          opacity={opacity}
          depthWrite={!transparent}
        />
      </mesh>
      <mesh ref={bodyRef} position={[0, 0.68, 0]} castShadow>
        <boxGeometry args={[0.38, 0.48, 0.2]} />
        <meshLambertMaterial
          color={color}
          transparent={transparent}
          opacity={opacity}
          depthWrite={!transparent}
        />
      </mesh>
      <mesh ref={headRef} position={[0, 1.02, 0]} castShadow>
        <sphereGeometry args={[0.17, 10, 10]} />
        <meshLambertMaterial
          color={headColor ?? color}
          transparent={transparent}
          opacity={opacity}
          depthWrite={!transparent}
        />
      </mesh>
      <mesh ref={leftArmRef} position={[-0.28, 0.7, 0]} castShadow>
        <boxGeometry args={[0.1, 0.38, 0.1]} />
        <meshLambertMaterial
          color={color}
          transparent={transparent}
          opacity={opacity}
          depthWrite={!transparent}
        />
      </mesh>
      <mesh ref={rightArmRef} position={[0.28, 0.7, 0]} castShadow>
        <boxGeometry args={[0.1, 0.38, 0.1]} />
        <meshLambertMaterial
          color={color}
          transparent={transparent}
          opacity={opacity}
          depthWrite={!transparent}
        />
      </mesh>
    </group>
  );
}
