'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type HumanoidAnimation = 'idle' | 'sleeping' | 'talk' | 'excited_talk';

/** Target standing height ~1.65m */
export const HUMANOID_HEIGHT = 1.65;

interface HumanoidProps {
  color: string;
  headColor?: string;
  position?: [number, number, number];
  animation?: HumanoidAnimation;
  rotationY?: number;
}

export function Humanoid({
  color,
  headColor,
  position = [0, 0, 0],
  animation = 'idle',
  rotationY = 0,
}: HumanoidProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
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

    if (anim === 'idle') {
      // idle：无位移/晃动时跳过写入，减 CPU
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
      return;
    }

    if (anim === 'excited_talk') {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        0,
        0.1,
      );
      groupRef.current.position.y = baseY + Math.abs(Math.sin(t * 5)) * 0.04;
      bodyRef.current.rotation.z = Math.sin(t * 7) * 0.04;
      return;
    }

    // talk
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      0,
      0.08,
    );
    groupRef.current.position.y = baseY + Math.sin(t * 2.5) * 0.02;
    bodyRef.current.rotation.z = 0;
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[-0.1, 0.21, 0]} castShadow>
        <boxGeometry args={[0.14, 0.42, 0.14]} />
        <meshLambertMaterial color={color} />
      </mesh>
      <mesh position={[0.1, 0.21, 0]} castShadow>
        <boxGeometry args={[0.14, 0.42, 0.14]} />
        <meshLambertMaterial color={color} />
      </mesh>
      <mesh ref={bodyRef} position={[0, 0.68, 0]} castShadow>
        <boxGeometry args={[0.38, 0.48, 0.2]} />
        <meshLambertMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <sphereGeometry args={[0.17, 10, 10]} />
        <meshLambertMaterial color={headColor ?? color} />
      </mesh>
      <mesh position={[-0.28, 0.7, 0]} castShadow>
        <boxGeometry args={[0.1, 0.38, 0.1]} />
        <meshLambertMaterial color={color} />
      </mesh>
      <mesh position={[0.28, 0.7, 0]} castShadow>
        <boxGeometry args={[0.1, 0.38, 0.1]} />
        <meshLambertMaterial color={color} />
      </mesh>
    </group>
  );
}
