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

  useFrame((state) => {
    if (!groupRef.current || !bodyRef.current) return;
    const t = state.clock.elapsedTime;

    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      rotationY,
      0.15,
    );
    groupRef.current.position.y = position[1];
    bodyRef.current.rotation.z = 0;

    if (animation === 'sleeping') {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        0.62,
        0.06,
      );
      groupRef.current.position.y =
        position[1] + Math.sin(t * 1.2) * 0.015;
    } else if (animation === 'excited_talk') {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        0,
        0.1,
      );
      groupRef.current.position.y =
        position[1] + Math.abs(Math.sin(t * 5)) * 0.04;
      bodyRef.current.rotation.z = Math.sin(t * 7) * 0.04;
    } else if (animation === 'talk') {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        0,
        0.08,
      );
      groupRef.current.position.y =
        position[1] + Math.sin(t * 2.5) * 0.02;
    } else {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        0,
        0.08,
      );
      groupRef.current.position.y = position[1];
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Legs — seat height reference ~0.42m */}
      <mesh position={[-0.1, 0.21, 0]} castShadow>
        <boxGeometry args={[0.14, 0.42, 0.14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.1, 0.21, 0]} castShadow>
        <boxGeometry args={[0.14, 0.42, 0.14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Torso */}
      <mesh ref={bodyRef} position={[0, 0.68, 0]} castShadow>
        <boxGeometry args={[0.38, 0.48, 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <sphereGeometry args={[0.17, 16, 16]} />
        <meshStandardMaterial color={headColor ?? color} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.28, 0.7, 0]} castShadow>
        <boxGeometry args={[0.1, 0.38, 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.28, 0.7, 0]} castShadow>
        <boxGeometry args={[0.1, 0.38, 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
