import React, { useState } from 'react';
import { Box, Cylinder, Text, Edges } from '@react-three/drei';

export const ZeonCharger = ({ position, data, onClick }: { position: [number, number, number], data?: any, onClick?: () => void }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <group 
      position={position} 
      scale={[0.8, 0.8, 0.8]}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { setHovered(false); document.body.style.cursor = 'auto'; }}
    >
      {/* Interactive Cyber Bounding Box */}
      <mesh visible={false} position={[0, 1.1, 0]}>
         <boxGeometry args={[1.4, 2.5, 1.2]} />
      </mesh>
      
      {hovered && (
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[1.4, 2.5, 1.2]} />
          <Edges color="#00f0ff" linewidth={4} threshold={15} />
          <meshBasicMaterial transparent opacity={0.1} color="#00f0ff" depthWrite={false} />
        </mesh>
      )}

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

// @ts-ignore
// @ts-ignore
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

export const Canopy = ({ numChargers = 3 }: { numChargers?: number }) => {
  // Each charger takes about 3 units of width.
  // Standard 3 chargers = width 17.
  const baseWidth = Math.max(1, numChargers) * 4.5 + 4;
  const edgeDist = baseWidth / 2 - 0.5;
  
  // Calculate pillar positions depending on width
  const pillars = [];
  if (numChargers <= 1) pillars.push(-2, 2);
  else if (numChargers <= 2) pillars.push(-3.5, 3.5);
  else if (numChargers <= 3) pillars.push(-6, -2, 2, 6);
  else {
     for (let i = 0; i <= numChargers; i++) {
        pillars.push(-edgeDist + 1 + i * 4.5);
     }
  }

  return (
    <group position={[0, 0, 0]}>
      {/* Thick Industrial Pillars */}
      {pillars.map((x, i) => (
        <Box key={i} args={[0.4, 4.5, 0.8]} position={[x, 2.25, -1]} castShadow receiveShadow>
          <meshStandardMaterial color="#2d3748" roughness={0.7} metalness={0.5} />
        </Box>
      ))}
      
      {/* Thick Main Fascia Roof */}
      <Box args={[baseWidth, 0.6, 6]} position={[0, 4.8, 1]} castShadow receiveShadow>
        <meshStandardMaterial color="#2d3748" roughness={0.8} />
      </Box>
      
      {/* Left Corner Front */}
      <Box args={[1.5, 0.62, 0.1]} position={[-edgeDist + 0.75, 4.8, 4.01]} castShadow>
         <meshStandardMaterial color="#d3152a" roughness={0.4} />
      </Box>
      <Text position={[-edgeDist + 0.75, 4.8, 4.07]} fontSize={0.3} color="#ffffff" fontWeight="bold">
        ZEON
      </Text>
      
      {/* Left Corner Side */}
      <Box args={[0.1, 0.62, 1.5]} position={[-edgeDist, 4.8, 3.25]} castShadow>
         <meshStandardMaterial color="#d3152a" roughness={0.4} />
      </Box>
      <Text position={[-edgeDist - 0.06, 4.8, 3.25]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.3} color="#ffffff" fontWeight="bold">
        ZEON
      </Text>

      {/* Right Corner Front */}
      <Box args={[1.5, 0.62, 0.1]} position={[edgeDist - 0.75, 4.8, 4.01]} castShadow>
         <meshStandardMaterial color="#d3152a" roughness={0.4} />
      </Box>
      <Text position={[edgeDist - 0.75, 4.8, 4.07]} fontSize={0.3} color="#ffffff" fontWeight="bold">
        ZEON
      </Text>
      
      {/* Right Corner Side */}
      <Box args={[0.1, 0.62, 1.5]} position={[edgeDist, 4.8, 3.25]} castShadow>
         <meshStandardMaterial color="#d3152a" roughness={0.4} />
      </Box>
      <Text position={[edgeDist + 0.06, 4.8, 3.25]} rotation={[0, Math.PI / 2, 0]} fontSize={0.3} color="#ffffff" fontWeight="bold">
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
      <Text position={[-edgeDist / 2, 4.8, 4.01]} fontSize={0.25} color="#ffffff" fontWeight="bold">
        EV CHARGING STATION
      </Text>
      <Text position={[edgeDist / 2, 4.8, 4.01]} fontSize={0.25} color="#ffffff" fontWeight="bold">
        EV CHARGING STATION
      </Text>
      
      {/* Ribbed Inner Ceiling Panel */}
      <Box args={[baseWidth - 0.4, 0.1, 5.6]} position={[0, 4.5, 1]} receiveShadow>
        <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.8} />
      </Box>
      {Array.from({length: 20}).map((_, i) => (
        <Box key={`rib-${i}`} args={[baseWidth - 0.6, 0.05, 0.1]} position={[0, 4.45, -1.6 + i * 0.28]} receiveShadow>
           <meshStandardMaterial color="#94a3b8" roughness={0.4} />
        </Box>
      ))}

      {/* Ceiling spot lights (visual only) */}
      {pillars.map((x, i) => (
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

export const SignBoard = ({ position = [-10, 1.5, 6], rotation = [0, -Math.PI / 8, 0] }: { position?: [number, number, number], rotation?: [number, number, number] }) => {
  return (
    <group position={position} rotation={rotation}>
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

export const ZeonHubModel = ({ 
  position = [0, 0, 0], 
  rotation = [0, 0, 0], 
  scale = [1, 1, 1],
  numChargers = 3,
  data,
  onChargerClick
}: { 
  position?: [number, number, number], 
  rotation?: [number, number, number],
  scale?: [number, number, number],
  numChargers?: number,
  data?: any,
  onChargerClick?: (data: any) => void
}) => {
  const chargers = [];
  const startX = -((numChargers - 1) * 3) / 2;
  
  for (let i = 0; i < numChargers; i++) {
    chargers.push(<ZeonCharger key={i} position={[startX + i * 3, 0, 1]} data={data} onClick={() => onChargerClick && onChargerClick(data)} />);
  }

  const signPosX = -((Math.max(1, numChargers) * 4.5 + 4) / 2) - 1.5;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Canopy numChargers={numChargers} />
      {chargers}
      <SignBoard position={[signPosX, 1.5, 3]} />
    </group>
  );
};
