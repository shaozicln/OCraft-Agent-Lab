'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Humanoid } from './Humanoid';
import { SpeechBubbleHtml } from './SpeechBubbleHtml';
import { useSpeechBubble } from '@/lib/useSpeechBubble';
import { SPEECH_BUBBLE_PLAYER_ID } from '@/lib/speechBubbles';
import {
  CAMERA_DISTANCE_DEFAULT,
  CAMERA_DISTANCE_MAX,
  CAMERA_DISTANCE_MIN,
  CAMERA_ZOOM_STEP,
  INTERACTION_DISTANCE,
  PLAYER_SPEED,
} from '@/config/game';

export type NearbyNpc = { npcId: string; distance: number };

interface PlayerProps {
  npcSpawns: { npcId: string; position: [number, number, number] }[];
  onMove: (nearby: NearbyNpc[]) => void;
  movementEnabled: boolean;
  lookEnabled: boolean;
  onPointerLockChange: (locked: boolean) => void;
}

/** 单次 mousemove 异常尖峰上限（指针锁定偶发巨量 movement） */
const MOUSE_DELTA_CLAMP = 64;
const LOOK_SENSITIVITY = 0.0022;

function lerpAngle(from: number, to: number, t: number) {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

function nearbySignature(list: NearbyNpc[]) {
  return list.map((n) => n.npcId).join('\0');
}

export function Player({
  npcSpawns,
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
  const lookTarget = useRef(new THREE.Vector3());
  const idealCamera = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());
  const npcScratch = useRef(new THREE.Vector3());
  const lastNearbySig = useRef('');
  const movementEnabledRef = useRef(movementEnabled);
  const lookEnabledRef = useRef(lookEnabled);
  const npcSpawnsRef = useRef(npcSpawns);
  const onMoveRef = useRef(onMove);
  const { camera, gl } = useThree();

  movementEnabledRef.current = movementEnabled;
  lookEnabledRef.current = lookEnabled;
  npcSpawnsRef.current = npcSpawns;
  onMoveRef.current = onMove;

  const bubbleText = useSpeechBubble(SPEECH_BUBBLE_PLAYER_ID);

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

    /** Esc 刚退出锁定后，浏览器会短暂拒绝重锁（SecurityError），需吞掉 Promise 拒绝 */
    let reLockBlockedUntil = 0;

    const onCanvasClick = () => {
      if (!lookEnabledRef.current || document.pointerLockElement === canvas) return;
      if (Date.now() < reLockBlockedUntil) return;
      const req = canvas.requestPointerLock();
      void Promise.resolve(req).catch(() => {
        reLockBlockedUntil = Date.now() + 1200;
      });
    };

    const onLockChange = () => {
      onPointerLockChange(document.pointerLockElement === canvas);
    };

    const onLockError = () => {
      reLockBlockedUntil = Date.now() + 1200;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const mx = THREE.MathUtils.clamp(e.movementX, -MOUSE_DELTA_CLAMP, MOUSE_DELTA_CLAMP);
      const my = THREE.MathUtils.clamp(e.movementY, -MOUSE_DELTA_CLAMP, MOUSE_DELTA_CLAMP);
      yaw.current -= mx * LOOK_SENSITIVITY;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current + my * LOOK_SENSITIVITY,
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
    document.addEventListener('pointerlockerror', onLockError);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('click', onCanvasClick);
      canvas.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
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
      forward.current.set(Math.sin(yaw.current), 0, Math.cos(yaw.current));
      right.current.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current));

      move.current.set(0, 0, 0);
      if (keys.current['KeyW'] || keys.current['ArrowUp']) move.current.add(forward.current);
      if (keys.current['KeyS'] || keys.current['ArrowDown']) move.current.sub(forward.current);
      if (keys.current['KeyA'] || keys.current['ArrowLeft']) move.current.add(right.current);
      if (keys.current['KeyD'] || keys.current['ArrowRight']) move.current.sub(right.current);

      if (move.current.lengthSq() > 0.0001) {
        move.current.normalize().multiplyScalar(PLAYER_SPEED * delta);
        groupRef.current.position.add(move.current);
        const targetFacing = Math.atan2(move.current.x, move.current.z);
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
    // 轨道相机：yaw/pitch 变化时位置必须瞬时跟上，否则 lookAt 会与滞后位置打架产生「一跳一跳」
    idealCamera.current.set(
      px - Math.sin(yaw.current) * horizontal,
      py + 1.0 + dist * Math.sin(pitch.current),
      pz - Math.cos(yaw.current) * horizontal,
    );
    camera.position.copy(idealCamera.current);
    camera.lookAt(lookTarget.current);

    const playerPos = groupRef.current.position;
    const nearby: NearbyNpc[] = [];
    for (const n of npcSpawnsRef.current) {
      const d = playerPos.distanceTo(
        npcScratch.current.set(n.position[0], n.position[1], n.position[2]),
      );
      if (d < INTERACTION_DISTANCE) {
        nearby.push({ npcId: n.npcId, distance: d });
      }
    }
    nearby.sort((a, b) => a.distance - b.distance);

    // 仅在附近 NPC 集合变化时通知 React，避免走路时每帧 setState 卡顿
    const sig = nearbySignature(nearby);
    if (sig !== lastNearbySig.current) {
      lastNearbySig.current = sig;
      onMoveRef.current(nearby);
    }
  }, -1);

  return (
    <group ref={groupRef} position={[0, 0, 4]}>
      <group ref={modelRef}>
        <Humanoid color="#E5E7EB" headColor="#F9FAFB" animation="idle" />
      </group>
      <SpeechBubbleHtml text={bubbleText} />
    </group>
  );
}
