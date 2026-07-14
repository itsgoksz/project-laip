import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Box, Cylinder, Text, Plane, Sky } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

const Tree = ({ position, scale = 1 }: { position: [number, number, number], scale?: number }) => (
  <group position={position} scale={scale}>
    {/* Trunk */}
    <Cylinder args={[0.2, 0.4, 2]} position={[0, 1, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#2d2013" roughness={1} />
    </Cylinder>
    {/* Leaves */}
    <mesh position={[0, 3, 0]} castShadow receiveShadow>
      <icosahedronGeometry args={[1.5, 1]} />
      <meshStandardMaterial color="#1a3b22" roughness={0.9} />
    </mesh>
    <mesh position={[0.8, 2.5, 0.5]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#16331c" roughness={0.9} />
    </mesh>
    <mesh position={[-0.8, 2.8, -0.5]} castShadow receiveShadow>
      <icosahedronGeometry args={[1.2, 1]} />
      <meshStandardMaterial color="#1f4528" roughness={0.9} />
    </mesh>
  </group>
);

const Scenery = () => {
  // Generate deterministic tree positions
  const trees = useMemo(() => {
    const arr = [];
    // Background forest
    for(let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 80;
      const z = -15 - Math.random() * 30;
      const scale = 1 + Math.random() * 1.5;
      arr.push({ x, z, scale });
    }
    // Trees on the sides
    for(let i = 0; i < 15; i++) {
      const x = 20 + Math.random() * 20;
      const z = 10 - Math.random() * 30;
      const scale = 1 + Math.random() * 1.5;
      arr.push({ x, z, scale });
    }
    for(let i = 0; i < 15; i++) {
      const x = -20 - Math.random() * 20;
      const z = 10 - Math.random() * 30;
      const scale = 1 + Math.random() * 1.5;
      arr.push({ x, z, scale });
    }
    return arr;
  }, []);

  return (
    <group>
      {/* Surrounding Grass/Dirt Ground */}
      <Plane args={[200, 200]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#0a120b" roughness={1} />
      </Plane>
      {trees.map((t, i) => <Tree key={i} position={[t.x, 0, t.z]} scale={t.scale} />)}
    </group>
  );
};

const LobbyHVAC = () => (
  <group position={[-1.5, 4.9, 0]}>
    {/* Main Rooftop Unit Body */}
    <Box args={[3, 1.2, 2.5]} position={[0, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#8a8d91" roughness={0.6} metalness={0.4} />
    </Box>
    {/* Exhaust Fans on top */}
    <Cylinder args={[0.4, 0.4, 0.1]} position={[-0.8, 0.6, 0]} castShadow>
      <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
    </Cylinder>
    <Cylinder args={[0.4, 0.4, 0.1]} position={[0.8, 0.6, 0]} castShadow>
      <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
    </Cylinder>
    {/* Side Vents */}
    <Box args={[2.8, 0.8, 0.1]} position={[0, 0, 1.26]}>
      <meshStandardMaterial color="#222" />
    </Box>
  </group>
);

const ServerRoomAC = () => (
  <group position={[-4, 1.2, -2.5]} rotation={[0, Math.PI / 2, 0]}>
    {/* Main Outdoor Unit Body */}
    <Box args={[1.8, 2.4, 0.8]} position={[0, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#d1d5db" roughness={0.4} />
    </Box>
    {/* Dual Cooling Fans */}
    <Cylinder args={[0.35, 0.35, 0.05]} position={[0, 0.6, 0.41]} rotation={[Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#111" />
    </Cylinder>
    <Cylinder args={[0.35, 0.35, 0.05]} position={[0, -0.6, 0.41]} rotation={[Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#111" />
    </Cylinder>
    {/* Refrigerant Pipes */}
    <Cylinder args={[0.04, 0.04, 1.5]} position={[0.95, -0.4, 0]} castShadow>
       <meshStandardMaterial color="#111" />
    </Cylinder>
    <Cylinder args={[0.04, 0.04, 1.5]} position={[0.95, -0.4, -0.15]} castShadow>
       <meshStandardMaterial color="#111" />
    </Cylinder>
  </group>
);

const BarStool = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <Cylinder args={[0.05, 0.2, 0.8]} position={[0, 0.4, 0]} castShadow>
       <meshStandardMaterial color="#111" />
    </Cylinder>
    <Cylinder args={[0.25, 0.25, 0.05]} position={[0, 0.8, 0]} castShadow>
       <meshStandardMaterial color="#3d2a1d" roughness={0.7} />
    </Cylinder>
  </group>
);

const CafeTable = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <Cylinder args={[0.05, 0.2, 0.7]} position={[0, 0.35, 0]} castShadow>
      <meshStandardMaterial color="#dddddd" />
    </Cylinder>
    <Cylinder args={[0.6, 0.6, 0.05]} position={[0, 0.7, 0]} castShadow>
      <meshStandardMaterial color="#8b5a2b" roughness={0.8} />
    </Cylinder>
    {/* White Chairs */}
    <Box args={[0.3, 0.45, 0.3]} position={[-0.7, 0.225, 0]} castShadow>
       <meshStandardMaterial color="#ffffff" roughness={0.4} />
    </Box>
    <Box args={[0.05, 0.4, 0.3]} position={[-0.85, 0.65, 0]} castShadow>
       <meshStandardMaterial color="#ffffff" roughness={0.4} />
    </Box>
    <Box args={[0.3, 0.45, 0.3]} position={[0.7, 0.225, 0]} castShadow>
       <meshStandardMaterial color="#ffffff" roughness={0.4} />
    </Box>
    <Box args={[0.05, 0.4, 0.3]} position={[0.85, 0.65, 0]} castShadow>
       <meshStandardMaterial color="#ffffff" roughness={0.4} />
    </Box>
  </group>
);

const WallSconce = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <Box args={[0.1, 0.3, 0.15]} position={[0, 0, 0]}>
      <meshStandardMaterial color="#111" />
    </Box>
    <Cylinder args={[0.08, 0.08, 0.2]} position={[0, 0, 0.1]}>
      <meshStandardMaterial color="#ffc288" emissive="#ffc288" emissiveIntensity={2} toneMapped={false} />
    </Cylinder>
    <pointLight intensity={0.5} color="#ffc288" distance={4} />
  </group>
);

const DotCafe = () => {
  return (
    <group position={[14, 0, 1]} rotation={[0, -Math.PI / 6, 0]}>
      {/* Floor / Wooden Deck */}
      <Box args={[14, 0.2, 10]} position={[0, 0.1, 2]} receiveShadow>
        <meshStandardMaterial color="#2d1f14" roughness={0.9} />
      </Box>

      {/* Main Building Walls (Charcoal / Black) */}
      <Box args={[12, 5, 0.4]} position={[0, 2.5, -2.8]} castShadow receiveShadow>
        <meshStandardMaterial color="#151618" roughness={0.8} />
      </Box>
      <Box args={[0.4, 5, 6]} position={[-5.8, 2.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#151618" roughness={0.8} />
      </Box>
      <Box args={[0.4, 5, 6]} position={[5.8, 2.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#151618" roughness={0.8} />
      </Box>
      {/* Thick Corner Pillars */}
      <Box args={[0.8, 5, 0.8]} position={[-5.8, 2.5, 3]} castShadow receiveShadow>
        <meshStandardMaterial color="#1a1c20" roughness={0.9} />
      </Box>
      <Box args={[0.8, 5, 0.8]} position={[0, 2.5, 3]} castShadow receiveShadow>
        <meshStandardMaterial color="#1a1c20" roughness={0.9} />
      </Box>
      <Box args={[0.8, 5, 0.8]} position={[5.8, 2.5, 3]} castShadow receiveShadow>
        <meshStandardMaterial color="#1a1c20" roughness={0.9} />
      </Box>

      {/* Roof */}
      <Box args={[12.8, 0.6, 6.8]} position={[0, 5.3, 0.2]} castShadow receiveShadow>
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </Box>

      {/* --- WINDOWS & GLASS --- */}
      {/* Left Glass Facade */}
      <Box args={[5, 4, 0.05]} position={[-2.9, 2, 3]} receiveShadow>
        <meshPhysicalMaterial color="#ffffff" transmission={0.9} opacity={1} roughness={0.05} ior={1.5} thickness={0.5} />
      </Box>
      {/* Right Glass Facade */}
      <Box args={[5, 4, 0.05]} position={[2.9, 2, 3]} receiveShadow>
        <meshPhysicalMaterial color="#ffffff" transmission={0.9} opacity={1} roughness={0.05} ior={1.5} thickness={0.5} />
      </Box>

      {/* Mullions (Black Grid) for Left Window */}
      {[1.5, 2.5, 3.5].map(y => (
        <Box key={`lh-${y}`} args={[5, 0.1, 0.1]} position={[-2.9, y, 3.05]} castShadow><meshStandardMaterial color="#050505" /></Box>
      ))}
      {[-4, -2.9, -1.8].map(x => (
        <Box key={`lv-${x}`} args={[0.1, 4, 0.1]} position={[x, 2, 3.05]} castShadow><meshStandardMaterial color="#050505" /></Box>
      ))}

      {/* Right Window & Bar Counter */}
      <Box args={[3.5, 1, 1.2]} position={[2.9, 1, 3.2]} castShadow receiveShadow>
        <meshStandardMaterial color="#bda084" roughness={0.8} />
      </Box>
      {[2.5, 3.5].map(y => (
        <Box key={`rh-${y}`} args={[5, 0.1, 0.1]} position={[2.9, y, 3.05]} castShadow><meshStandardMaterial color="#050505" /></Box>
      ))}
      {[1.8, 2.9, 4].map(x => (
        <Box key={`rv-${x}`} args={[0.1, 3, 0.1]} position={[x, 2.5, 3.05]} castShadow><meshStandardMaterial color="#050505" /></Box>
      ))}

      {/* --- SIGNAGE & LIGHTS --- */}
      <Box args={[12.8, 0.05, 0.05]} position={[0, 4.9, 3.4]}>
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.5} toneMapped={false} />
      </Box>
      <Text position={[-2, 4.3, 3.5]} fontSize={0.6} color="#ffffff" fontWeight="bold">
        ZEON CAFE
      </Text>
      <pointLight position={[-2, 4.3, 3.8]} intensity={1.5} color="#ffffff" distance={5} />
      
      {/* Interior Warm Light */}
      <pointLight position={[0, 3.5, 0]} intensity={5} color="#ffedd6" distance={15} decay={2} castShadow />

      <WallSconce position={[-5.8, 2.5, 3.4]} />
      <WallSconce position={[0, 2.5, 3.4]} />

      {/* --- PERGOLA & PATIO --- */}
      <Box args={[0.2, 4.5, 0.2]} position={[5.5, 2.25, 6.5]} castShadow receiveShadow>
        <meshStandardMaterial color="#111" />
      </Box>
      <Box args={[0.2, 4.5, 0.2]} position={[0, 2.25, 6.5]} castShadow receiveShadow>
        <meshStandardMaterial color="#111" />
      </Box>
      <Box args={[0.2, 0.2, 3.5]} position={[5.5, 4.4, 4.75]} castShadow receiveShadow>
        <meshStandardMaterial color="#111" />
      </Box>
      <Box args={[0.2, 0.2, 3.5]} position={[0, 4.4, 4.75]} castShadow receiveShadow>
        <meshStandardMaterial color="#111" />
      </Box>
      <Box args={[6, 0.2, 0.2]} position={[2.75, 4.4, 6.5]} castShadow receiveShadow>
        <meshStandardMaterial color="#111" />
      </Box>
      {[0.5, 1, 1.5, 2, 2.5, 3].map(z => (
        <Box key={z} args={[5.5, 0.1, 0.3]} position={[2.75, 4.5, 3 + z]} castShadow receiveShadow>
          <meshStandardMaterial color="#111" />
        </Box>
      ))}

      {/* Faux String Lights under pergola */}
      {Array.from({length: 12}).map((_, i) => (
        <group key={`bulb-${i}`} position={[0.5 + (i%4)*1.5, 4.2 - (i%2)*0.15, 3.5 + Math.floor(i/4)*1.2]}>
          <mesh>
            <sphereGeometry args={[0.05]} />
            <meshStandardMaterial color="#ffc288" emissive="#ffc288" emissiveIntensity={3} toneMapped={false} />
          </mesh>
          <pointLight intensity={0.5} color="#ffc288" distance={3} />
        </group>
      ))}

      {/* Vine clusters dripping from the pergola */}
      {[
        [5.6, 4.2, 6.6], [5.4, 3.8, 6.4], [5.7, 3.5, 6.7],
        [4.5, 4.5, 6.5], [3.5, 4.6, 6.6]
      ].map((pos, i) => (
        <mesh key={`vine-${i}`} position={pos as [number, number, number]} castShadow>
          <icosahedronGeometry args={[0.4 + Math.random()*0.3, 1]} />
          <meshStandardMaterial color="#1d4528" roughness={0.9} />
        </mesh>
      ))}

      {/* Furniture */}
      <BarStool position={[1.5, 0, 4]} />
      <BarStool position={[2.5, 0, 4]} />
      <BarStool position={[3.5, 0, 4]} />
      <BarStool position={[4.5, 0, 4]} />

      <CafeTable position={[1.5, 0, 5.5]} />
      <CafeTable position={[4, 0, 5.5]} />

      {/* Building Systems */}
      <LobbyHVAC />
      <ServerRoomAC />
    </group>
  );
};

const Driveway = () => (
  <group>
    {/* Main Station Parking Lot Asphalt */}
    <Plane args={[48, 18]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 2]} receiveShadow>
      <meshStandardMaterial color="#1a1c20" roughness={0.95} metalness={0.05} />
    </Plane>
    
    {/* Entrance Driveway */}
    <Plane args={[8, 12]} rotation={[-Math.PI / 2, 0, 0]} position={[-14, 0.015, 10]} receiveShadow>
      <meshStandardMaterial color="#1a1c20" roughness={0.95} metalness={0.05} />
    </Plane>
    {/* Exit Driveway */}
    <Plane args={[8, 12]} rotation={[-Math.PI / 2, 0, 0]} position={[14, 0.015, 10]} receiveShadow>
      <meshStandardMaterial color="#1a1c20" roughness={0.95} metalness={0.05} />
    </Plane>

    {/* The Highway (4 lanes) */}
    <Plane args={[200, 24]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 20]} receiveShadow>
      <meshStandardMaterial color="#111214" roughness={0.9} metalness={0.1} />
    </Plane>
    
    {/* Highway Center Double Yellow Lines */}
    <Box args={[200, 0.02, 0.2]} position={[0, 0.02, 19.8]}>
       <meshStandardMaterial color="#fcd34d" emissive="#fcd34d" emissiveIntensity={0.5} />
    </Box>
    <Box args={[200, 0.02, 0.2]} position={[0, 0.02, 20.2]}>
       <meshStandardMaterial color="#fcd34d" emissive="#fcd34d" emissiveIntensity={0.5} />
    </Box>

    {/* Highway Lane Dashed White Lines */}
    {Array.from({length: 30}).map((_, i) => (
      <group key={`highway-lanes-${i}`}>
        <Box args={[4, 0.02, 0.15]} position={[-85 + i * 6, 0.02, 14.25]}>
           <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </Box>
        <Box args={[4, 0.02, 0.15]} position={[-85 + i * 6, 0.02, 25.75]}>
           <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </Box>
      </group>
    ))}

    {/* Parking Lines */}
    {[-8, -4, 0, 4, 8].map((x, i) => (
      <Box key={`line-${i}`} args={[0.15, 0.02, 7]} position={[x, 0.03, 4.5]} receiveShadow>
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </Box>
    ))}
  </group>
);

const Car = ({ position, rotation }: { position?: [number, number, number], rotation?: [number, number, number] }) => (
  <group position={position} rotation={rotation}>
    {/* Main Body */}
    <Box args={[1.8, 0.5, 4]} position={[0, 0.4, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.6} />
    </Box>
    {/* Cabin (Glass/Dark) */}
    <Box args={[1.5, 0.4, 2.2]} position={[0, 0.85, -0.2]} castShadow receiveShadow>
      <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} />
    </Box>
    {/* Wheels */}
    <Cylinder args={[0.35, 0.35, 0.2]} position={[-0.9, 0.35, 1.2]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
    </Cylinder>
    <Cylinder args={[0.35, 0.35, 0.2]} position={[0.9, 0.35, 1.2]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
    </Cylinder>
    <Cylinder args={[0.35, 0.35, 0.2]} position={[-0.9, 0.35, -1.2]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
    </Cylinder>
    <Cylinder args={[0.35, 0.35, 0.2]} position={[0.9, 0.35, -1.2]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
    </Cylinder>
    
    {/* Headlights (Front is +Z) */}
    <Box args={[0.4, 0.1, 0.1]} position={[-0.6, 0.5, 2.01]}>
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
    </Box>
    <Box args={[0.4, 0.1, 0.1]} position={[0.6, 0.5, 2.01]}>
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
    </Box>
    {/* Taillights (Rear is -Z) */}
    <Box args={[0.4, 0.1, 0.1]} position={[-0.6, 0.5, -2.01]}>
      <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
    </Box>
    <Box args={[0.4, 0.1, 0.1]} position={[0.6, 0.5, -2.01]}>
      <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
    </Box>
  </group>
);

const AnimatedCar = () => {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    const handleProgress = (e: Event) => {
      progressRef.current = (e as CustomEvent).detail;
    };
    window.addEventListener('sim-progress', handleProgress);
    return () => window.removeEventListener('sim-progress', handleProgress);
  }, []);

  // Define the smooth driving path
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-80, 0, 25.75),   // Start on highway far left
    new THREE.Vector3(-20, 0, 25.75),   // Approaching exit
    new THREE.Vector3(14, 0, 25.75),    // At exit driveway
    new THREE.Vector3(14, 0, 10),       // Turning into driveway
    new THREE.Vector3(6, 0, 8),         // Entering the lot and turning
    new THREE.Vector3(-6, 0, 8),        // Aligning with parking spot
    new THREE.Vector3(-6, 0, 5),        // Fully parked at charger
  ], false, 'catmullrom', 0.1), []);

  useFrame(() => {
    if (!groupRef.current) return;
    
    // Convert 0-100 to 0-1
    const p = Math.max(0, Math.min(1, progressRef.current / 100));
    
    // Position
    const pos = curve.getPointAt(p);
    groupRef.current.position.copy(pos);
    
    // Rotation
    if (p < 1) {
      const tangent = curve.getTangentAt(p).normalize();
      const angle = Math.atan2(tangent.x, tangent.z);
      groupRef.current.rotation.y = angle;
    }
  });

  return (
    <group ref={groupRef}>
      <Car />
    </group>
  );
};

const ZeonCharger = ({ position }: { position: [number, number, number] }) => {
  return (
    <group position={position} scale={[0.8, 0.8, 0.8]}>
      {/* Main Body */}
      <Box args={[0.8, 2.2, 0.6]} position={[0, 1.1, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#151618" roughness={0.6} metalness={0.3} />
      </Box>

      {/* Side Vents (Ribbed texture approximation using stacked thin boxes) */}
      {[0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7].map(y => (
        <group key={`vent-${y}`}>
          <Box args={[0.82, 0.05, 0.4]} position={[0, y, 0]}>
            <meshStandardMaterial color="#0a0a0a" roughness={0.8} />
          </Box>
        </group>
      ))}

      {/* Bottom Red Panel */}
      <Box args={[0.82, 0.6, 0.62]} position={[0, 0.3, 0.02]} castShadow receiveShadow>
        <meshStandardMaterial color="#d3152a" roughness={0.3} />
      </Box>
      <Text position={[0, 0.4, 0.35]} fontSize={0.12} color="#ffffff" fontWeight="bold">
        EV CHARGING
      </Text>
      <Text position={[0, 0.2, 0.35]} fontSize={0.15} color="#ffffff" fontWeight="bold">
        UPTO 60 kW
      </Text>

      {/* Top Red Panel */}
      <Box args={[0.82, 0.5, 0.62]} position={[0, 1.95, 0.02]} castShadow receiveShadow>
        <meshStandardMaterial color="#d3152a" roughness={0.3} />
      </Box>
      <Text position={[0, 2.05, 0.35]} fontSize={0.18} color="#ffffff" fontWeight="bold" letterSpacing={0.1}>
        ZEON
      </Text>
      <Text position={[0, 1.9, 0.35]} fontSize={0.07} color="#ffffff" letterSpacing={0.2}>
        CHARGING
      </Text>

      {/* Middle Screen Area */}
      <Box args={[0.6, 0.4, 0.62]} position={[0, 1.3, 0.01]} receiveShadow>
        <meshStandardMaterial color="#000000" />
      </Box>
      <Box args={[0.5, 0.3, 0.01]} position={[0, 1.3, 0.33]}>
        <meshStandardMaterial color="#1e293b" emissive="#00f0ff" emissiveIntensity={0.2} />
      </Box>
      <Text position={[0, 1.3, 0.35]} fontSize={0.08} color="#ffffff">
        72%
      </Text>

      {/* RFID Card Pad */}
      <Box args={[0.15, 0.2, 0.63]} position={[0, 0.95, 0.02]}>
        <meshStandardMaterial color="#111" />
      </Box>
      <Box args={[0.08, 0.08, 0.01]} position={[0, 0.95, 0.35]}>
         <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={1} toneMapped={false} />
      </Box>

      {/* Charging Guns Holsters */}
      <Box args={[0.15, 0.25, 0.63]} position={[-0.25, 0.95, 0.02]} castShadow>
        <meshStandardMaterial color="#0a0a0a" />
      </Box>
      <Box args={[0.15, 0.25, 0.63]} position={[0.25, 0.95, 0.02]} castShadow>
        <meshStandardMaterial color="#0a0a0a" />
      </Box>

      {/* Charging Guns */}
      <Cylinder args={[0.08, 0.08, 0.3]} position={[-0.25, 0.95, 0.4]} rotation={[Math.PI / 4, 0, 0]} castShadow>
        <meshStandardMaterial color="#111" roughness={0.5} />
      </Cylinder>
      <Cylinder args={[0.08, 0.08, 0.3]} position={[0.25, 0.95, 0.4]} rotation={[Math.PI / 4, 0, 0]} castShadow>
        <meshStandardMaterial color="#111" roughness={0.5} />
      </Cylinder>

      {/* Cables */}
      <Cylinder args={[0.03, 0.03, 1.5]} position={[-0.45, 0.5, 0.1]} castShadow>
         <meshStandardMaterial color="#050505" />
      </Cylinder>
      <Cylinder args={[0.03, 0.03, 1.5]} position={[0.45, 0.5, 0.1]} castShadow>
         <meshStandardMaterial color="#050505" />
      </Cylinder>

      {/* Top White Canopy / Light */}
      <Box args={[1.0, 0.1, 0.7]} position={[0, 2.25, 0.05]}>
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.5} toneMapped={false} />
      </Box>
    </group>
  );
};

const Bollard = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <Cylinder args={[0.06, 0.06, 0.6]} position={[0, 0.3, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#444444" roughness={0.3} metalness={0.8} />
    </Cylinder>
    <Cylinder args={[0.05, 0.05, 0.1]} position={[0, 0.65, 0]}>
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3} toneMapped={false} />
    </Cylinder>
  </group>
);

const Canopy = () => {
  return (
    <group position={[0, 0, 0]}>
      {/* Thick Industrial Pillars */}
      {[-6, -2, 2, 6].map((x, i) => (
        <Box key={i} args={[0.4, 4.5, 0.8]} position={[x, 2.25, -1]} castShadow receiveShadow>
          <meshStandardMaterial color="#2d3748" roughness={0.7} metalness={0.5} />
        </Box>
      ))}
      
      {/* Thick Main Fascia Roof */}
      <Box args={[17, 0.6, 6]} position={[0, 4.8, 1]} castShadow receiveShadow>
        <meshStandardMaterial color="#2d3748" roughness={0.8} />
      </Box>
      
      {/* Left Corner Front */}
      <Box args={[1.5, 0.62, 0.1]} position={[-7.75, 4.8, 4.01]} castShadow>
         <meshStandardMaterial color="#d3152a" roughness={0.4} />
      </Box>
      <Text position={[-7.75, 4.8, 4.07]} fontSize={0.3} color="#ffffff" fontWeight="bold">
        ZEON
      </Text>
      
      {/* Left Corner Side */}
      <Box args={[0.1, 0.62, 1.5]} position={[-8.51, 4.8, 3.25]} castShadow>
         <meshStandardMaterial color="#d3152a" roughness={0.4} />
      </Box>
      <Text position={[-8.57, 4.8, 3.25]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.3} color="#ffffff" fontWeight="bold">
        ZEON
      </Text>

      {/* Right Corner Front */}
      <Box args={[1.5, 0.62, 0.1]} position={[7.75, 4.8, 4.01]} castShadow>
         <meshStandardMaterial color="#d3152a" roughness={0.4} />
      </Box>
      <Text position={[7.75, 4.8, 4.07]} fontSize={0.3} color="#ffffff" fontWeight="bold">
        ZEON
      </Text>
      
      {/* Right Corner Side */}
      <Box args={[0.1, 0.62, 1.5]} position={[8.51, 4.8, 3.25]} castShadow>
         <meshStandardMaterial color="#d3152a" roughness={0.4} />
      </Box>
      <Text position={[8.57, 4.8, 3.25]} rotation={[0, Math.PI / 2, 0]} fontSize={0.3} color="#ffffff" fontWeight="bold">
        ZEON
      </Text>

      {/* Center Front */}
      <Box args={[1.5, 0.62, 0.1]} position={[0, 4.8, 4.01]} castShadow>
         <meshStandardMaterial color="#d3152a" roughness={0.4} />
      </Box>
      <Text position={[0, 4.8, 4.07]} fontSize={0.3} color="#ffffff" fontWeight="bold">
        ZEON
      </Text>

      {/* EV Charging Station Text on Fascia */}
      <Text position={[-4, 4.8, 4.01]} fontSize={0.25} color="#ffffff" fontWeight="bold">
        EV CHARGING STATION
      </Text>
      <Text position={[4, 4.8, 4.01]} fontSize={0.25} color="#ffffff" fontWeight="bold">
        EV CHARGING STATION
      </Text>
      
      {/* Ribbed Inner Ceiling Panel */}
      <Box args={[16.6, 0.1, 5.6]} position={[0, 4.5, 1]} receiveShadow>
        <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.8} />
      </Box>
      {Array.from({length: 20}).map((_, i) => (
        <Box key={`rib-${i}`} args={[16.4, 0.05, 0.1]} position={[0, 4.45, -1.6 + i * 0.28]} receiveShadow>
           <meshStandardMaterial color="#94a3b8" roughness={0.4} />
        </Box>
      ))}

      {/* Ceiling spot lights (visual only) */}
      {[-6, -2, 2, 6].map((x, i) => (
        <group key={`spot-${i}`}>
          <Cylinder args={[0.2, 0.2, 0.05]} position={[x, 4.43, 2]}>
             <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={4} toneMapped={false} />
          </Cylinder>
          <Cylinder args={[0.2, 0.2, 0.05]} position={[x, 4.43, 0]}>
             <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={4} toneMapped={false} />
          </Cylinder>
        </group>
      ))}
    </group>
  );
};

const SignBoard = () => {
  return (
    <group position={[-10, 1.5, 6]} rotation={[0, -Math.PI / 8, 0]}>
      {/* Main Board */}
      <Box args={[2, 3, 0.1]} position={[0, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#111111" roughness={0.8} />
      </Box>
      
      {/* Screen */}
      <Box args={[1.8, 2.8, 0.02]} position={[0, 0, 0.051]}>
        <meshStandardMaterial color="#041221" emissive="#020f1c" emissiveIntensity={0.5} />
      </Box>
      
      <Text position={[0, 0.8, 0.065]} fontSize={0.25} color="#ffffff" fontWeight="bold">
        ZEON EV
      </Text>
      <Text position={[0, 0.4, 0.065]} fontSize={0.12} color="#aaaaaa">
        Fast Charging Hub
      </Text>
      <Text position={[0, -0.2, 0.065]} fontSize={0.18} color="#00f0ff">
        Available: 4/4
      </Text>
      
      {/* Glowing border */}
      <Box args={[1.85, 2.85, 0.12]} position={[0, 0, 0]}>
        <meshBasicMaterial color="#ff7a00" wireframe />
      </Box>
    </group>
  );
};

const Ronaldo = ({ position, rotation }: { position?: [number, number, number], rotation?: [number, number, number] }) => (
  <group position={position} rotation={rotation} scale={[0.65, 0.65, 0.65]}>
    {/* Head */}
    <Box args={[0.4, 0.45, 0.4]} position={[0, 1.8, 0]} castShadow>
      <meshStandardMaterial color="#d1a384" roughness={0.6} /> {/* Tanned Skin */}
    </Box>
    {/* Hair (Slicked back/short) */}
    <Box args={[0.42, 0.1, 0.42]} position={[0, 2.05, 0]} castShadow>
      <meshStandardMaterial color="#1a1a1a" />
    </Box>
    <Box args={[0.42, 0.2, 0.1]} position={[0, 1.9, -0.16]} castShadow>
      <meshStandardMaterial color="#1a1a1a" />
    </Box>

    {/* Torso Base (Red) */}
    <Box args={[0.7, 0.9, 0.35]} position={[0, 1.15, 0]} castShadow>
      <meshStandardMaterial color="#dc2626" />
    </Box>
    
    {/* Chest Number 7 */}
    <Text position={[0, 1.25, 0.19]} fontSize={0.25} color="#eab308" fontWeight="bold">
      7
    </Text>
    {/* Back Number 7 */}
    <Text position={[0, 1.25, -0.19]} rotation={[0, Math.PI, 0]} fontSize={0.35} color="#eab308" fontWeight="bold">
      7
    </Text>

    {/* Green Shorts */}
    <Box args={[0.72, 0.45, 0.37]} position={[0, 0.5, 0]} castShadow>
      <meshStandardMaterial color="#16a34a" />
    </Box>
    <Text position={[0.2, 0.4, 0.19]} fontSize={0.12} color="#ffffff" fontWeight="bold">
      7
    </Text>

    {/* Left Arm (User's Right) */}
    {/* Sleeve */}
    <Box args={[0.25, 0.3, 0.25]} position={[0.45, 1.45, 0]} castShadow>
      <meshStandardMaterial color="#dc2626" />
    </Box>
    {/* Captain Armband */}
    <Box args={[0.26, 0.1, 0.26]} position={[0.45, 1.25, 0]} castShadow>
      <meshStandardMaterial color="#eab308" />
    </Box>
    {/* Arm */}
    <Box args={[0.2, 0.6, 0.2]} position={[0.45, 0.9, 0]} castShadow>
      <meshStandardMaterial color="#d1a384" roughness={0.6} />
    </Box>

    {/* Right Arm (User's Left) - No Tattoos! */}
    <Box args={[0.25, 0.3, 0.25]} position={[-0.45, 1.45, 0]} castShadow>
      <meshStandardMaterial color="#dc2626" />
    </Box>
    {/* Arm */}
    <Box args={[0.2, 0.6, 0.2]} position={[-0.45, 0.9, 0]} castShadow>
      <meshStandardMaterial color="#d1a384" roughness={0.6} /> 
    </Box>

    {/* Left Leg */}
    {/* Skin */}
    <Box args={[0.25, 0.4, 0.25]} position={[0.2, 0.1, 0]} castShadow>
      <meshStandardMaterial color="#d1a384" roughness={0.6} />
    </Box>
    {/* Sock */}
    <Box args={[0.26, 0.4, 0.26]} position={[0.2, -0.3, 0]} castShadow>
      <meshStandardMaterial color="#dc2626" />
    </Box>
    <Box args={[0.27, 0.05, 0.27]} position={[0.2, -0.15, 0]} castShadow>
      <meshStandardMaterial color="#16a34a" />
    </Box>
    {/* Cleat */}
    <Box args={[0.28, 0.15, 0.35]} position={[0.2, -0.55, 0.05]} castShadow>
      <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.1} /> {/* White cleats */}
    </Box>

    {/* Right Leg */}
    {/* Skin */}
    <Box args={[0.25, 0.4, 0.25]} position={[-0.2, 0.1, 0]} castShadow>
      <meshStandardMaterial color="#d1a384" roughness={0.6} />
    </Box>
    {/* Sock */}
    <Box args={[0.26, 0.4, 0.26]} position={[-0.2, -0.3, 0]} castShadow>
      <meshStandardMaterial color="#dc2626" />
    </Box>
    <Box args={[0.27, 0.05, 0.27]} position={[-0.2, -0.15, 0]} castShadow>
      <meshStandardMaterial color="#16a34a" />
    </Box>
    {/* Cleat */}
    <Box args={[0.28, 0.15, 0.35]} position={[-0.2, -0.55, 0.05]} castShadow>
      <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.1} /> {/* White cleats */}
    </Box>
  </group>
);

export const SceneViewer = () => {
  return (
    <div className="flex-1 relative w-full h-full bg-[#0a0910]">
      {/* Overlay UI */}
      <div className="absolute top-4 left-4 z-10 flex gap-2 pointer-events-none">
        <div className="bg-black/50 border border-white/10 text-xs px-3 py-1.5 rounded text-gray-300 backdrop-blur-md">
          View: <span className="text-white">Realistic Environment</span>
        </div>
        <div className="bg-black/50 border border-white/10 text-xs px-3 py-1.5 rounded text-gray-300 backdrop-blur-md flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></div>
          Live Stream
        </div>
      </div>
      
      {/* 3D Canvas */}
      <Canvas shadows camera={{ position: [-8, 6, 35], fov: 50 }} gl={{ logarithmicDepthBuffer: true }}>
        
        {/* Realistic Sky */}
        <Sky sunPosition={[10, -0.2, -15]} turbidity={0.3} rayleigh={4} mieCoefficient={0.005} mieDirectionalG={0.9} />
        <Environment preset="sunset" />
        
        {/* Lighting setup */}
        <ambientLight intensity={0.1} color="#4a5568" />
        {/* Main Sun Light casting shadows */}
        <directionalLight 
          position={[15, 2, -15]} 
          intensity={1.5} 
          color="#ff4400" 
          castShadow 
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={50}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
          shadow-bias={-0.0001}
        />
        
        {/* Scenery (Trees and Grass) */}
        <Scenery />
        
        {/* Paved Ground, Roads, and Lines */}
        <Driveway />
        

        
        {/* Architecture */}
        <group position={[-4, 0, 0]}>
          <Canopy />
        </group>
        <DotCafe />
        <SignBoard />
        
        {/* EV Chargers and Bollards */}
        {[-10, -6, -2, 2].map((x, i) => (
          <group key={`charger-${i}`}>
            <ZeonCharger position={[x, 0, 1]} />
            <Bollard position={[x - 0.7, 0, 2.5]} />
            <Bollard position={[x + 0.7, 0, 2.5]} />
          </group>
        ))}

        {/* The REAL GOAT */}
        <Ronaldo position={[9, 0.4, 6]} rotation={[0, -Math.PI / 6, 0]} />

        {/* Animated EV Car driving and parking */}
        <AnimatedCar />

        <OrbitControls 
          makeDefault 
          maxPolarAngle={Math.PI / 2 - 0.05} // Prevent going below ground
          minDistance={3} 
          maxDistance={60}
          target={[0, 2, 5]}
        />

        {/* Post Processing for glowing lights */}
        <EffectComposer>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
