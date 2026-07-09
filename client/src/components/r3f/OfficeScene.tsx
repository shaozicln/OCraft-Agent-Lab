'use client';

function Desk({ position }: { position: [number, number, number] }) {
  const topY = 0.76;
  const legH = topY - 0.03;
  return (
    <group position={position}>
      <mesh position={[0, topY, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.05, 0.72]} />
        <meshStandardMaterial color="#FAFAFA" />
      </mesh>
      {[
        [-0.62, -0.3],
        [0.62, -0.3],
        [-0.62, 0.3],
        [0.62, 0.3],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, legH / 2, z]} castShadow>
          <boxGeometry args={[0.05, legH, 0.05]} />
          <meshStandardMaterial color="#E5E7EB" />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0, topY + 0.22, -0.18]} castShadow>
        <boxGeometry args={[0.55, 0.34, 0.03]} />
        <meshStandardMaterial color="#1F2937" />
      </mesh>
      <mesh position={[0, topY + 0.02, -0.16]} castShadow>
        <boxGeometry args={[0.08, 0.04, 0.06]} />
        <meshStandardMaterial color="#9CA3AF" />
      </mesh>
    </group>
  );
}

function Chair({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const seatY = 0.46;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, seatY, 0]} castShadow>
        <boxGeometry args={[0.42, 0.05, 0.42]} />
        <meshStandardMaterial color="#D1D5DB" />
      </mesh>
      <mesh position={[0, seatY + 0.28, -0.17]} castShadow>
        <boxGeometry args={[0.42, 0.48, 0.04]} />
        <meshStandardMaterial color="#C4C9D0" />
      </mesh>
      {[
        [-0.15, -0.15],
        [0.15, -0.15],
        [-0.15, 0.15],
        [0.15, 0.15],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, seatY / 2, z]} castShadow>
          <boxGeometry args={[0.04, seatY, 0.04]} />
          <meshStandardMaterial color="#9CA3AF" />
        </mesh>
      ))}
      {/* Armrests */}
      <mesh position={[-0.22, seatY + 0.12, 0]} castShadow>
        <boxGeometry args={[0.04, 0.04, 0.32]} />
        <meshStandardMaterial color="#B0B7C0" />
      </mesh>
      <mesh position={[0.22, seatY + 0.12, 0]} castShadow>
        <boxGeometry args={[0.04, 0.04, 0.32]} />
        <meshStandardMaterial color="#B0B7C0" />
      </mesh>
    </group>
  );
}

export function OfficeScene() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#EFEFEF" />
      </mesh>

      <Desk position={[-2.5, 0, -1.2]} />
      <Desk position={[1.8, 0, 0.5]} />
      <Desk position={[3.2, 0, -2.2]} />

      <Chair position={[-2.5, 0, 0.35]} rotation={Math.PI} />
      <Chair position={[1.8, 0, 1.55]} rotation={Math.PI} />
      <Chair position={[3.2, 0, -0.85]} rotation={Math.PI} />

      {/* Low modern dividers */}
      <mesh position={[-2.5, 0.55, -1.85]} castShadow>
        <boxGeometry args={[1.6, 1.1, 0.04]} />
        <meshStandardMaterial color="#F3F4F6" />
      </mesh>
      <mesh position={[3.2, 0.55, -3.05]} castShadow>
        <boxGeometry args={[1.6, 1.1, 0.04]} />
        <meshStandardMaterial color="#F3F4F6" />
      </mesh>

      {/* Ceiling light panels */}
      <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
}
