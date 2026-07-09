'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Humanoid } from './Humanoid';
import {
  CAMERA_DISTANCE_DEFAULT,
  CAMERA_DISTANCE_MAX,
  CAMERA_DISTANCE_MIN,
  CAMERA_ZOOM_STEP,
  PLAYER_SPEED,
} from '@/config/game';

interface PlayerProps {
  npcSpawn: [number, number, number];
  onMove: (pos: THREE.Vector3, distanceToNpc: number) => void;
  movementEnabled: boolean;
  lookEnabled: boolean;
  onPointerLockChange: (locked: boolean) => void;
}

function lerpAngle(from: number, to: number, t: number) {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

export function Player({
  npcSpawn,
  onMove,
  movementEnabled,
  lookEnabled,
  onPointerLockChange,
}: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const keys = useRef<Record<string, boolean>>({});
  const yaw = useRef(Math.PI);
  const pitch = useRef(0.22);
  const modelYaw = useRef(Math.PI);
  const cameraDistance = useRef(CAMERA_DISTANCE_DEFAULT);
  const cameraPos = useRef(new THREE.Vector3(0, 2, 8));
  const lookTarget = useRef(new THREE.Vector3());
  const idealCamera = useRef(new THREE.Vector3());
  const movementEnabledRef = useRef(movementEnabled);
  const lookEnabledRef = useRef(lookEnabled);
  const { camera, gl } = useThree();

  movementEnabledRef.current = movementEnabled;
  lookEnabledRef.current = lookEnabled;

  useEffect(() => {
    const canvas = gl.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        e.preventDefault();
        document.exitPointerLock();
        return;
      }

      if (
        !movementEnabledRef.current &&
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          e.code,
        )
      ) {
        return;
      }
      keys.current[e.code] = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    const onCanvasClick = () => {
      if (!lookEnabledRef.current || document.pointerLockElement === canvas) return;
      canvas.requestPointerLock();
    };

    const onLockChange = () => {
      onPointerLockChange(document.pointerLockElement === canvas);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      yaw.current -= e.movementX * 0.0022;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current + e.movementY * 0.0022,
        -0.3,
        0.45,
      );
    };

    const onWheel = (e: WheelEvent) => {
      if (!lookEnabledRef.current) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? CAMERA_ZOOM_STEP : -CAMERA_ZOOM_STEP;
      cameraDistance.current = THREE.MathUtils.clamp(
        cameraDistance.current + delta,
        CAMERA_DISTANCE_MIN,
        CAMERA_DISTANCE_MAX,
      );
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('click', onCanvasClick);
      canvas.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [gl.domElement, onPointerLockChange]);

  useEffect(() => {
    if (!lookEnabled && document.pointerLockElement === gl.domElement) {
      document.exitPointerLock();
    }
    if (!movementEnabled) {
      keys.current = {};
    }
  }, [lookEnabled, movementEnabled, gl.domElement]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (movementEnabled) {
      const forward = new THREE.Vector3(
        Math.sin(yaw.current),
        0,
        Math.cos(yaw.current),
      );
      const right = new THREE.Vector3(
        Math.cos(yaw.current),
        0,
        -Math.sin(yaw.current),
      );

      const move = new THREE.Vector3();
      if (keys.current['KeyW'] || keys.current['ArrowUp']) move.add(forward);
      if (keys.current['KeyS'] || keys.current['ArrowDown']) move.sub(forward);
      if (keys.current['KeyA'] || keys.current['ArrowLeft']) move.add(right);
      if (keys.current['KeyD'] || keys.current['ArrowRight']) move.sub(right);

      if (move.lengthSq() > 0.0001) {
        move.normalize().multiplyScalar(PLAYER_SPEED * delta);
        groupRef.current.position.add(move);
        const targetFacing = Math.atan2(move.x, move.z);
        modelYaw.current = lerpAngle(modelYaw.current, targetFacing, 0.18);
      }
    }

    if (modelRef.current) {
      modelRef.current.rotation.y = modelYaw.current;
    }

    const px = groupRef.current.position.x;
    const py = groupRef.current.position.y;
    const pz = groupRef.current.position.z;

    lookTarget.current.set(px, py + 1.0, pz);

    const dist = cameraDistance.current;
    const horizontal = dist * Math.cos(pitch.current);
    idealCamera.current.set(
      px - Math.sin(yaw.current) * horizontal,
      py + 1.0 + dist * Math.sin(pitch.current),
      pz - Math.cos(yaw.current) * horizontal,
    );

    const smooth = 1 - Math.exp(-14 * delta);
    cameraPos.current.lerp(idealCamera.current, smooth);
    camera.position.copy(cameraPos.current);
    camera.lookAt(lookTarget.current);

    const npcPos = new THREE.Vector3(...npcSpawn);
    onMove(groupRef.current.position.clone(), groupRef.current.position.distanceTo(npcPos));
  });

  return (
    <group ref={groupRef} position={[0, 0, 4]}>
      <group ref={modelRef}>
        <Humanoid color="#E5E7EB" headColor="#F9FAFB" animation="idle" />
      </group>
    </group>
  );
}
