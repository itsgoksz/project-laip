import { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Html, Sky } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, Vignette, ToneMapping, DepthOfField } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Building2 } from 'lucide-react';

// --- Static Geometry Components ---

const DroneMapBase = () => (
  <mesh position={[0, -0.5, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[100000, 100000]} />
    {/* Lush earthy green base to simulate the dense canopy floor of Bangalore */}
    <meshStandardMaterial color="#2f3e27" roughness={1} /> 
  </mesh>
);

const buildingMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.1 });
// Procedural Building Shader for windows, floors, and roofs (zero performance cost)
buildingMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>\n attribute float isApartment;\n varying vec3 vWorldPosition;\n varying vec3 vWorldNormal;\n varying float vIsApartment;`
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    `#include <worldpos_vertex>\n vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\n vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);\n vIsApartment = isApartment;`
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>\n varying vec3 vWorldPosition;\n varying vec3 vWorldNormal;\n varying float vIsApartment;`
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    `#include <color_fragment>\n 
     bool isRoof = vWorldNormal.y > 0.5;
     if (isRoof) {
       // Roofs get a slightly darker, warmer terracotta/grey tint
       diffuseColor.rgb *= vec3(0.9, 0.85, 0.8);
     } else {
       // Walls: draw a grid of windows
       float wx = fract(vWorldPosition.x / 4.0);
       float wz = fract(vWorldPosition.z / 4.0);
       float wy = fract(vWorldPosition.y / 4.0);
       
       float w = abs(vWorldNormal.x) > 0.5 ? wz : wx;
       
       if (wy > 0.3 && wy < 0.7 && w > 0.3 && w < 0.7) {
         // Randomly toggle windows "on" and "off"
         float randomLight = fract(sin(dot(floor(vWorldPosition.xyz / 4.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
         if (randomLight > 0.6) {
           diffuseColor.rgb = vec3(0.9, 0.9, 0.7); // Warm lit window
         } else {
           diffuseColor.rgb *= 0.2; // Dark unlit glass
         }
       }
       
       // Balcony ridges for apartments
       if (vIsApartment > 0.5) {
         if (fract(vWorldPosition.y / 3.5) < 0.15) {
           diffuseColor.rgb *= 0.4; // Balcony shadow depth
         }
         if (fract(w * 1.5) < 0.1) {
           diffuseColor.rgb = vec3(0.7, 0.7, 0.7); // Concrete pillar
         }
       }
       
       // Ambient occlusion gradient (darker near ground)
       float groundAO = clamp(vWorldPosition.y / 20.0, 0.4, 1.0);
       diffuseColor.rgb *= groundAO;
     }
    `
  );
};

const roadMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 });
roadMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>\n varying vec2 vUvLine;`
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <uv_vertex>',
    `#include <uv_vertex>\n vUvLine = uv;`
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>\n varying vec2 vUvLine;`
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    `#include <color_fragment>\n 
     // Dash logic for yellow lane markings
     if (diffuseColor.r > 0.9 && diffuseColor.g > 0.7 && diffuseColor.b < 0.1) {
       if (fract(vUvLine.x) > 0.5) {
         discard;
       }
     }
    `
  );
};

const RealisticBuildingPalette = [
  "#f8f9fa", // pure white
  "#e9ecef", // light grey
  "#fdf6e3", // cream
  "#f5ebe0", // pale beige
  "#e3d5ca", // light tan
  "#d5bdaf" // tan / pale terracotta
];

const RealisticTreePalette = [
  "#2d5a27", // dark forest green
  "#3a5a25", // olive green
  "#4a6b3b", // muted green
  "#2b4522", // very dark green
];

const MergedCityMap = ({ buildings, roads }: { buildings: any[], roads: any[] }) => {
  const { buildingGeometry, roadGeometry } = useMemo(() => {
    // 1. Merge Buildings
    const buildingGeos: THREE.BufferGeometry[] = [];
    
    buildings.forEach(b => {
      try {
        const s = new THREE.Shape();
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        
        b.polygon.forEach((pt: number[], i: number) => {
          if (i === 0) s.moveTo(pt[0], -pt[1]);
          else s.lineTo(pt[0], -pt[1]);
          
          minX = Math.min(minX, pt[0]);
          maxX = Math.max(maxX, pt[0]);
          minZ = Math.min(minZ, pt[1]);
          maxZ = Math.max(maxZ, pt[1]);
        });
        
        // Massive polygon detection (Boundary of a complex rather than a single building)
        let isMassiveBoundary = false;
        const bName = (b.name || "").toLowerCase();
        // Exclude specific known landmark towers from being flattened
        const isIconicTower = ["elita", "millennium", "south city", "palmsprings", "woodrose"].some(n => bName.includes(n));
        
        if (((maxX - minX) > 200 || (maxZ - minZ) > 200) && !isIconicTower) {
          isMassiveBoundary = true;
        }

        const extrudeSettings = { depth: isMassiveBoundary ? 0.5 : b.height, bevelEnabled: false };
        const geo = new THREE.ExtrudeGeometry(s, extrudeSettings);
        geo.rotateX(-Math.PI / 2); 
        if (isMassiveBoundary) geo.translate(0, 0.2, 0); // Keep it just above the ground 
        
        // Deterministic randomness based on building ID
        const idHash = parseInt(b.id) || 0;
        const detRand = (idHash % 1000) / 1000; 

        // Pick a realistic building color
        let colorHex = RealisticBuildingPalette[Math.floor(detRand * RealisticBuildingPalette.length)];
        let isApt = 0;
        
        
        if (isMassiveBoundary) {
          colorHex = "#4b5563"; // Dark grey paved area
          if (b.category === "club" || bName.includes("park")) colorHex = "#2d5a27"; // Grass area
          isApt = 0;
        } else if (b.category === "hospital") {
          colorHex = "#f8f9fa"; // Clean white for hospitals
        } else if (b.category === "mall" || b.category === "commercial") {
          colorHex = "#93c5fd"; // Glassy blue for commercial buildings and malls
        } else if (b.category === "apartments") {
          isApt = 1;
          // Exact matches for iconic apartments
          if (bName.includes("elita")) colorHex = "#f8f9fa"; // White cylindrical towers
          else if (bName.includes("millennium") || bName.includes("south city")) colorHex = "#8b4513"; // Brick red / Terracotta
          else if (bName.includes("palmsprings")) colorHex = "#d2b48c"; // Tan beige
        } else if (b.category === "club") {
          colorHex = bName.includes("woodrose") ? "#4a3b32" : "#5c4033"; // Dark wood
        } else if (b.category === "showroom") {
          colorHex = "#38bdf8"; // Bright glass blue
        } else if (b.category === "restaurant" || b.category === "cafe" || b.category === "fast_food") {
          colorHex = "#fca5a5"; // Warm reddish base
          
          // Generate a custom sloped roof for restaurants
          const roofGeo = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.5, bevelThickness: 0.5 });
          roofGeo.rotateX(-Math.PI / 2);
          roofGeo.translate(0, b.height, 0); // Place on top
          
          const rCount = roofGeo.attributes.position.count;
          const rCols = new Float32Array(rCount * 3);
          const rApt = new Float32Array(rCount);
          for(let i=0; i<rCount; i++) {
             rCols[i*3]=0.9; rCols[i*3+1]=0.2; rCols[i*3+2]=0.2; // Red roof
             rApt[i]=0;
          }
          roofGeo.setAttribute('color', new THREE.BufferAttribute(rCols, 3));
          roofGeo.setAttribute('isApartment', new THREE.BufferAttribute(rApt, 1));
          buildingGeos.push(roofGeo);
        }
        
        const c = new THREE.Color(colorHex); 
        // Slight lightness variation based on deterministic hash
        c.offsetHSL(0, 0, (detRand - 0.5) * 0.08);

        const count = geo.attributes.position.count;
        const colors = new Float32Array(count * 3);
        const aptAttr = new Float32Array(count);
        for(let i = 0; i < count; i++) {
          colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
          aptAttr[i] = isApt;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('isApartment', new THREE.BufferAttribute(aptAttr, 1));
        
        buildingGeos.push(geo);
      } catch (e) {
        console.warn("Skipping invalid building", b.id, e);
      }
    });
    
    let mergedBuildingGeo = null;
    try {
      mergedBuildingGeo = buildingGeos.length > 0 ? BufferGeometryUtils.mergeGeometries(buildingGeos, false) : null;
    } catch (e) {
      console.error("Failed to merge buildings", e);
    }
    
    // 2. Merge Roads
    const roadGeos: THREE.BufferGeometry[] = [];
    roads.forEach(r => {
      try {
        if (r.line.length < 2) return;
        const pts = r.line.map((pt: number[]) => new THREE.Vector3(pt[0], 0.2, pt[1]));
        const path = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
        const isPrimary = r.type === "primary" || r.type === "secondary" || r.type === "trunk";
        const geo = new THREE.TubeGeometry(path, r.line.length * 4, isPrimary ? 6 : 3.5, 4, false);
        geo.scale(1, 0.05, 1); // Flatten into a ribbon
        geo.translate(0, 0.2, 0); // Position exactly on the ground
        
        // Sidewalks
        const sidewalkGeo = new THREE.TubeGeometry(path, r.line.length * 4, isPrimary ? 7.5 : 4.5, 4, false);
        sidewalkGeo.scale(1, 0.04, 1);
        sidewalkGeo.translate(0, 0.15, 0); // under the road
        const sc = new Float32Array(sidewalkGeo.attributes.position.count * 3);
        for(let i=0; i<sc.length; i+=3){ sc[i]=0.85; sc[i+1]=0.85; sc[i+2]=0.85; } // concrete grey
        sidewalkGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
        roadGeos.push(sidewalkGeo);

        // Realistic dark asphalt
        const c = new THREE.Color(isPrimary ? "#374151" : "#4b5563");
        const colors = new Float32Array(geo.attributes.position.count * 3);
        for(let i = 0; i < colors.length; i+=3) {
          colors[i] = c.r; colors[i+1] = c.g; colors[i+2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        roadGeos.push(geo);

        if (isPrimary) {
          // Add yellow lane markings
          const laneGeo = new THREE.TubeGeometry(path, r.line.length * 4, 0.4, 4, false);
          laneGeo.scale(1, 0.05, 1); // Flatten markings too
          laneGeo.translate(0, 0.4, 0); // hover slightly above the road
          
          // Scale UVs so 1.0 unit in UV space = 10 meters (for dashed lines)
          const roadLen = path.getLength();
          const uvs = laneGeo.attributes.uv.array as Float32Array;
          for(let i=0; i<uvs.length; i+=2) {
            uvs[i] = uvs[i] * (roadLen / 10);
          }
          
          const lc = new Float32Array(laneGeo.attributes.position.count * 3);
          for(let i=0; i<lc.length; i+=3){ lc[i]=1; lc[i+1]=0.8; lc[i+2]=0; } // Yellow
          laneGeo.setAttribute('color', new THREE.BufferAttribute(lc, 3));
          roadGeos.push(laneGeo);
        }
      } catch (e) {
        console.warn("Skipping invalid road", r.id, e);
      }
    });
    
    let mergedRoadGeo = null;
    try {
      mergedRoadGeo = roadGeos.length > 0 ? BufferGeometryUtils.mergeGeometries(roadGeos, false) : null;
    } catch (e) {
      console.error("Failed to merge roads", e);
    }
    
    return { buildingGeometry: mergedBuildingGeo, roadGeometry: mergedRoadGeo };
  }, [buildings, roads]);

  return (
    <group>
      {buildingGeometry && (
        <mesh castShadow receiveShadow geometry={buildingGeometry} material={buildingMaterial} />
      )}
      {roadGeometry && (
        <mesh receiveShadow geometry={roadGeometry} material={roadMaterial} />
      )}
    </group>
  );
};

// --- Base Environment Layers ---

const EVStationsLayer = ({ stations, onSelect }: { stations: any[], onSelect: (s: any) => void }) => {
  if (!stations || stations.length === 0) return null;
  
  return (
    <group>
      {stations.map(st => {
        const numChargers = Math.max(1, st.connections.length);
        const spacing = 3;
        const startX = -((numChargers - 1) * spacing) / 2;
        
        return (
          <group key={st.id} position={[st.center[0], 0, st.center[1]]}>
            {/* Holographic Glowing Pillar for visibility from afar */}
            <mesh position={[0, 20, 0]}>
              <cylinderGeometry args={[0.5, 0.5, 40, 8]} />
              <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            
            {/* Mathematically exact number of charging pedestals based on API data */}
            {Array.from({ length: numChargers }).map((_, i) => (
              <group key={i} position={[startX + i * spacing, 0, 0]}>
                {/* Main Body (Tall thin white chassis) */}
                <mesh position={[0, 1.8, 0]} castShadow>
                  <boxGeometry args={[0.9, 3.6, 0.5]} />
                  <meshStandardMaterial color="#f3f4f6" metalness={0.2} roughness={0.1} />
                </mesh>
                
                {/* Dark screen panel area */}
                <mesh position={[0, 2.5, 0.26]}>
                  <planeGeometry args={[0.7, 1.2]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.4} />
                </mesh>

                {/* Glowing LED Status Ring */}
                <mesh position={[0, 2.2, 0.27]} rotation={[Math.PI/2, 0, 0]}>
                  <torusGeometry args={[0.15, 0.02, 16, 32]} />
                  <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={4} />
                </mesh>
                
                {/* Charging Cable Block (Side holster) */}
                <mesh position={[0.5, 1.8, 0]}>
                  <boxGeometry args={[0.2, 1.2, 0.3]} />
                  <meshStandardMaterial color="#1f2937" roughness={0.9} />
                </mesh>
                {/* Cable Wire (hanging down) */}
                <mesh position={[0.5, 0.8, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 1.5, 8]} />
                  <meshStandardMaterial color="#111827" />
                </mesh>
              </group>
            ))}

            {/* Interactive Floating Dot */}
            <Html position={[0, 32, 0]} center zIndexRange={[100, 0]}>
              <div 
                onClick={(e) => { e.stopPropagation(); onSelect(st); }}
                className="w-4 h-4 bg-green-500 rounded-full cursor-pointer hover:scale-150 transition-transform animate-pulse border-2 border-white shadow-[0_0_20px_#22c55e]"
                title={st.name}
              >
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] font-bold text-green-400 bg-black/60 px-1 rounded whitespace-nowrap pointer-events-none">EV</div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

const LakesLayer = ({ lakes }: { lakes: any[] }) => {
  const { waterGeo, islandGeo } = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    const islands: THREE.BufferGeometry[] = [];
    
    lakes.forEach((l) => {
      try {
        const s = new THREE.Shape();
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        l.polygon.forEach((pt: number[], i: number) => {
          if (i === 0) s.moveTo(pt[0], -pt[1]);
          else s.lineTo(pt[0], -pt[1]);
          minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0]);
          minZ = Math.min(minZ, pt[1]); maxZ = Math.max(maxZ, pt[1]);
        });
        const geo = new THREE.ShapeGeometry(s);
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, 0.8, 0); // Raise above the massive park boundary (0.7m)
        geos.push(geo);
        
        // Massive Sarakki Lake Island Detection (Area Check)
        const width = maxX - minX;
        const height = maxZ - minZ;
        if (width > 800 && height > 800) {
          const cx = (minX + maxX) / 2;
          const cz = (minZ + maxZ) / 2;
          
          // Sarakki Lake Island
          const islandShape = new THREE.Shape();
          islandShape.moveTo(cx - 60, -(cz - 30));
          islandShape.lineTo(cx + 80, -(cz - 20));
          islandShape.lineTo(cx + 40, -(cz + 50));
          islandShape.lineTo(cx - 50, -(cz + 40));
          islandShape.lineTo(cx - 60, -(cz - 30));
          const iGeo = new THREE.ExtrudeGeometry(islandShape, { depth: 3, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 5, bevelThickness: 5 });
          iGeo.rotateX(-Math.PI / 2);
          islands.push(iGeo);
        }
      } catch (e) {
        console.warn("Skipping invalid lake", l.id, e);
      }
    });
    return {
      waterGeo: geos.length > 0 ? BufferGeometryUtils.mergeGeometries(geos, false) : null,
      islandGeo: islands.length > 0 ? BufferGeometryUtils.mergeGeometries(islands, false) : null
    };
  }, [lakes]);

  return (
    <group>
      {waterGeo && (
        <mesh geometry={waterGeo} receiveShadow>
          <meshPhysicalMaterial 
            color="#0ea5e9" // Bright beautiful blue
            metalness={0.9}
            roughness={0.05}
            envMapIntensity={2.0}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
            transmission={0.2} 
            opacity={1.0} 
            transparent={false}
            ior={1.33}
          />
        </mesh>
      )}
      {islandGeo && (
        <mesh geometry={islandGeo} receiveShadow castShadow>
          <meshStandardMaterial color="#2d5a27" roughness={1.0} />
        </mesh>
      )}
    </group>
  );
};

const getCategoryColor = (cat: string) => {
  if (cat === "mall" || cat === "commercial") return "bg-cyan-400 shadow-[0_0_15px_#22d3ee]";
  if (cat === "hospital") return "bg-red-500 shadow-[0_0_15px_#ef4444]";
  if (cat === "restaurant" || cat === "cafe" || cat === "fast_food") return "bg-rose-400 shadow-[0_0_15px_#fb7185]";
  return "bg-indigo-400 shadow-[0_0_15px_#818cf8]"; // apartments
};

const LandmarksLayer = ({ buildings, onSelect }: { buildings: any[], onSelect: (b: any) => void }) => {
  const landmarks = useMemo(() => buildings.filter(b => b.name && (b.category === "mall" || b.category === "hospital" || b.category === "apartments" || b.category === "restaurant" || b.category === "cafe" || b.category === "fast_food")), [buildings]);
  return (
    <group>
      {landmarks.map(b => (
        <Html key={b.id} position={[b.center[0], b.height + 5, b.center[1]]} center distanceFactor={800} zIndexRange={[100, 0]}>
          <div 
            onClick={(e) => { e.stopPropagation(); onSelect(b); }}
            className={`w-3 h-3 ${getCategoryColor(b.category)} rounded-full cursor-pointer hover:scale-150 transition-transform animate-pulse border border-white/50`}
            title={b.name}
          ></div>
        </Html>
      ))}
    </group>
  );
};

const RealTrees = ({ trees }: { trees: number[][] }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (meshRef.current) {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      trees.forEach((t, i) => {
        dummy.position.set(t[0], 0, t[1]); // Ground the trees properly
        dummy.scale.setScalar(1 + Math.random() * 3);
        dummy.rotation.set(Math.random()*0.2, Math.random()*Math.PI, Math.random()*0.2);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        
        const colorHex = RealisticTreePalette[Math.floor(Math.random() * RealisticTreePalette.length)];
        color.set(colorHex);
        meshRef.current!.setColorAt(i, color);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [trees]);

  if (trees.length === 0) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, trees.length]} castShadow receiveShadow>
      <sphereGeometry args={[2, 7, 7]} />
      <meshStandardMaterial color="#ffffff" roughness={1} />
    </instancedMesh>
  );
};

// Procedural dense forest to fill in the gaps and simulate Bangalore's lush canopy
const DenseForest = ({ lakes }: { lakes?: any[] }) => {
  const count = 15000; // Massive canopy
  const meshRef1 = useRef<THREE.InstancedMesh>(null);
  const meshRef2 = useRef<THREE.InstancedMesh>(null);
  const meshRef3 = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (meshRef1.current && meshRef2.current && meshRef3.current) {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      let i1=0, i2=0, i3=0;
      for (let i = 0; i < count; i++) {
        // Scatter densely across a 4.5km map
        const x = (Math.random() - 0.5) * 4500;
        const z = (Math.random() - 0.5) * 4500;
        
        // Prevent spawning trees inside lakes
        let inLake = false;
        if (lakes) {
          for (const lake of lakes) {
            let inside = false;
            const vs = lake.polygon;
            for (let k = 0, j = vs.length - 1; k < vs.length; j = k++) {
              const xi = vs[k][0], yi = -vs[k][1];
              const xj = vs[j][0], yj = -vs[j][1];
              const intersect = ((yi > z) != (yj > z)) && (x < (xj - xi) * (z - yi) / (yj - yi) + xi);
              if (intersect) inside = !inside;
            }
            if (inside) { inLake = true; break; }
          }
        }
        if (inLake) continue;
        
        dummy.position.set(x, 0, z);
        dummy.scale.setScalar(1 + Math.random() * 3);
        dummy.rotation.set(Math.random()*0.2, Math.random()*Math.PI, Math.random()*0.2);
        dummy.updateMatrix();
        
        const colorHex = RealisticTreePalette[Math.floor(Math.random() * RealisticTreePalette.length)];
        color.set(colorHex);
        
        if (i % 3 === 0) {
          meshRef1.current!.setMatrixAt(i1, dummy.matrix);
          meshRef1.current!.setColorAt(i1, color);
          i1++;
        } else if (i % 3 === 1) {
          meshRef2.current!.setMatrixAt(i2, dummy.matrix);
          meshRef2.current!.setColorAt(i2, color);
          i2++;
        } else {
          meshRef3.current!.setMatrixAt(i3, dummy.matrix);
          meshRef3.current!.setColorAt(i3, color);
          i3++;
        }
      }
      meshRef1.current.instanceMatrix.needsUpdate = true;
      if (meshRef1.current.instanceColor) meshRef1.current.instanceColor.needsUpdate = true;
      meshRef2.current.instanceMatrix.needsUpdate = true;
      if (meshRef2.current.instanceColor) meshRef2.current.instanceColor.needsUpdate = true;
      meshRef3.current.instanceMatrix.needsUpdate = true;
      if (meshRef3.current.instanceColor) meshRef3.current.instanceColor.needsUpdate = true;
    }
  }, []);

  return (
    <group>
      <instancedMesh ref={meshRef1} args={[undefined as any, undefined as any, count/3]} castShadow receiveShadow>
        <sphereGeometry args={[2.5, 7, 7]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={meshRef2} args={[undefined as any, undefined as any, count/3]} castShadow receiveShadow>
        <coneGeometry args={[2, 6, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={meshRef3} args={[undefined as any, undefined as any, count/3]} castShadow receiveShadow>
        <dodecahedronGeometry args={[2.5, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </instancedMesh>
    </group>
  );
};

const StreetlightsLayer = ({ roads }: { roads: any[] }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const poleRef = useRef<THREE.InstancedMesh>(null);
  
  const points = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    roads.forEach(r => {
      const isMajor = r.type === "primary" || r.type === "secondary";
      const isMinor = r.type === "residential" || r.type === "tertiary";
      
      if ((!isMajor && !isMinor) || r.line.length < 2) return;
      const pts = r.line.map((pt: number[]) => new THREE.Vector3(pt[0], 0, pt[1]));
      const path = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
      
      // Light every 25 meters for major, 60 meters for minor
      const spacing = isMajor ? 25 : 60;
      const count = Math.floor(path.getLength() / spacing); 
      if (count === 0) return; // Fix division by zero for short roads
      for(let i = 0; i <= count; i++) {
        const t = count === 0 ? 0 : (i / count);
        const pt = path.getPointAt(t);
        const tangent = path.getTangentAt(t);
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        
        // Spawn lights on both sides of the road
        arr.push(pt.clone().add(normal.clone().multiplyScalar(4)));
        arr.push(pt.clone().add(normal.clone().multiplyScalar(-4)));
      }
    });
    return arr;
  }, [roads]);

  useEffect(() => {
    if (meshRef.current && poleRef.current && points.length > 0) {
      const dummy = new THREE.Object3D();
      points.forEach((pt, i) => {
        dummy.position.copy(pt);
        dummy.position.y = 5; // Bulb height
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        
        dummy.position.y = 2.5; // Pole center
        dummy.updateMatrix();
        poleRef.current!.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      poleRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [points]);

  if (points.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, points.length]}>
        <sphereGeometry args={[0.7, 8, 8]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={10} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={poleRef} args={[undefined as any, undefined as any, points.length]}>
        <cylinderGeometry args={[0.15, 0.15, 5, 4]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </instancedMesh>
    </group>
  );
};

// --- Dynamic Engines ---

const TrafficEngine = ({ roads }: { roads: any[] }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const paths = useMemo(() => {
    return roads.map(r => {
      const pts = r.line.map((pt: number[]) => new THREE.Vector3(pt[0], 0.8, pt[1]));
      return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
    }).filter(p => p.points.length > 1);
  }, [roads]);

  const numCars = Math.min(paths.length * 3, 1000); // Massive map needs more cars
  const cars = useMemo(() => {
    if (paths.length === 0) return [];
    return Array.from({ length: numCars }).map(() => ({
      pathIndex: Math.floor(Math.random() * paths.length),
      progress: Math.random(),
      speed: (0.0003 + Math.random() * 0.0004) * (Math.random() > 0.5 ? 1 : -1)
    }));
  }, [paths, numCars]);

  useFrame(() => {
    if (!meshRef.current || paths.length === 0) return;
    const dummy = new THREE.Object3D();
    const pos = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    
    cars.forEach((car, i) => {
      car.progress += car.speed;
      if (car.progress > 1) car.progress = 0;
      if (car.progress < 0) car.progress = 1;
      
      const path = paths[car.pathIndex];
      path.getPointAt(car.progress, pos);
      path.getTangentAt(car.progress, tangent);
      
      if (car.speed < 0) tangent.negate();
      
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().add(tangent));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (paths.length === 0) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, numCars]}>
      <boxGeometry args={[1.5, 0.8, 3]} />
      <meshStandardMaterial color="#00d2ff" emissive="#00d2ff" emissiveIntensity={1.5} />
    </instancedMesh>
  );
};

const Flight = ({ data }: { data: any }) => {
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef(new THREE.Vector3(...data.position));

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const rad = THREE.MathUtils.degToRad(data.heading);
    const vx = Math.sin(rad) * data.velocity * 0.1 * delta;
    const vz = -Math.cos(rad) * data.velocity * 0.1 * delta;
    
    posRef.current.x += vx;
    posRef.current.z += vz;
    groupRef.current.position.copy(posRef.current);
  });

  return (
    <group ref={groupRef} position={posRef.current}>
      <Html position={[0, 15, 0]} center zIndexRange={[100, 0]}>
        <div className="bg-black/80 text-[10px] text-white px-2 py-1 rounded font-mono border border-blue-500 whitespace-nowrap opacity-80 backdrop-blur pointer-events-none">
          ✈ {data.callsign} <br />
          <span className="text-blue-400">{Math.round(data.velocity)}m/s</span>
        </div>
      </Html>
      <group rotation={[0, -THREE.MathUtils.degToRad(data.heading), 0]}>
        <mesh>
          <cylinderGeometry args={[2, 2, 16, 8]} rotation={[Math.PI/2, 0, 0]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, -2]}>
          <boxGeometry args={[18, 0.5, 4]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 2, 6]}>
          <boxGeometry args={[0.5, 4, 3]} />
          <meshStandardMaterial color="#00d2ff" emissive="#00d2ff" emissiveIntensity={2} />
        </mesh>
      </group>
    </group>
  );
};

const FlightEngine = () => {
  const [flights, setFlights] = useState<any[]>([]);
  useEffect(() => {
    const fetchFlights = () => {
      fetch("http://localhost:8001/api/flights")
        .then(r => r.json())
        .then(data => { if (data.flights) setFlights(data.flights); })
        .catch(() => {});
    };
    fetchFlights();
    const interval = setInterval(fetchFlights, 10000);
    return () => clearInterval(interval);
  }, []);
  return <group>{flights.map(f => <Flight key={f.id} data={f} />)}</group>;
};


// ==========================================
// CINEMATIC DRIVING ENGINES (PROJECT NOLAN-STAR)
// ==========================================

const CinematicRain = ({ active }: { active: boolean }) => {
  const count = 20000;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
      pos[i*3] = (Math.random() - 0.5) * 2000;
      pos[i*3+1] = Math.random() * 800;
      pos[i*3+2] = (Math.random() - 0.5) * 2000;
    }
    return pos;
  }, []);
  
  const pointsRef = useRef<THREE.Points>(null);
  useFrame((state, delta) => {
    if(!active || !pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const camPos = state.camera.position;
    for(let i=0; i<count; i++) {
      pos[i*3+1] -= 400 * delta; // heavy falling speed
      if (pos[i*3+1] < 0) pos[i*3+1] = 800;
      
      // wrap X and Z around camera to make it infinite
      if (pos[i*3] < camPos.x - 1000) pos[i*3] += 2000;
      if (pos[i*3] > camPos.x + 1000) pos[i*3] -= 2000;
      if (pos[i*3+2] < camPos.z - 1000) pos[i*3+2] += 2000;
      if (pos[i*3+2] > camPos.z + 1000) pos[i*3+2] -= 2000;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });
  
  if (!active) return null;
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#88ccff" size={1.5} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
};

// Distance from point (x,y) to line segment (x1,y1)-(x2,y2)
const distToSegmentSquared = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const l2 = (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
  if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
};

const DriveableVehicle = ({ active, setSpeed, buildings, roads, startPos, telemetryRef }: { active: boolean, setSpeed: (s: number) => void, buildings: any[], roads: any[], startPos: number[] | null, telemetryRef: any }) => {
  const { camera } = useThree();
  const [keys, setKeys] = useState({ w: false, a: false, s: false, d: false });
  const carRef = useRef<THREE.Group>(null);
  const initialized = useRef(false);
  
  const physics = useRef({
    velocity: 0,
    heading: 0, 
    acceleration: 40,
    friction: 0.98,
    steerSpeed: 2.0,
  });

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if(e.key.toLowerCase()==='w') setKeys(k=>({...k, w:true}));
      if(e.key.toLowerCase()==='a') setKeys(k=>({...k, a:true}));
      if(e.key.toLowerCase()==='s') setKeys(k=>({...k, s:true}));
      if(e.key.toLowerCase()==='d') setKeys(k=>({...k, d:true}));
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if(e.key.toLowerCase()==='w') setKeys(k=>({...k, w:false}));
      if(e.key.toLowerCase()==='a') setKeys(k=>({...k, a:false}));
      if(e.key.toLowerCase()==='s') setKeys(k=>({...k, s:false}));
      if(e.key.toLowerCase()==='d') setKeys(k=>({...k, d:false}));
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    }
  }, [active]);

  useFrame((state, delta) => {
    if (!active || !carRef.current) {
      initialized.current = false;
      return;
    }
    
    // Teleport to start position on first frame of activation
    if (!initialized.current && startPos) {
      let spawnX = startPos[0];
      let spawnZ = startPos[1];
      
      // Intelligent Spawning: Find the closest road coordinate so the car doesn't spawn inside a building
      if (roads && roads.length > 0) {
        let closestDist = Infinity;
        for (let i = 0; i < roads.length; i++) {
          const line = roads[i].line;
          for (let j = 0; j < line.length; j++) {
            const dx = line[j][0] - startPos[0];
            const dz = line[j][1] - startPos[1];
            const dist = dx*dx + dz*dz;
            if (dist < closestDist) {
              closestDist = dist;
              spawnX = line[j][0];
              spawnZ = line[j][1];
            }
          }
        }
      }

      carRef.current.position.set(spawnX, 0.5, spawnZ);
      physics.current.velocity = 0;
      physics.current.heading = 0;
      
      // Instant Camera Snap (bypasses the slow Lerp interpolation)
      const cameraOffset = new THREE.Vector3(0, 4, -14);
      const targetCameraPos = carRef.current.position.clone().add(cameraOffset);
      state.camera.position.copy(targetCameraPos);
      state.camera.lookAt(carRef.current.position.clone().add(new THREE.Vector3(0, 2, 4)));

      initialized.current = true;
    }

    const p = physics.current;
    const maxDelta = Math.min(delta, 0.1); 
    
    if (keys.w) p.velocity += p.acceleration * maxDelta;
    if (keys.s) p.velocity -= p.acceleration * maxDelta;
    p.velocity *= p.friction;
    
    if (Math.abs(p.velocity) > 1) {
      if (keys.a) p.heading += p.steerSpeed * maxDelta * (p.velocity > 0 ? 1 : -1);
      if (keys.d) p.heading -= p.steerSpeed * maxDelta * (p.velocity > 0 ? 1 : -1);
    }
    
    const nextX = carRef.current.position.x + Math.sin(p.heading) * p.velocity * maxDelta;
    const nextZ = carRef.current.position.z + Math.cos(p.heading) * p.velocity * maxDelta;
    
    // Spatial Collision Engine
    let collision = false;
    if (buildings && buildings.length > 0) {
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (Math.abs(b.center[0] - nextX) < 40 && Math.abs(b.center[1] - nextZ) < 40) {
           let inside = false;
           const vs = b.polygon;
           for (let j = 0, k = vs.length - 1; j < vs.length; k = j++) {
             const xj = vs[j][0], zj = vs[j][1];
             const xk = vs[k][0], zk = vs[k][1];
             const intersect = ((zj > nextZ) !== (zk > nextZ)) &&
                 (nextX < (xk - xj) * (nextZ - zj) / ((zk - zj) || 0.0001) + xj);
             if (intersect) inside = !inside;
           }
           if (inside) {
              collision = true;
              break;
           }
        }
      }
    }

    if (collision) {
      p.velocity = -p.velocity * 0.3; 
    } else {
      carRef.current.rotation.y = p.heading;
      carRef.current.position.x = nextX;
      carRef.current.position.z = nextZ;
    }
    carRef.current.position.y = 0.5; 
    
    const currentSpeed = Math.abs(p.velocity);
    setSpeed(currentSpeed);
    
    // Nearest Street Detection (runs every 10 frames approx to save CPU)
    if (Math.floor(state.clock.elapsedTime * 60) % 10 === 0 && roads && roads.length > 0) {
       let closestDist = Infinity;
       let closestName = "Unknown Street";
       
       for (let i = 0; i < roads.length; i++) {
         const r = roads[i];
         if (!r.tags?.name) continue; // Only care about named streets
         
         const bounds = r.bounds;
         if (bounds) {
           // Fast bounding box check (radius 200m)
           if (nextX < bounds.minX - 200 || nextX > bounds.maxX + 200 || 
               nextZ < bounds.minY - 200 || nextZ > bounds.maxY + 200) {
             continue;
           }
         }

         // Check segments
         const line = r.line;
         for (let j = 0; j < line.length - 1; j++) {
           const d = distToSegmentSquared(nextX, nextZ, line[j][0], line[j][1], line[j+1][0], line[j+1][1]);
           if (d < closestDist) {
             closestDist = d;
             closestName = r.tags.name;
           }
         }
       }
       if (closestDist < 10000) { // roughly within 100 meters
         telemetryRef.current.street = closestName;
       } else {
         telemetryRef.current.street = "Off-Road";
       }
    }

    // Update telemetry ref for Live Minimap
    telemetryRef.current.x = nextX;
    telemetryRef.current.z = nextZ;
    telemetryRef.current.heading = p.heading;

    // Dynamic Third-Person Camera
    const cameraOffset = new THREE.Vector3(0, 4, -14);
    cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), p.heading);
    const targetCameraPos = carRef.current.position.clone().add(cameraOffset);
    camera.position.lerp(targetCameraPos, 5 * maxDelta);
    
    const lookAtPos = carRef.current.position.clone().add(new THREE.Vector3(0, 2, 4));
    camera.lookAt(lookAtPos);
  });

  if (!active) return null;

  return (
    <group ref={carRef} position={[0, 0.5, 0]}>
       {/* Car Chassis */}
       <mesh position={[0, 1, 0]}>
         <boxGeometry args={[2.2, 1.2, 5]} />
         <meshStandardMaterial color="#000000" metalness={1} roughness={0.1} />
       </mesh>
       <mesh position={[0, 1.9, -0.5]}>
         <boxGeometry args={[1.8, 0.8, 2.5]} />
         <meshStandardMaterial color="#000000" metalness={1} roughness={0.05} />
       </mesh>
       {/* Neon Tail Lights */}
       <mesh position={[-0.8, 1, -2.51]}>
         <boxGeometry args={[0.6, 0.1, 0.1]} />
         <meshStandardMaterial color="#ff0044" emissive="#ff0044" emissiveIntensity={15} />
       </mesh>
       <mesh position={[0.8, 1, -2.51]}>
         <boxGeometry args={[0.6, 0.1, 0.1]} />
         <meshStandardMaterial color="#ff0044" emissive="#ff0044" emissiveIntensity={15} />
       </mesh>
       {/* Headlights */}
       <spotLight position={[0, 1.2, 2.6]} angle={0.6} penumbra={0.3} intensity={80} distance={300} color="#e0f2fe" castShadow />
       <mesh position={[-0.8, 1, 2.51]}>
         <boxGeometry args={[0.6, 0.2, 0.1]} />
         <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={10} />
       </mesh>
       <mesh position={[0.8, 1, 2.51]}>
         <boxGeometry args={[0.6, 0.2, 0.1]} />
         <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={10} />
       </mesh>
    </group>
  );
};

// ==========================================
// LIVE MINIMAP HUD
// ==========================================
const LiveMinimap = ({ roads, telemetryRef }: { roads: any[], telemetryRef: any }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    let animationFrame: number;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, 200, 200);
      
      const { x, z, heading } = telemetryRef.current;
      const zoom = 0.15; // minimap scale
      
      ctx.save();
      // Center map in canvas
      ctx.translate(100, 100);
      // Rotate map based on car heading (so car always points UP)
      ctx.rotate(-heading);
      // Translate to car position
      ctx.translate(-x * zoom, -z * zoom);

      // Draw Roads
      if (roads) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1.5;
        
        // Optimize: only draw roads relatively close
        for (let i = 0; i < roads.length; i++) {
          const r = roads[i];
          const bounds = r.bounds;
          if (bounds) {
             if (Math.abs(bounds.minX - x) > 1500 && Math.abs(bounds.maxX - x) > 1500) continue;
             if (Math.abs(bounds.minY - z) > 1500 && Math.abs(bounds.maxY - z) > 1500) continue;
          }
          
          ctx.beginPath();
          const line = r.line;
          for (let j = 0; j < line.length; j++) {
            if (j === 0) ctx.moveTo(line[j][0] * zoom, line[j][1] * zoom);
            else ctx.lineTo(line[j][0] * zoom, line[j][1] * zoom);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
      
      // Draw Player Blip (Always centered, pointing UP)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(100, 95);
      ctx.lineTo(95, 105);
      ctx.lineTo(105, 105);
      ctx.fill();

      // Street Name Update (direct DOM manipulation to avoid React re-renders)
      const streetEl = document.getElementById("hud-street-name");
      if (streetEl && telemetryRef.current.street !== streetEl.innerText) {
        streetEl.innerText = telemetryRef.current.street;
      }

      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animationFrame);
  }, [roads, telemetryRef]);

  return <canvas ref={canvasRef} width={200} height={200} className="w-full h-full" />;
};

// ==========================================
// MAIN SCENE
// ==========================================
const LandmarkInfoPanel = ({ landmark, onClose, onStartDriving }: { landmark: any, onClose: () => void, onStartDriving: () => void }) => {
  if (!landmark) return null;
  return (
    <div className="absolute right-6 top-24 w-80 bg-black/70 backdrop-blur-xl border border-white/10 rounded-lg p-6 text-white shadow-2xl z-50 animate-in slide-in-from-right-8 duration-300">
      <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-4">
        <div className={`w-12 h-12 rounded-lg ${
          landmark.category === "ev_station" ? "bg-green-500/20 text-green-400 border border-green-500/30" : 
          "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
        } flex items-center justify-center`}>
          <Building2 size={24} />
        </div>
        <div>
          <h3 className="font-bold text-lg leading-tight">{landmark.name}</h3>
          <p className="text-xs text-gray-400 uppercase tracking-wider">{landmark.category.replace('_', ' ')}</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="bg-white/5 p-3 rounded-lg border border-white/5">
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Status</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
            <span className="text-sm font-semibold text-green-400">Live API Link Active</span>
          </div>
        </div>
        
        {landmark.category === "ev_station" && (
          <>
            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
              <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Operator & Address</div>
              <div className="text-sm font-medium">{landmark.operator}</div>
              <div className="text-xs text-gray-300 mt-1">{landmark.address}</div>
            </div>
            
            <div className="bg-white/5 p-3 rounded-lg border border-white/5">
              <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Available Connections</div>
              <div className="space-y-1">
                {landmark.connections.map((c: string, idx: number) => (
                  <div key={idx} className="text-xs text-green-300 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        
        {landmark.category !== "ev_station" && (
          <div className="bg-white/5 p-3 rounded-lg border border-white/5">
            <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Coordinates (X, Z)</div>
            <div className="text-sm font-mono text-cyan-400">{Math.round(landmark.center[0])}, {Math.round(landmark.center[1])}</div>
          </div>
        )}
      </div> 
      <div className="mt-4 flex gap-2">
        <button 
          onClick={onStartDriving}
          className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded transition-colors text-xs tracking-widest uppercase shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500"
        >
          START DRIVING HERE
        </button>
        <button 
          onClick={onClose}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded transition-colors text-xs font-bold tracking-wider"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};

export const CityStreetViewer = () => {
  const [cityData, setCityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [evStations, setEvStations] = useState<any[]>([]);
  const [isNight, setIsNight] = useState(false);
  const [isRain, setIsRain] = useState(false);
  const [weather, setWeather] = useState<any>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<any>(null);
  const [isDriveMode, setIsDriveMode] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [startPos, setStartPos] = useState<number[] | null>(null);
  const telemetryRef = useRef({ x: 0, z: 0, heading: 0, street: "" });

  useEffect(() => {
    fetch("http://localhost:8001/api/city-data")
      .then(r => r.json())
      .then(data => {
        if (!data.error) setCityData(data);
        setLoading(false);
      })
      .catch(e => { console.error(e); setLoading(false); });

    fetch("http://localhost:8001/api/ev-stations")
      .then(res => res.json())
      .then(data => { if(data.stations) setEvStations(data.stations); })
      .catch(e => console.error(e));

    fetch("http://localhost:8001/api/weather")
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setWeather(data);
          setIsNight(!data.is_day);
          setIsRain(data.weather_code >= 61);
        }
      })
      .catch(e => console.error(e));
  }, []);

  // Global CSS override for full-screen Drive Mode
  useEffect(() => {
    if (isDriveMode) {
      document.body.classList.add('drive-mode');
    } else {
      document.body.classList.remove('drive-mode');
    }
    return () => document.body.classList.remove('drive-mode');
  }, [isDriveMode]);

  // Force extreme cinematic conditions during GTA mode
  const renderNight = isNight || isDriveMode;
  const renderRain = isRain || isDriveMode;
  
  // Adjust lighting for better cinematic visibility
  const sunPos = renderNight ? [-300, -100, -300] : [500, 300, -500]; // Keep sun below horizon at night for Sky
  const lightPos = renderNight ? [-300, 400, -300] : [500, 300, -500]; // Actual directional light source (Moon/Sun)
  const ambientIntensity = renderNight ? 0.3 : (renderRain ? 0.5 : 0.6); // Boosted ambient light
  const dirIntensity = renderNight ? 1.5 : (renderRain ? 0.8 : 1.0); // Bright moonlight
  const skyColor = renderNight ? "#050b14" : (renderRain ? "#475569" : "#e0f2fe"); // Deep realistic blue sky

  return (
    <div className="flex-1 relative w-full h-full" style={{ backgroundColor: skyColor }}>
      <div className="absolute top-0 left-0 w-full p-6 z-10 pointer-events-none flex justify-between">
        <div>
          <div className="text-cyan-400 font-mono text-sm font-bold tracking-widest flex items-center gap-2">
            LAIP <span className="text-xs opacity-50">v1.0.0</span>
            <div className="ml-4 bg-white/10 backdrop-blur border border-white/20 px-3 py-1 rounded text-white text-xs">
              ZEON HUB <span className="bg-cyan-400 text-black px-2 ml-2 rounded font-bold">CITY STREET</span>
            </div>
          </div>
          <div className="text-white/60 text-xs font-mono uppercase tracking-widest mt-1">
            JP Nagar Infrastructure Node
          </div>
          
          {loading && (
            <div className="bg-blue-500/10 text-blue-700 text-xs px-3 py-1.5 rounded-full border border-blue-500/30 backdrop-blur-md inline-flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
              Syncing Massive OSM Drone Data (May take 10s)...
            </div>
          )}

          {weather && (
            <div className="mt-4 flex gap-2">
              <div className="bg-black/40 backdrop-blur border border-white/10 text-white text-xs px-3 py-2 rounded">
                <div className="text-gray-400 text-[10px] uppercase">Live Temp</div>
                <div className="font-bold">{weather.temperature}°C</div>
              </div>
              <div className="bg-black/40 backdrop-blur border border-white/10 text-white text-xs px-3 py-2 rounded">
                <div className="text-gray-400 text-[10px] uppercase">Atmosphere</div>
                <div className="font-bold">{isRain ? "Rain" : (isNight ? "Night" : "Clear")}</div>
              </div>
              <div className="bg-black/40 backdrop-blur border border-white/10 text-white text-xs px-3 py-2 rounded">
                <div className="text-gray-400 text-[10px] uppercase">Live Flights</div>
                <div className="font-bold text-blue-400">OpenSky Active</div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-end pointer-events-auto">
          <div className="flex items-center gap-2 text-xs font-mono text-white/80 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur border border-white/10">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></span>
            System Online
          </div>
        </div>
      </div>

      {!isDriveMode && (
        <button 
          onClick={() => setIsDriveMode(true)}
          className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-500 text-white font-bold px-8 py-3 rounded shadow-[0_0_20px_#dc2626] border border-red-400/50 z-50 animate-pulse tracking-widest uppercase transition-all"
        >
          Enter Vehicle Mode
        </button>
      )}

      {isDriveMode && (
        <div className="fixed inset-0 pointer-events-none z-50 flex flex-col justify-between">
          {/* Cinematic Letterbox Top */}
          <div className="w-full h-24 bg-black"></div>
          
          {/* HUD Center Layer */}
          <div className="flex-1 relative">
            <button 
              onClick={() => setIsDriveMode(false)}
              className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 backdrop-blur text-white px-4 py-2 border border-white/20 rounded pointer-events-auto"
            >
              EXIT VEHICLE
            </button>

            {/* Speedometer */}
            <div className="absolute bottom-6 right-8 flex flex-col items-end">
              <div className="text-[80px] font-mono font-bold leading-none text-transparent bg-clip-text bg-gradient-to-t from-cyan-600 to-cyan-300 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]">
                {Math.floor(speed * 3.6)}
              </div>
              <div className="text-cyan-400 tracking-widest uppercase text-sm font-bold opacity-80 mt-1">KM/H</div>
            </div>

            {/* Minimap Radar */}
            <div className="absolute bottom-6 left-8 flex flex-col items-center">
              <div id="hud-street-name" className="text-white text-sm font-bold tracking-widest uppercase mb-3 bg-black/60 px-4 py-1.5 rounded-full border border-white/20 backdrop-blur drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                Locating...
              </div>
              <div className="w-56 h-56 rounded-full border-4 border-black/80 bg-black/60 shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-md relative">
                <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full m-2 pointer-events-none z-10"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent w-full h-full animate-spin origin-center pointer-events-none z-10" style={{ animationDuration: '4s' }}></div>
                
                {/* Live GPS Map */}
                <div className="absolute inset-0">
                  <LiveMinimap roads={cityData?.roads} telemetryRef={telemetryRef} />
                </div>
              </div>
            </div>
          </div>

          {/* Cinematic Letterbox Bottom */}
          <div className="w-full h-24 bg-black"></div>
        </div>
      )}

      {!isDriveMode && (
        <LandmarkInfoPanel 
          landmark={selectedLandmark} 
          onClose={() => setSelectedLandmark(null)} 
          onStartDriving={() => {
            setStartPos(selectedLandmark.center);
            setSelectedLandmark(null);
            setIsDriveMode(true);
          }}
        />
      )}

      <Canvas onClick={() => setSelectedLandmark(null)} shadows camera={{ position: [0, 800, 1000], fov: 40, far: 500000 }} gl={{ logarithmicDepthBuffer: true }}>
        <color attach="background" args={[skyColor]} />
        
        <Sky 
          sunPosition={sunPos as [number, number, number]} 
          turbidity={renderRain ? 3 : 0.2} 
          rayleigh={renderNight ? 0.1 : (renderRain ? 2 : 0.5)} 
          mieCoefficient={0.005} 
          mieDirectionalG={0.8} 
        />
        <Environment preset={renderNight ? "night" : "city"} />

        <ambientLight intensity={ambientIntensity} color="#ffffff" />
        <directionalLight 
          position={lightPos as [number, number, number]} 
          intensity={dirIntensity} 
          color={renderNight ? "#60a5fa" : "#fffaed"} // Cool moonlight or warm sunlight
          castShadow 
          shadow-mapSize={[4096, 4096]}
          shadow-camera-far={6000}
          shadow-camera-left={-3000}
          shadow-camera-right={3000}
          shadow-camera-top={3000}
          shadow-camera-bottom={-3000}
          shadow-bias={-0.001}
        />
        {/* Soft fill light */}
        <directionalLight position={[-300, 200, 300]} intensity={renderNight ? 0.05 : 0.15} color="#ffffff" />

        <group position={[0, -2, 0]}>
          <DroneMapBase />

          {/* Render Massive Mega-Mesh Map */}
          {cityData && <MergedCityMap buildings={cityData.buildings} roads={cityData.roads} />}

          {/* Render Real Lakes */}
          {cityData?.lakes && <LakesLayer lakes={cityData.lakes} />}

          {/* Render Landmarks UI */}
          {cityData && <LandmarksLayer buildings={cityData.buildings} onSelect={setSelectedLandmark} />}

          {/* Real Trees & Procedural Lush Forest */}
          {cityData?.trees && <RealTrees trees={cityData.trees} />}
          <DenseForest lakes={cityData?.lakes} />

          {/* Streetlights */}
          {cityData?.roads && <StreetlightsLayer roads={cityData.roads} />}

          {/* Project Nolan-Star Driving Features */}
          <DriveableVehicle 
            active={isDriveMode} 
            setSpeed={setSpeed} 
            buildings={cityData?.buildings} 
            roads={cityData?.roads}
            startPos={startPos}
            telemetryRef={telemetryRef}
          />
          <CinematicRain active={renderRain} />

          {/* Dynamic Infrastructure */}
          <EVStationsLayer stations={evStations} onSelect={setSelectedLandmark} />

          {/* Dynamic Traffic Engine (hide if driving to avoid collision glitches) */}
          {!isDriveMode && cityData?.roads && <TrafficEngine roads={cityData.roads} />}
          
          {/* Dynamic Flight Engine */}
          <FlightEngine />
        </group>

        {/* Orbit Controls tuned for massive drone view zooming */}
        <OrbitControls 
          makeDefault={!isDriveMode} 
          enabled={!isDriveMode}
          maxPolarAngle={Math.PI / 2.1} 
          minPolarAngle={Math.PI / 8}
          minDistance={100} 
          maxDistance={25000}
          target={[0, 0, 0]}
        />

        <EffectComposer disableNormalPass multisampling={0}>
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette eskil={false} offset={0.1} darkness={isDriveMode ? 1.2 : 1.0} />
          {isDriveMode && <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} />}
          <N8AO aoRadius={12} intensity={renderNight ? 1.0 : 1.5} color="#0f172a" />
          <Bloom luminanceThreshold={isDriveMode ? 0.3 : (renderNight ? 0.4 : 1.5)} mipmapBlur intensity={isDriveMode ? 1.5 : (renderNight ? 1.0 : 0.05)} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
