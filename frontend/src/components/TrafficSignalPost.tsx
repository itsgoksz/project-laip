import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface TrafficSignalPostProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  isRerouting?: boolean;
  isSimActive?: boolean;
  incident?: any;
  simState?: string;
}

export const TrafficSignalPost: React.FC<TrafficSignalPostProps> = ({
  position = [-25.8, 0, -154.5],
  rotation = [0, -Math.PI / 2, 0],
  isRerouting = false,
  isSimActive = true,
  simState = 'NORMAL',
}) => {
  const [blinkOn, setBlinkOn] = useState(true);
  const lastBlinkRef = useRef(0);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    const cycle = elapsed % 0.7;
    const shouldBlink = isRerouting ? cycle < 0.42 : false;
    if (shouldBlink !== blinkOn && Math.abs(elapsed - lastBlinkRef.current) > 0.1) {
      setBlinkOn(shouldBlink);
      lastBlinkRef.current = elapsed;
    }
  });

  const hasIncident = isSimActive && simState !== 'NORMAL';

  // Curved cantilever arm: post on left, arm sweeps RIGHT over the road
  const armCurve = useMemo(() => {
    const pts = [
      new THREE.Vector3(0,   5.6, 0),
      new THREE.Vector3(0.8, 5.75, 0),
      new THREE.Vector3(1.8, 5.82, 0),
      new THREE.Vector3(2.8, 5.75, 0),
      new THREE.Vector3(3.8, 5.58, 0),
      new THREE.Vector3(4.5, 5.38, 0),
      new THREE.Vector3(5.0, 5.18, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
    return new THREE.TubeGeometry(curve, 40, 0.10, 14, false);
  }, []);

  // Signal lens: use a flattened sphere so it's visible from every camera angle
  const lensGeo = useMemo(() => new THREE.SphereGeometry(0.22, 24, 16), []);

  // Individual signal circle lens rendered with correct colors
  const SignalLens = ({
    yOffset,
    color,
    emissive,
    emissiveIntensity,
  }: {
    yOffset: number;
    color: string;
    emissive: string;
    emissiveIntensity: number;
  }) => (
    <group position={[0, yOffset, 0.12]} frustumCulled={false}>
      {/* Recessed housing cup */}
      <mesh frustumCulled={false}>
        <cylinderGeometry args={[0.24, 0.24, 0.14, 24]} />
        <meshStandardMaterial color="#0a0a0f" roughness={0.5} />
      </mesh>
      {/* Lens (sphere so it's visible from any angle) */}
      <mesh geometry={lensGeo} position={[0, 0, 0.08]} scale={[1, 0.38, 1]} frustumCulled={false}>
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.08}
          metalness={0.1}
        />
      </mesh>
      {/* Sun visor hood */}
      <mesh position={[0, 0.22, 0.16]} rotation={[0.38, 0, 0]} frustumCulled={false}>
        <boxGeometry args={[0.52, 0.04, 0.26]} />
        <meshStandardMaterial color="#060810" roughness={0.6} />
      </mesh>
    </group>
  );

  return (
    <group position={position} rotation={rotation} frustumCulled={false}>

      {/* ══════════════════════════════════════
          1. VERTICAL MAST  (right / roadside)
          ══════════════════════════════════════ */}

      {/* Base flange */}
      <mesh position={[0, 0.08, 0]} frustumCulled={false}>
        <cylinderGeometry args={[0.38, 0.45, 0.16, 16]} />
        <meshStandardMaterial color="#4e5e6e" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Main pole */}
      <mesh position={[0, 3.0, 0]} frustumCulled={false}>
        <cylinderGeometry args={[0.10, 0.13, 5.9, 16]} />
        <meshStandardMaterial color="#5e7080" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Pole cap */}
      <mesh position={[0, 5.97, 0]} frustumCulled={false}>
        <sphereGeometry args={[0.12, 12, 8]} />
        <meshStandardMaterial color="#3e4e5e" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* ══════════════════════════════════════
          2. CURVED CANTILEVER ARM
          ══════════════════════════════════════ */}
      <mesh geometry={armCurve} frustumCulled={false}>
        <meshStandardMaterial color="#5e7080" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* ══════════════════════════════════════════════════════
          3. LCD DISPLAY  –  inline at mid-arm  (X ≈ +2.5)
             Only shows content when incident is triggered
          ══════════════════════════════════════════════════════ */}
      <group position={[2.5, 5.5, 0]} frustumCulled={false}>
        {/* Housing — wide enough for 2-line message */}
        <mesh frustumCulled={false}>
          <boxGeometry args={[2.4, 0.82, 0.18]} />
          <meshStandardMaterial color="#283540" roughness={0.35} metalness={0.7} />
        </mesh>
        {/* Bezel */}
        <mesh position={[0, 0, 0.082]} frustumCulled={false}>
          <boxGeometry args={[2.30, 0.72, 0.02]} />
          <meshStandardMaterial color="#141e28" roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Screen */}
        <mesh position={[0, 0, 0.094]} frustumCulled={false}>
          <boxGeometry args={[2.20, 0.62, 0.01]} />
          <meshStandardMaterial
            color={hasIncident ? '#110d00' : '#050708'}
            roughness={0.3}
            metalness={0.9}
          />
        </mesh>
        {/* HTML overlay — distanceFactor tuned so text stays inside the housing */}
        <Html position={[0, 0, 0.11]} transform distanceFactor={10} center>
          <div className="select-none pointer-events-none w-[200px] h-[70px] flex flex-col items-center justify-center">
            {hasIncident ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                <div className="text-[13px] font-extrabold tracking-[0.15em] text-amber-400 drop-shadow-[0_0_8px_#f59e0b] whitespace-nowrap">
                  ⚠&nbsp; CONGESTION
                </div>
                <div className="text-[13px] font-extrabold tracking-[0.15em] text-amber-300 drop-shadow-[0_0_8px_#f59e0b] whitespace-nowrap">
                  AHEAD
                </div>
              </div>
            ) : (
              /* Dark / off when no incident */
              <div className="w-full h-full" />
            )}
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════
          4. 3-SIGNAL LIGHT BOX  –  right tip of arm  (X ≈ +4.9)
          ══════════════════════════════════════════════════════════ */}
      <group position={[4.9, 4.1, 0]} frustumCulled={false}>

        {/* Drop-rod from arm tip to box top */}
        <mesh position={[0, 0.72, 0]} frustumCulled={false}>
          <cylinderGeometry args={[0.06, 0.06, 0.7, 12]} />
          <meshStandardMaterial color="#5e7080" roughness={0.3} metalness={0.7} />
        </mesh>

        {/* ── Back-plate (silver/grey border visible from all sides) ── */}
        <mesh position={[0, 0, 0]} frustumCulled={false}>
          <boxGeometry args={[0.72, 2.0, 0.34]} />
          <meshStandardMaterial color="#6a7a8a" roughness={0.4} metalness={0.55} />
        </mesh>

        {/* ── Black signal face ── */}
        <mesh position={[0, 0, 0.10]} frustumCulled={false}>
          <boxGeometry args={[0.64, 1.92, 0.18]} />
          <meshStandardMaterial color="#08090c" roughness={0.3} metalness={0.6} />
        </mesh>

        {/* ── RED ── (top) */}
        <SignalLens
          yOffset={0.64}
          color={hasIncident ? '#ef4444' : '#3d0808'}
          emissive={hasIncident ? '#ef4444' : '#150303'}
          emissiveIntensity={hasIncident ? 4.0 : 0.12}
        />

        {/* ── YELLOW ── (middle) */}
        <SignalLens
          yOffset={0}
          color="#78350f"
          emissive="#2e1200"
          emissiveIntensity={0.1}
        />

        {/* ── GREEN ── (bottom)
            - Normal             → solid green
            - Incident, no route → OFF (red is active instead)
            - isRerouting        → blinking left-turn arrow
        */}
        <group position={[0, -0.64, 0.12]} frustumCulled={false}>

          {/* Recessed cup */}
          <mesh frustumCulled={false}>
            <cylinderGeometry args={[0.24, 0.24, 0.14, 24]} />
            <meshStandardMaterial color="#0a0a0f" roughness={0.5} />
          </mesh>

          {/* Green lens */}
          <mesh geometry={lensGeo} position={[0, 0, 0.08]} scale={[1, 0.38, 1]} frustumCulled={false}>
            <meshStandardMaterial
              color={
                !hasIncident ? '#16a34a'
                  : isRerouting ? (blinkOn ? '#16a34a' : '#041408')
                  : '#041408'
              }
              emissive={
                !hasIncident ? '#22c55e'
                  : isRerouting ? (blinkOn ? '#22c55e' : '#020e06')
                  : '#020e06'
              }
              emissiveIntensity={
                !hasIncident ? 3.0
                  : isRerouting ? (blinkOn ? 4.0 : 0.05)
                  : 0.05
              }
              roughness={0.08}
              metalness={0.1}
            />
          </mesh>

          {/* Sun visor */}
          <mesh position={[0, 0.22, 0.16]} rotation={[0.38, 0, 0]} frustumCulled={false}>
            <boxGeometry args={[0.52, 0.04, 0.26]} />
            <meshStandardMaterial color="#060810" roughness={0.6} />
          </mesh>

          {/* ── Left-turn arrow (only when rerouting) ── */}
          {hasIncident && isRerouting && (
            <Html position={[0, 0, 0.12]} transform distanceFactor={10} center>
              <div className="select-none pointer-events-none flex items-center justify-center w-10 h-10">
                <span
                  className="font-black text-2xl leading-none"
                  style={{
                    color: blinkOn ? '#86efac' : '#021a08',
                    textShadow: blinkOn ? '0 0 12px #22c55e, 0 0 20px #16a34a' : 'none',
                    transform: blinkOn ? 'scale(1.15)' : 'scale(0.9)',
                    opacity: blinkOn ? 1 : 0.06,
                    transition: 'all 0.08s ease',
                  }}
                >
                  ←
                </span>
              </div>
            </Html>
          )}
          {isRerouting && blinkOn && (
            <pointLight
              position={[0, -1.5, 0.6]}
              color="#22c55e"
              intensity={5}
              distance={18}
              decay={2}
            />
          )}
        </group>

      </group>

    </group>
  );
};
