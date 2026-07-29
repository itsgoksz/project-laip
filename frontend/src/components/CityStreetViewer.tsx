import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Html, Sky, FlyControls } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, Vignette, ToneMapping, DepthOfField } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { TilesRenderer, TilesPlugin } from '3d-tiles-renderer/r3f';
import { GoogleCloudAuthPlugin, GLTFExtensionsPlugin } from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Building2, Zap, Radio, ChevronsRight, ChevronsLeft } from 'lucide-react';
import { ZeonHubModel } from './ZeonStation3D';
import { RoadGraph } from '../utils/pathfinding';
// ==========================================
// JP NAGAR PHASES (ZONES)
// ==========================================
const LAT_CENTER = 12.905;
const LON_CENTER = 77.590;

export const JPNagarPhases = [
  { name: "1st Phase", lat: 12.915, lon: 77.584, color: "#ef4444" },
  { name: "2nd Phase", lat: 12.910, lon: 77.587, color: "#f97316" },
  { name: "3rd Phase", lat: 12.908, lon: 77.592, color: "#eab308" },
  { name: "4th Phase", lat: 12.905, lon: 77.598, color: "#84cc16" },
  { name: "5th Phase", lat: 12.900, lon: 77.590, color: "#22c55e" },
  { name: "6th Phase", lat: 12.903, lon: 77.585, color: "#10b981" },
  { name: "7th Phase", lat: 12.898, lon: 77.580, color: "#06b6d4" },
  { name: "8th Phase", lat: 12.890, lon: 77.582, color: "#3b82f6" },
  { name: "9th Phase", lat: 12.885, lon: 77.585, color: "#8b5cf6" },
].map((p, index) => {
  const x = (p.lon - LON_CENTER) * 111320 * Math.cos(LAT_CENTER * Math.PI / 180);
  const z = (LAT_CENTER - p.lat) * 111000;
  
  // Create a localized shape boundary for the zone
  const shape = new THREE.Shape();
  const numPoints = 7 + (index % 3); // 7 to 9 points
  const radius = 350 + (index * 20); // roughly 350-500 meters
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const r = radius * (0.7 + Math.abs(Math.sin(index * 13.5 + i * 21.7)) * 0.4); 
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r; // Z in 3D
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  const r0 = radius * (0.7 + Math.abs(Math.sin(index * 13.5)) * 0.4);
  shape.lineTo(Math.cos(0) * r0, Math.sin(0) * r0);
  
  const shapeGeo = new THREE.ShapeGeometry(shape);
  const edgesGeo = new THREE.EdgesGeometry(shapeGeo);

  return { ...p, center: [x, z], shapeGeo, edgesGeo };
});

// ==========================================
// BESCOM POWER GRID MOCK DATA
// Based on BESCOM JP Nagar 66/11kV Distribution Zone
// ==========================================

// These positions are chosen to spread across the map:
// Hub: far south-west open area (large isolated building)
// Sub-Stations: spread across north, south-east, and west clusters
const POWER_GRID_HUB = {
  id: 'bescom-hub-1',
  name: 'BESCOM JP Nagar Receiving Station',
  category: 'main_power_grid',
  // Positioned at a large isolated building (south-west corner of map)
  // These coords will be overridden at runtime by picking a real large building
  center: [-1200, -900] as [number, number],
  details: {
    voltage: '66 kV',
    capacity: '40 MVA',
    loadFactor: '72%',
    feederLines: 6,
    connectedSubstations: 3,
    operator: 'BESCOM (Bangalore Electricity Supply Company)',
    zone: 'JP Nagar Distribution Zone',
    status: 'Operational',
    peakDemand: '28.8 MVA',
    annualUnits: '214 MU',
    transformerRating: '66/11 kV, 2×20 MVA',
  }
};

const POWER_SUBSTATIONS = [
  {
    id: 'bescom-sub-1',
    name: 'BESCOM Sarakki Sub-Station',
    category: 'ev_substation',
    center: [-300, -600] as [number, number],
    evStationIds: [] as string[], // assigned at runtime by proximity
    details: {
      voltage: '11 kV → 415 V',
      capacity: '8 MVA',
      loadFactor: '68%',
      connectedEVStations: 4,
      operator: 'BESCOM',
      feederID: 'JPR-F04',
      transformerRating: '11/0.415 kV, 500 kVA',
      status: 'Operational',
      maxCurrent: '418 A',
    }
  },
  {
    id: 'bescom-sub-2',
    name: 'BESCOM BTM Layout Sub-Station',
    category: 'ev_substation',
    center: [500, 400] as [number, number],
    evStationIds: [] as string[],
    details: {
      voltage: '11 kV → 415 V',
      capacity: '6 MVA',
      loadFactor: '61%',
      connectedEVStations: 3,
      operator: 'BESCOM',
      feederID: 'BTM-F07',
      transformerRating: '11/0.415 kV, 400 kVA',
      status: 'Operational',
      maxCurrent: '315 A',
    }
  },
  {
    id: 'bescom-sub-3',
    name: 'BESCOM Bannerghatta Rd Sub-Station',
    category: 'ev_substation',
    center: [-800, 500] as [number, number],
    evStationIds: [] as string[],
    details: {
      voltage: '11 kV → 415 V',
      capacity: '5 MVA',
      loadFactor: '55%',
      connectedEVStations: 3,
      operator: 'BESCOM',
      feederID: 'BNR-F02',
      transformerRating: '11/0.415 kV, 315 kVA',
      status: 'Operational',
      maxCurrent: '262 A',
    }
  },
];

// --- Static Geometry Components ---

class TilesErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <mesh position={[0, -0.5, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[100000, 100000]} />
          <meshStandardMaterial color="#2f3e27" roughness={1} />
        </mesh>
      );
    }
    return this.props.children;
  }
}

export function wgs84ToECEF(lat: number, lon: number, alt: number): THREE.Vector3 {
  const a = 6378137.0; 
  const eSq = 0.00669437999014;
  const latRad = THREE.MathUtils.degToRad(lat);
  const lonRad = THREE.MathUtils.degToRad(lon);
  
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const N = a / Math.sqrt(1 - eSq * sinLat * sinLat);

  const x = (N + alt) * cosLat * cosLon;
  const y = (N + alt) * cosLat * sinLon;
  const z = (N * (1 - eSq) + alt) * sinLat;
  
  return new THREE.Vector3(x, y, z);
}

const TilesEnvironment = ({ isVisible, lat, lon, alt }: { isVisible: boolean, lat: number, lon: number, alt: number }) => {
  const gl = useThree(state => state.gl);
  
  const dracoLoader = useMemo(() => {
    const loader = new DRACOLoader();
    loader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    return loader;
  }, []);

  const ktx2Loader = useMemo(() => {
    const loader = new KTX2Loader();
    loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/');
    loader.detectSupport(gl);
    return loader;
  }, [gl]);

  const authArgs = useMemo(() => [{ apiToken: "AIzaSyCScW-2xJuAbh-vu69HG6rD3mCwAWizVcs", autoRefreshToken: true }], []);
  const gltfArgs = useMemo(() => [{ dracoLoader, ktxLoader: ktx2Loader, meshoptDecoder: MeshoptDecoder }], [dracoLoader, ktx2Loader]);

  // Calculate inverse transformation matrix to align the city flat plane [0,0,0] with Google Tiles ECEF
  const inverseMatrix = useMemo(() => {
    const centerECEF = wgs84ToECEF(lat, lon, alt);
    const upVector = centerECEF.clone().normalize();
    const northPole = new THREE.Vector3(0, 0, 1);
    const ln = northPole.clone().sub(upVector.clone().multiplyScalar(northPole.dot(upVector))).normalize();
    
    const dummy = new THREE.Object3D();
    dummy.position.copy(centerECEF);
    dummy.up.copy(upVector);
    dummy.lookAt(centerECEF.clone().sub(ln));
    dummy.updateMatrixWorld(true);
    
    return dummy.matrixWorld.clone().invert();
  }, [lat, lon, alt]);

  return (
    <group matrix={inverseMatrix} matrixAutoUpdate={false} visible={isVisible}>
      <TilesErrorBoundary>
        <TilesRenderer url="https://tile.googleapis.com/v1/3dtiles/root.json">
          <TilesPlugin plugin={GoogleCloudAuthPlugin} args={authArgs} />
          <TilesPlugin plugin={GLTFExtensionsPlugin} args={gltfArgs} />
        </TilesRenderer>
      </TilesErrorBoundary>
    </group>
  );
};

const treeMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 });

const buildingMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.1 });
buildingMaterial.userData = { uIsNight: { value: 0 } };
// Procedural Building Shader for windows, floors, and roofs (zero performance cost)
buildingMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uIsNight = buildingMaterial.userData.uIsNight;
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
    `#include <common>\n varying vec3 vWorldPosition;\n varying vec3 vWorldNormal;\n varying float vIsApartment;\n uniform float uIsNight;`
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
         
         if (uIsNight > 0.5) {
             if (randomLight > 0.95) {
                diffuseColor.rgb = vec3(1.0, 0.8, 0.4); 
             } else {
                diffuseColor.rgb *= 0.1;
             }
         } else {
             if (randomLight > 0.6) {
               diffuseColor.rgb = vec3(0.9, 0.9, 0.7); 
             } else {
               diffuseColor.rgb *= 0.2; 
             }
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

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>\n
     if (!isRoof && uIsNight > 0.5) {
       float wx = fract(vWorldPosition.x / 4.0);
       float wz = fract(vWorldPosition.z / 4.0);
       float wy = fract(vWorldPosition.y / 4.0);
       float w = abs(vWorldNormal.x) > 0.5 ? wz : wx;
       if (wy > 0.3 && wy < 0.7 && w > 0.3 && w < 0.7) {
         float randomLight = fract(sin(dot(floor(vWorldPosition.xyz / 4.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
         if (randomLight > 0.95) {
            totalEmissiveRadiance += vec3(1.0, 0.7, 0.2) * 5.0; 
         }
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

const MergedCityMap = ({ buildings }: { buildings: any[], isTransparent: boolean }) => {
  const { buildingGeometry } = useMemo(() => {
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
          for (let i = 0; i < rCount; i++) {
            rCols[i * 3] = 0.9; rCols[i * 3 + 1] = 0.2; rCols[i * 3 + 2] = 0.2; // Red roof
            rApt[i] = 0;
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
        for (let i = 0; i < count; i++) {
          colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
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

    return { buildingGeometry: mergedBuildingGeo };
  }, [buildings]);
  return (
    <group>
      {buildingGeometry && (
        <mesh castShadow={false} receiveShadow={false} geometry={buildingGeometry} material={buildingMaterial} />
      )}
    </group>
  );
};

const roadMaterial = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.1, vertexColors: true });
const roadMaterialHighlighted = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.1, vertexColors: true, emissive: "#ff7f50", emissiveIntensity: 0.5 });
const roadMaterialSelected = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.1, vertexColors: true, emissive: "#fde047", emissiveIntensity: 1.0 });


// Add custom shader for dashed lane lines
const dashedLaneMaterial = new THREE.MeshStandardMaterial({ color: "#fef08a", roughness: 0.8, metalness: 0.1 });
dashedLaneMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = `varying vec2 vDashedUv;\n${shader.vertexShader}`;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
     vDashedUv = uv;`
  );
  shader.fragmentShader = `varying vec2 vDashedUv;\n${shader.fragmentShader}`;
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    `#include <color_fragment>
     if (fract(vDashedUv.x * 20.0) > 0.5) discard;`
  );
};

const RoadsLayer = ({ roads, assetFilters, onFlyTo, onExpand, focusedLandmark }: any) => {
  const isHighlightAll = assetFilters?.roads;
  
  const roadMeshes = useMemo(() => {
    return roads.map((r: any) => {
      if (r.line.length < 2) return null;
      try {
        const pts = r.line.map((pt: number[]) => new THREE.Vector3(pt[0], 0.2, pt[1]));
        const path = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
        const isPrimary = r.type === "primary" || r.type === "secondary" || r.type === "trunk";
        
        const geo = new THREE.TubeGeometry(path, r.line.length * 4, isPrimary ? 6 : 3.5, 4, false);
        geo.scale(1, 0.05, 1);
        geo.translate(0, 0.2, 0);

        const sidewalkGeo = new THREE.TubeGeometry(path, r.line.length * 4, isPrimary ? 7.5 : 4.5, 4, false);
        sidewalkGeo.scale(1, 0.04, 1);
        sidewalkGeo.translate(0, 0.15, 0);
        const sc = new Float32Array(sidewalkGeo.attributes.position.count * 3);
        for (let i = 0; i < sc.length; i += 3) { sc[i] = 0.85; sc[i + 1] = 0.85; sc[i + 2] = 0.85; }
        sidewalkGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));

        const c = new THREE.Color(isPrimary ? "#374151" : "#4b5563");
        const colors = new Float32Array(geo.attributes.position.count * 3);
        for (let i = 0; i < colors.length; i += 3) {
          colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        let laneGeo = null;
        if (isPrimary) {
          laneGeo = new THREE.TubeGeometry(path, r.line.length * 4, 0.4, 4, false);
          laneGeo.scale(1, 0.05, 1);
          laneGeo.translate(0, 0.4, 0);
          const roadLen = path.getLength();
          const uvs = laneGeo.attributes.uv.array as Float32Array;
          for (let i = 0; i < uvs.length; i += 2) {
            uvs[i] = uvs[i] * (roadLen / 10);
          }
        }

        const centerPt = path.getPointAt(0.5);

        return { id: r.id, r, geo, sidewalkGeo, laneGeo, center: centerPt };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }, [roads]);

  return (
    <group>
      {roadMeshes.map((m: any) => {
        const isSelected = focusedLandmark?.id === m.id;
        const mat = isSelected ? roadMaterialSelected : (isHighlightAll ? roadMaterialHighlighted : roadMaterial);
        
        return (
          <group 
            key={m.id}
            onClick={(e) => {
              e.stopPropagation();
              onFlyTo({ center: [m.center.x, m.center.z], y: 150 });
              onExpand({ ...m.r, category: 'road', name: m.r.name || `Unnamed ${m.r.type} road` });
            }}
          >
            <mesh geometry={m.sidewalkGeo} material={mat} />
            <mesh geometry={m.geo} material={mat} />
            {m.laneGeo && <mesh geometry={m.laneGeo} material={dashedLaneMaterial} />}
          </group>
        );
      })}
    </group>
  );
};

// --- Base Environment Layers ---

const CameraController = ({ targetPos, onArrived }: { targetPos: THREE.Vector3 | null, onArrived: () => void }) => {
  const targetLookAt = useRef(new THREE.Vector3());
  const targetCameraPos = useRef(new THREE.Vector3());
  const isAnimating = useRef(false);

  useEffect(() => {
    if (targetPos) {
      targetLookAt.current.set(targetPos.x, 0, targetPos.z);
      const height = targetPos.y > 0 ? targetPos.y : 200;
      const zOffset = targetPos.y > 0 ? targetPos.y * 1.2 : 300;
      targetCameraPos.current.set(targetPos.x, height, targetPos.z + zOffset);
      isAnimating.current = true;
    }
  }, [targetPos]);

  useFrame((state, delta) => {
    if (isAnimating.current && targetPos) {
      state.camera.position.lerp(targetCameraPos.current, 4 * delta);
      if (state.controls) {
        (state.controls as any).target.lerp(targetLookAt.current, 4 * delta);
        (state.controls as any).update();
      }

      if (state.camera.position.distanceTo(targetCameraPos.current) < 5) {
        isAnimating.current = false;
        onArrived();
      }
    }
  });

  return null;
};

// --- Volumetric Zones Layer ---
const ZonesLayer = ({ active, showZones, selectedPhase }: { active: boolean, showZones: boolean, selectedPhase: any }) => {
  if (!active || !showZones) return null;
  
  return (
    <group>
      {JPNagarPhases.map((phase, i) => {
        const isSelected = selectedPhase?.name === phase.name;
        const opacity = isSelected ? 0.35 : 0.08;
        
        return (
          <group key={i} position={[phase.center[0], 0, phase.center[1]]}>
            {/* The Polygon */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]} geometry={phase.shapeGeo}>
              <meshBasicMaterial color={phase.color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            
            {/* The Boundary Line */}
            <lineSegments rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.51, 0]} geometry={phase.edgesGeo}>
              <lineBasicMaterial color={phase.color} transparent opacity={isSelected ? 1.0 : 0.4} linewidth={isSelected ? 3 : 1} />
            </lineSegments>

            <Html position={[0, 45, 0]} center zIndexRange={[100, 0]}>
              <div className={`flex flex-col items-center pointer-events-none transition-all ${isSelected ? 'scale-125' : 'scale-100'}`}>
                <div
                  className="bg-black/60 backdrop-blur-md border p-1.5 px-3 rounded text-white text-center shadow-xl"
                  style={{ borderColor: `${phase.color}${isSelected ? 'ff' : '50'}`, boxShadow: `0 0 15px ${phase.color}${isSelected ? 'aa' : '40'}` }}
                >
                  <div className="text-[12px] font-bold whitespace-nowrap drop-shadow-md" style={{ color: phase.color }}>
                    {phase.name}
                  </div>
                  <div className="text-[7px] text-gray-300 uppercase tracking-widest font-semibold mt-0.5">
                    ZONE BOUNDARY
                  </div>
                </div>
                <div 
                  className={`w-[2px] h-24 mt-0.5 ${isSelected ? 'animate-pulse' : ''}`} 
                  style={{ background: `linear-gradient(to bottom, ${phase.color}${isSelected ? 'ff' : 'cc'}, transparent)`, filter: `drop-shadow(0 0 5px ${phase.color})` }}
                ></div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};

const getCategoryColor = (cat: string) => {
  if (cat === "mall" || cat === "commercial") return { text: "text-cyan-400", bg: "bg-cyan-500/20", border: "border-cyan-500/30", shadow: "shadow-[0_0_5px_rgba(34,211,238,0.8)]", hex: "#22d3ee", hexShadow: "drop-shadow(0 0 5px #22d3ee)" };
  if (cat === "hospital") return { text: "text-red-500", bg: "bg-red-500/20", border: "border-red-500/30", shadow: "shadow-[0_0_5px_rgba(239,68,68,0.8)]", hex: "#ef4444", hexShadow: "drop-shadow(0 0 5px #ef4444)" };
  if (cat === "restaurant" || cat === "cafe" || cat === "fast_food") return { text: "text-rose-400", bg: "bg-rose-500/20", border: "border-rose-500/30", shadow: "shadow-[0_0_5px_rgba(251,113,133,0.8)]", hex: "#fb7185", hexShadow: "drop-shadow(0 0 5px #fb7185)" };
  if (cat === "apartments" || cat === "residential") return { text: "text-indigo-400", bg: "bg-indigo-500/20", border: "border-indigo-500/30", shadow: "shadow-[0_0_5px_rgba(129,140,248,0.8)]", hex: "#818cf8", hexShadow: "drop-shadow(0 0 5px #818cf8)" };
  // default / ev_station
  return { text: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30", shadow: "shadow-[0_0_5px_rgba(34,197,94,0.8)]", hex: "#4ade80", hexShadow: "drop-shadow(0 0 5px #4ade80)" };
};

const LandmarkMarker = ({ st, onFlyTo, onExpand }: { st: any, onFlyTo: (st: any) => void, onExpand: (st: any) => void }) => {
  const { camera } = useThree();
  const colorObj = getCategoryColor(st.category);

  const handleClick = (e: any) => {
    e.stopPropagation();
    const stPos = new THREE.Vector3(st.center[0], 0, st.center[1]);
    const targetCamPos = new THREE.Vector3(stPos.x, 200, stPos.z + 300);
    const dist = camera.position.distanceTo(targetCamPos);

    if (dist > 80) {
      onFlyTo(st);
    } else {
      onExpand(st);
    }
  };

  return (
    <Html position={[0, 45, 0]} center zIndexRange={[100, 0]}>
      <div className="flex flex-col items-center">
        <div
          onClick={handleClick}
          className="bg-black/30 backdrop-blur-sm border border-white/20 p-1 px-2 rounded cursor-pointer pointer-events-auto hover:bg-black/50 transition-all text-white min-w-[70px] text-center shadow-xl group"
          title={st.name}
        >
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Building2 size={8} className={`${colorObj.text} drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]`} />
            <div className="text-[10px] font-bold whitespace-nowrap">{st.name}</div>
          </div>
          <div className={`text-[7px] ${colorObj.text} uppercase tracking-widest font-semibold`}>{st.category.replace('_', ' ')}</div>
        </div>
        <div className="w-[2px] h-20 mt-0.5" style={{ background: `linear-gradient(to bottom, ${colorObj.hex}cc, transparent)`, filter: colorObj.hexShadow }}></div>
      </div>
    </Html>
  );
};

// Power grid category colors
const getPowerGridColor = (cat: string) => {
  if (cat === 'main_power_grid') return {
    text: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30',
    shadow: 'shadow-[0_0_5px_rgba(239,68,68,0.8)]', hex: '#ef4444', hexShadow: 'drop-shadow(0 0 6px #ef4444)'
  };
  // ev_substation
  return {
    text: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30',
    shadow: 'shadow-[0_0_5px_rgba(234,179,8,0.8)]', hex: '#eab308', hexShadow: 'drop-shadow(0 0 6px #eab308)'
  };
};

// Reuses exact same visual style as LandmarkMarker but with power grid icon/colors
const PowerGridMarker = ({ node, onFlyTo, onExpand }: { node: any, onFlyTo: (n: any) => void, onExpand: (n: any) => void }) => {
  const { camera } = useThree();
  const colorObj = getPowerGridColor(node.category);
  const isHub = node.category === 'main_power_grid';
  const Icon = isHub ? Zap : Radio;

  const handleClick = (e: any) => {
    e.stopPropagation();
    const stPos = new THREE.Vector3(node.center[0], 0, node.center[1]);
    const targetCamPos = new THREE.Vector3(stPos.x, 200, stPos.z + 300);
    const dist = camera.position.distanceTo(targetCamPos);
    if (dist > 80) {
      onFlyTo(node);
    } else {
      onExpand(node);
    }
  };

  const labelText = isHub ? 'Main Power Grid' : 'EV Sub-Station';

  return (
    <Html position={[0, isHub ? 80 : 60, 0]} center zIndexRange={[200, 0]}>
      <div className="flex flex-col items-center">
        <div
          onClick={handleClick}
          className={`bg-black/40 backdrop-blur-sm border ${colorObj.border} p-1 px-2 rounded cursor-pointer pointer-events-auto hover:bg-black/60 transition-all text-white min-w-[80px] text-center shadow-xl ${colorObj.shadow}`}
          title={node.name}
        >
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Icon size={8} className={colorObj.text} />
            <div className="text-[10px] font-bold whitespace-nowrap">{node.name}</div>
          </div>
          <div className={`text-[7px] ${colorObj.text} uppercase tracking-widest font-semibold`}>{labelText}</div>
        </div>
        <div className="w-[2px] mt-0.5" style={{ height: isHub ? '100px' : '80px', background: `linear-gradient(to bottom, ${colorObj.hex}ee, transparent)`, filter: colorObj.hexShadow }}></div>
      </div>
    </Html>
  );
};

// Expanded panel for power grid nodes (Hub / Sub-Station)
const PowerGridExpandedPanel = ({ node, onClose }: { node: any, onClose: () => void }) => {
  if (!node) return null;
  const colorObj = getPowerGridColor(node.category);
  const isHub = node.category === 'main_power_grid';
  const Icon = isHub ? Zap : Radio;
  const d = node.details;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-[9999] bg-black/40 backdrop-blur-sm">
      <div className="w-[480px] bg-gray-900/90 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-white shadow-2xl pointer-events-auto relative">
        {/* Header */}
        <div className={`flex items-center gap-4 mb-6 border-b border-white/10 pb-6`}>
          <div className={`w-16 h-16 rounded-xl ${colorObj.bg} ${colorObj.text} border ${colorObj.border} flex items-center justify-center ${colorObj.shadow}`}>
            <Icon size={32} />
          </div>
          <div>
            <h3 className="font-bold text-2xl leading-tight">{node.name}</h3>
            <p className={`text-sm ${colorObj.text} uppercase tracking-wider mt-1`}>{isHub ? 'Main Power Grid Hub' : 'EV Sub-Station'}</p>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-4">
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-1.5">Status</div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            <span className="text-base font-semibold text-green-400">{d.status} — BESCOM Grid Live</span>
          </div>
        </div>

        {/* Grid data */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Voltage</div>
            <div className={`text-lg font-bold ${colorObj.text}`}>{d.voltage}</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Capacity</div>
            <div className={`text-lg font-bold ${colorObj.text}`}>{d.capacity}</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Load Factor</div>
            <div className="text-lg font-bold text-white">{d.loadFactor}</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">
              {isHub ? 'Connected Sub-Stations' : 'Connected EV Stations'}
            </div>
            <div className="text-lg font-bold text-white">
              {isHub ? d.connectedSubstations : d.connectedEVStations}
            </div>
          </div>
          {isHub && (
            <>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Feeder Lines</div>
                <div className="text-lg font-bold text-white">{d.feederLines}</div>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Peak Demand</div>
                <div className="text-lg font-bold text-white">{d.peakDemand}</div>
              </div>
            </>
          )}
          {!isHub && (
            <>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Feeder ID</div>
                <div className="text-lg font-bold text-white">{d.feederID}</div>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Max Current</div>
                <div className="text-lg font-bold text-white">{d.maxCurrent}</div>
              </div>
            </>
          )}
        </div>

        {/* Transformer / Operator */}
        <div className="bg-white/5 p-3 rounded-xl border border-white/10 mb-6">
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Transformer Rating</div>
          <div className="text-sm font-medium">{d.transformerRating}</div>
          <div className="text-xs text-gray-400 mt-1">{d.operator || 'BESCOM'}</div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-bold tracking-wider border border-white/20"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};

// Animated electricity flow along a curve
const ElectricityPipeline = ({ points, color, particleColor, isHub }: { points: THREE.Vector3[], color: string, particleColor: string, isHub: boolean }) => {
  const particleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const PARTICLE_COUNT = 18;
  const offsets = useMemo(() => Array.from({ length: PARTICLE_COUNT }, (_, i) => i / PARTICLE_COUNT), []);
  const progressRef = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT).map((_, i) => i / PARTICLE_COUNT));
  const tubeRef = useRef<THREE.Mesh>(null);

  const curve = useMemo(() => {
    if (points.length < 2) return null;

    // Use the actual path points
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
  }, [points, isHub]);

  const tubeGeo = useMemo(() => {
    if (!curve) return null;
    return new THREE.TubeGeometry(curve, 40, isHub ? 1.8 : 1.0, 8, false);
  }, [curve, isHub]);

  const outerTubeGeo = useMemo(() => {
    if (!curve) return null;
    return new THREE.TubeGeometry(curve, 40, isHub ? 2.2 : 1.3, 12, false);
  }, [curve, isHub]);

  useFrame((_, delta) => {
    if (!curve) return;
    const speed = isHub ? 0.18 : 0.28;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      progressRef.current[i] = (progressRef.current[i] + speed * delta) % 1.0;
      const mesh = particleRefs.current[i];
      if (mesh) {
        const pt = curve.getPointAt(progressRef.current[i]);
        mesh.position.copy(pt);
      }
    }
  });

  if (!curve || !tubeGeo) return null;

  return (
    <group>
      {/* Glowing pipe */}
      <mesh ref={tubeRef} geometry={tubeGeo}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHub ? 2.5 : 1.8}
          transparent
          opacity={isHub ? 0.65 : 0.55}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer Industrial Exoskeleton */}
      {outerTubeGeo && (
        <mesh geometry={outerTubeGeo}>
          <meshStandardMaterial
            color="#94a3b8"
            metalness={0.8}
            roughness={0.3}
            wireframe={true}
            transparent
            opacity={0.4}
          />
        </mesh>
      )}

      {/* Flowing electricity particles */}
      {offsets.map((_, i) => (
        <mesh
          key={i}
          ref={el => { particleRefs.current[i] = el; }}
        >
          <sphereGeometry args={[isHub ? 2.5 : 1.8, 6, 6]} />
          <meshStandardMaterial
            color={particleColor}
            emissive={particleColor}
            emissiveIntensity={isHub ? 12 : 8}
            transparent
            opacity={0.9}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// Full EV Simulation overlay layer
const EVSimulationLayer = ({ evStations, buildings, roads, onFlyTo, onExpand, focusedNode }: {
  evStations: any[],
  buildings: any[],
  roads?: any[],
  onFlyTo: (n: any) => void,
  onExpand: (n: any) => void,
  focusedNode: any,
}) => {

  // Trigger wide view zoom on mount (once)
  useEffect(() => {
    onFlyTo({ center: [0, 0], y: 2500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use static buildings for the Hub and sub-stations
  const { hub, substations, evToSubMap } = useMemo(() => {
    if (!buildings || buildings.length === 0 || evStations.length === 0) {
      return { hub: null, substations: [], evToSubMap: {} };
    }

    const validBuildings = buildings.filter(b => b.height > 10 && b.name && b.center);
    if (validBuildings.length === 0) return { hub: null, substations: [], evToSubMap: {} };

    // Pick deterministic buildings
    const hubBuilding = validBuildings[Math.min(50, validBuildings.length - 1)];
    const hubNode = {
      ...POWER_GRID_HUB,
      center: hubBuilding.center as [number, number],
      height: hubBuilding.height,
    };

    const chosenSubs = [
      validBuildings[Math.min(100, validBuildings.length - 1)],
      validBuildings[Math.min(250, validBuildings.length - 1)],
      validBuildings[Math.min(400, validBuildings.length - 1)]
    ].filter((b, i, a) => b && b.id !== hubBuilding.id && a.findIndex(x => x.id === b.id) === i);

    // Fill to 3 if needed
    let idx = 0;
    while (chosenSubs.length < 3 && idx < validBuildings.length) {
      const b = validBuildings[idx++];
      if (b.id !== hubBuilding.id && !chosenSubs.find(s => s.id === b.id)) {
        chosenSubs.push(b);
      }
    }

    const subNodes = POWER_SUBSTATIONS.slice(0, chosenSubs.length).map((sub, i) => ({
      ...sub,
      center: chosenSubs[i].center as [number, number],
      height: chosenSubs[i].height,
    }));

    // Assign each EV station to its closest sub-station
    const evToSubMap: Record<string, number> = {};
    evStations.forEach(ev => {
      let closestIdx = 0;
      let closestDist = Infinity;
      subNodes.forEach((sub, i) => {
        const dx = ev.center[0] - sub.center[0];
        const dz = ev.center[1] - sub.center[1];
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
      });
      evToSubMap[ev.id] = closestIdx;
    });

    return { hub: hubNode, substations: subNodes, evToSubMap };
  }, [buildings, evStations]);

  const roadGraph = useMemo(() => {
    return roads ? RoadGraph.buildFromRoads(roads) : new RoadGraph();
  }, [roads]);

  if (!hub) return null;

  const hubPos = new THREE.Vector3(hub.center[0], 12, hub.center[1]);

  return (
    <group>
      {/* Hub glow pillar */}
      <mesh position={[hub.center[0], 50, hub.center[1]]}>
        <cylinderGeometry args={[2, 2, 100, 8]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={3} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Hub marker */}
      <group position={[hub.center[0], 0, hub.center[1]]}>
        {focusedNode?.id === hub.id && (
          <mesh position={[0, (hub.height || 30) / 2, 0]}>
            <boxGeometry args={[50, (hub.height || 30) + 15, 50]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2} wireframe transparent opacity={0.5} />
          </mesh>
        )}
        <PowerGridMarker node={hub} onFlyTo={onFlyTo} onExpand={onExpand} />
      </group>

      {/* Hub → Sub-Station pipelines */}
      {substations.map((sub) => {
        const path = roadGraph.findShortestPath(hubPos.x, hubPos.z, sub.center[0], sub.center[1]);
        const undergroundPath = path.map(p => new THREE.Vector3(p.x, -2, p.z));
        return (
          <ElectricityPipeline
            key={`hub-${sub.id}`}
            points={undergroundPath}
            color="#ef4444"
            particleColor="#fca5a5"
            isHub={true}
          />
        );
      })}

      {/* Sub-stations */}
      {substations.map((sub, subIdx) => {
        const subPos = new THREE.Vector3(sub.center[0], 12, sub.center[1]);
        const myEVStations = evStations.filter(ev => evToSubMap[ev.id] === subIdx);
        const colorObj = getPowerGridColor(sub.category);

        return (
          <group key={sub.id}>
            {/* Sub-station glow pillar */}
            <mesh position={[sub.center[0], 35, sub.center[1]]}>
              <cylinderGeometry args={[1.2, 1.2, 70, 8]} />
              <meshStandardMaterial color={colorObj.hex} emissive={colorObj.hex} emissiveIntensity={2.5} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>

            {/* Sub-station marker */}
            <group position={[sub.center[0], 0, sub.center[1]]}>
              {focusedNode?.id === sub.id && (
                <mesh position={[0, (sub.height || 20) / 2, 0]}>
                  <boxGeometry args={[40, (sub.height || 20) + 12, 40]} />
                  <meshStandardMaterial color={colorObj.hex} emissive={colorObj.hex} emissiveIntensity={2} wireframe transparent opacity={0.5} />
                </mesh>
              )}
              <PowerGridMarker node={sub} onFlyTo={onFlyTo} onExpand={onExpand} />
            </group>

            {/* Sub-Station → EV Station pipelines */}
            {myEVStations.map(ev => {
              const path = roadGraph.findShortestPath(subPos.x, subPos.z, ev.center[0], ev.center[1]);
              const undergroundPath = path.map(p => new THREE.Vector3(p.x, -2, p.z));
              return (
                <ElectricityPipeline
                  key={`sub-${sub.id}-ev-${ev.id}`}
                  points={undergroundPath}
                  color="#eab308"
                  particleColor="#fde047"
                  isHub={false}
                />
              );
            })}
          </group>
        );
      })}
    </group>
  );
};

const EVStationsLayer = ({ stations, roads, onFlyTo, onExpand, focusedLandmark, assetFilters }: { stations: any[], roads?: any[], onFlyTo: (st: any) => void, onExpand: (st: any) => void, focusedLandmark: any, assetFilters?: any }) => {
  const visibleStations = useMemo(() => {
    if (!assetFilters || assetFilters.all || assetFilters.evStations) {
       return stations.map(st => {
         if (!roads || roads.length === 0) return { ...st, renderPos: st.center, rotation: 0 };
         
         let minDist = Infinity;
         let bestPt = st.center;
         let bestNormal = [1, 0];
         
         // Find closest point on any road segment
         roads.forEach(r => {
           if (r.line && r.line.length >= 2) {
             for (let i = 0; i < r.line.length - 1; i++) {
               const p1 = r.line[i];
               const p2 = r.line[i+1];
               
               const vx = p2[0] - p1[0];
               const vy = p2[1] - p1[1];
               const lenSq = vx*vx + vy*vy;
               if (lenSq === 0) continue;
               
               // Project st.center onto p1->p2
               const t = Math.max(0, Math.min(1, ((st.center[0] - p1[0]) * vx + (st.center[1] - p1[1]) * vy) / lenSq));
               
               // Closest point on segment
               const cx = p1[0] + t * vx;
               const cy = p1[1] + t * vy;
               
               const dist = Math.hypot(st.center[0] - cx, st.center[1] - cy);
               
               if (dist < minDist) {
                 minDist = dist;
                 bestPt = [cx, cy];
                 
                 // Normal vector (normalized)
                 const len = Math.sqrt(lenSq);
                 // We have two normals: (-vy, vx) and (vy, -vx). 
                 // Pick the one that points TOWARDS the station's original position, 
                 // or if it's exactly on the road, just pick one.
                 let nx = -vy / len;
                 let ny = vx / len;
                 
                 // If station is not exactly on the line, ensure normal points to the side where the station is
                 if (dist > 0.1) {
                   const sx = st.center[0] - cx;
                   const sy = st.center[1] - cy;
                   if (nx * sx + ny * sy < 0) {
                     nx = -nx;
                     ny = -ny;
                   }
                 }
                 
                 bestNormal = [nx, ny];
               }
             }
           }
         });
         
         // Place exactly 9.0 units away from road center along the normal
         const renderPos = [
           bestPt[0] + bestNormal[0] * 9.0,
           bestPt[1] + bestNormal[1] * 9.0
         ];
         
         // Rotate to face the road. 
         // If normal is (nx, ny) pointing FROM road TO station,
         // The vector from station TO road is (-nx, -ny).
         // atan2 takes (x, z) meaning (x, y) here.
         const rotation = Math.atan2(-bestNormal[0], -bestNormal[1]);
         
         return { ...st, renderPos, rotation };
       });
    }
    return [];
  }, [stations, roads, assetFilters]);

  if (!visibleStations || visibleStations.length === 0) return null;

  return (
    <group>
      {visibleStations.map(st => {
        const numChargers = Math.max(1, st.connections.length);
        const isFocused = focusedLandmark?.id === st.id;

        return (
          <group key={st.id} position={[st.renderPos[0], 0.5, st.renderPos[1]]}>
            {/* Holographic Glowing Pillar for visibility from afar */}
            <mesh position={[0, isFocused ? 30 : 20, 0]}>
              <cylinderGeometry args={[isFocused ? 1.5 : 0.5, isFocused ? 1.5 : 0.5, isFocused ? 60 : 40, 8]} />
              <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={isFocused ? 5 : 2} transparent opacity={isFocused ? 0.6 : 0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            {isFocused && (
              <mesh position={[0, 15, 0]}>
                <boxGeometry args={[40, 50, 40]} />
                <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} wireframe transparent opacity={0.6} />
              </mesh>
            )}

            <ZeonHubModel numChargers={numChargers} scale={[2, 2, 2]} rotation={[0, st.rotation, 0]} />

            {/* Interactive Floating Box */}
            <group position={[0, 9, 0]}>
               <LandmarkMarker st={st} onFlyTo={onFlyTo} onExpand={onExpand} />
            </group>
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

const LandmarksLayer = ({ buildings, onFlyTo, onExpand, focusedLandmark, assetFilters }: { buildings: any[], onFlyTo: (b: any) => void, onExpand: (b: any) => void, focusedLandmark: any, assetFilters?: any }) => {
  const landmarks = useMemo(() => buildings.filter(b => {
    if (!b.name) return false;

    const isKnown = (b.category === "mall" || b.category === "hospital" || b.category === "apartments" || b.category === "restaurant" || b.category === "cafe" || b.category === "fast_food");
    if (!assetFilters || assetFilters.all) return isKnown;

    if (assetFilters.apartments && (b.category === "apartments" || b.category === "residential")) return true;
    if (assetFilters.hospital && b.category === "hospital") return true;
    if (assetFilters.restaurants && (b.category === "restaurant" || b.category === "cafe" || b.category === "fast_food")) return true;

    return false;
  }), [buildings, assetFilters]);
  return (
    <group>
      {landmarks.map(b => {
        const isFocused = focusedLandmark?.id === b.id;
        const colorObj = getCategoryColor(b.category);
        return (
          <group key={b.id} position={[b.center[0], 0, b.center[1]]}>
            {isFocused && (
              <mesh position={[0, b.height / 2, 0]}>
                <boxGeometry args={[40, b.height + 10, 40]} />
                <meshStandardMaterial color={colorObj.hex} emissive={colorObj.hex} emissiveIntensity={2} wireframe transparent opacity={0.6} />
              </mesh>
            )}
            <LandmarkMarker st={b} onFlyTo={onFlyTo} onExpand={onExpand} />
          </group>
        );
      })}
    </group>
  );
};

const RealTrees = ({ trees }: { trees: number[][], isTransparent: boolean }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (meshRef.current) {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      trees.forEach((t, i) => {
        dummy.position.set(t[0], 0, t[1]); // Ground the trees properly
        dummy.scale.setScalar(1 + Math.random() * 3);
        dummy.rotation.set(Math.random() * 0.2, Math.random() * Math.PI, Math.random() * 0.2);
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
    <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, trees.length]} castShadow={false} receiveShadow={false} material={treeMaterial}>
      <sphereGeometry args={[2, 7, 7]} />
    </instancedMesh>
  );
};

// Procedural dense forest to fill in the gaps and simulate Bangalore's lush canopy
const DenseForest = ({ lakes }: { lakes?: any[], isTransparent: boolean }) => {
  const count = 15000; // Massive canopy
  const meshRef1 = useRef<THREE.InstancedMesh>(null);
  const meshRef2 = useRef<THREE.InstancedMesh>(null);
  const meshRef3 = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (meshRef1.current && meshRef2.current && meshRef3.current) {
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      let i1 = 0, i2 = 0, i3 = 0;
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
        dummy.rotation.set(Math.random() * 0.2, Math.random() * Math.PI, Math.random() * 0.2);
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
      <instancedMesh ref={meshRef1} args={[undefined as any, undefined as any, Math.ceil(count / 3)]} castShadow={false} receiveShadow={false} material={treeMaterial}>
        <sphereGeometry args={[2, 7, 7]} />
      </instancedMesh>
      <instancedMesh ref={meshRef2} args={[undefined as any, undefined as any, Math.ceil(count / 3)]} castShadow={false} receiveShadow={false} material={treeMaterial}>
        <sphereGeometry args={[1.5, 6, 6]} />
      </instancedMesh>
      <instancedMesh ref={meshRef3} args={[undefined as any, undefined as any, Math.ceil(count / 3)]} castShadow={false} receiveShadow={false} material={treeMaterial}>
        <sphereGeometry args={[2.5, 8, 8]} />
      </instancedMesh>
    </group>
  );
};

const StreetlightsLayer = ({ roads, isNight }: { roads: any[], isNight: boolean }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);

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
      if (count === 0) return;
      for (let i = 0; i <= count; i++) {
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
        if (glowRef.current) {
          dummy.position.y = 5;
          dummy.scale.setScalar(isNight ? 1 : 0.001); // hide glow during day
          dummy.updateMatrix();
          glowRef.current!.setMatrixAt(i, dummy.matrix);
          dummy.scale.setScalar(1);
        }
        dummy.position.y = 2.5; // Pole center
        dummy.updateMatrix();
        poleRef.current!.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      poleRef.current.instanceMatrix.needsUpdate = true;
      if (glowRef.current) glowRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [points, isNight]);

  if (points.length === 0) return null;
  return (
    <group>
      {/* Bulb */}
      <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, points.length]}>
        <sphereGeometry args={[0.7, 8, 8]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={isNight ? 20 : 3} toneMapped={false} />
      </instancedMesh>
      {/* Glow halo at night */}
      <instancedMesh ref={glowRef} args={[undefined as any, undefined as any, points.length]}>
        <sphereGeometry args={[4, 8, 8]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={2} transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      {/* Pole */}
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

  useFrame((_, delta) => {
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
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2, 2, 16, 8]} />
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
        .catch(() => { });
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

const CinematicRain = ({ active, intensity = 5 }: { active: boolean, intensity?: number }) => {
  const count = active ? Math.min(10000, Math.floor(intensity * 600)) : 0;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef<Float32Array>(new Float32Array(10000).map(() => Math.random()));

  const basePositions = useMemo(() => {
    return Array.from({ length: 10000 }, () => ({
      ox: (Math.random() - 0.5) * 1200,
      oz: (Math.random() - 0.5) * 1200,
      speed: 180 + Math.random() * 120,
      height: 300 + Math.random() * 200,
    }));
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!active || !meshRef.current) return;
    const camX = state.camera.position.x;
    const camZ = state.camera.position.z;

    for (let i = 0; i < count; i++) {
      const b = basePositions[i];
      progressRef.current[i] += b.speed * delta;
      if (progressRef.current[i] > b.height) progressRef.current[i] = 0;

      const y = b.height - progressRef.current[i];
      const x = camX + b.ox;
      const z = camZ + b.oz;

      dummy.position.set(x, y, z);
      dummy.scale.set(0.06, 2.5 + Math.random() * 0.5, 0.06);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!active) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, count]}>
      <cylinderGeometry args={[1, 1, 1, 3]} />
      <meshStandardMaterial
        color="#a5d8f7"
        emissive="#a5d8f7"
        emissiveIntensity={1.5}
        transparent
        opacity={0.55}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
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
      if (e.key.toLowerCase() === 'w') setKeys(k => ({ ...k, w: true }));
      if (e.key.toLowerCase() === 'a') setKeys(k => ({ ...k, a: true }));
      if (e.key.toLowerCase() === 's') setKeys(k => ({ ...k, s: true }));
      if (e.key.toLowerCase() === 'd') setKeys(k => ({ ...k, d: true }));
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'w') setKeys(k => ({ ...k, w: false }));
      if (e.key.toLowerCase() === 'a') setKeys(k => ({ ...k, a: false }));
      if (e.key.toLowerCase() === 's') setKeys(k => ({ ...k, s: false }));
      if (e.key.toLowerCase() === 'd') setKeys(k => ({ ...k, d: false }));
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
            const dist = dx * dx + dz * dz;
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
          const d = distToSegmentSquared(nextX, nextZ, line[j][0], line[j][1], line[j + 1][0], line[j + 1][1]);
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

const EVSimulationPanel = ({ landmark }: { landmark: any }) => {
  const [simData, setSimData] = useState({ progress: 50, scenario: "Peak Load Test" });
  
  useEffect(() => {
    const handleProgress = (e: any) => {
      if (e.detail && typeof e.detail === 'object' && e.detail.progress !== undefined) {
        setSimData(e.detail);
      } else if (typeof e.detail === 'number') {
        setSimData({ progress: e.detail, scenario: "Peak Load Test" });
      }
    };
    window.addEventListener('sim-progress', handleProgress);
    return () => window.removeEventListener('sim-progress', handleProgress);
  }, []);

  const idHash = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < landmark.id.length; i++) hash += landmark.id.charCodeAt(i);
    return hash;
  }, [landmark.id]);
  
  const timeOffset = (idHash % 20) - 10;
  const hour = (simData.progress / 100) * 24;
  
  const morningPeak = Math.exp(-Math.pow(hour - (9 + timeOffset/10), 2) / 4);
  const eveningPeak = Math.exp(-Math.pow(hour - (18 + timeOffset/10), 2) / 4);
  const baseTraffic = 0.1 + (idHash % 10) / 100;
  
  const totalCapacity = landmark.connections ? landmark.connections.length : 2;
  
  // Traffic Reduction for Summer Solar Holiday
  let trafficLevel = morningPeak + eveningPeak + baseTraffic;
  if (simData.scenario === "Summer Solar Holiday") {
    trafficLevel *= 0.75; // 25% traffic reduction
  }
  
  // Multiply by 2 to simulate multiple cars per charger during peak hours
  const carsAtStation = Math.floor(trafficLevel * totalCapacity * 2.0);
  const activeSessions = Math.min(carsAtStation, totalCapacity);
  const queueLength = carsAtStation > totalCapacity ? carsAtStation - totalCapacity : 0;
  const waitTimeMins = activeSessions > 0 ? Math.round((queueLength * 30) / activeSessions) : 0;
  const totalPowerDraw = activeSessions * (40 + (idHash % 20));

  // Solar Generation Logic (Peaks heavily around 1 PM)
  let solarPower = 0;
  if (simData.scenario === "Summer Solar Holiday") {
    const solarCurve = Math.exp(-Math.pow(hour - 13, 2) / 8);
    // Assuming each charger spot has 20kW of solar capacity roof
    solarPower = Math.round(solarCurve * (totalCapacity * 20));
  }
  
  const gridDraw = Math.max(0, totalPowerDraw - solarPower);

  return (
    <div className="bg-black/40 p-4 rounded-xl border border-green-500/30 shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]">
      <div className="text-xs text-green-400 uppercase tracking-widest mb-3 flex items-center justify-between font-bold">
        <div className="flex items-center gap-2">
          <Zap size={14} className={activeSessions > 0 ? "animate-pulse" : ""} /> Live Simulation Data
        </div>
        <div className="text-[9px] bg-green-500/20 px-2 py-0.5 rounded text-green-300">{simData.scenario}</div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
           <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Active Chargers</div>
           <div className="text-xl font-bold text-white">{activeSessions} <span className="text-sm text-gray-500 font-normal">/ {totalCapacity}</span></div>
        </div>
        <div>
           <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Queue Wait Time</div>
           <div className={`text-xl font-bold ${queueLength > 0 ? 'text-orange-400' : 'text-green-400'}`}>
             {queueLength > 0 ? `~${waitTimeMins} mins` : 'No Wait'}
           </div>
        </div>
        <div>
           <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Vehicles Waiting</div>
           <div className="text-xl font-bold text-white">{queueLength} <span className="text-sm text-gray-500 font-normal">cars</span></div>
        </div>
        <div>
           <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Grid Power Draw</div>
           <div className="text-xl font-mono text-cyan-400">{gridDraw} <span className="text-sm text-gray-500 font-sans">kW</span></div>
        </div>
        {simData.scenario === "Summer Solar Holiday" && (
          <div className="col-span-2 mt-2 pt-3 border-t border-white/10">
             <div className="flex justify-between items-center">
               <div className="text-[10px] text-yellow-400 uppercase tracking-wider flex items-center gap-1">
                 <svg className="w-3 h-3 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                 Solar Power Generation
               </div>
               <div className="text-lg font-mono text-yellow-400">+{solarPower} <span className="text-xs text-yellow-500/70 font-sans">kW</span></div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ExpandedLandmarkPanel = ({ landmark, onClose, onStartDriving }: { landmark: any, onClose: () => void, onStartDriving: () => void }) => {
  if (!landmark) return null;
  const colorObj = getCategoryColor(landmark.category);
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-[9999] bg-black/40 backdrop-blur-sm">
      <div className="w-[450px] bg-gray/75 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-white shadow-2xl pointer-events-auto animate-in zoom-in-95 duration-300 relative">
        <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-6">
          <div className={`w-16 h-16 rounded-xl ${colorObj.bg} ${colorObj.text} border ${colorObj.border} flex items-center justify-center ${colorObj.shadow}`}>
            <Building2 size={32} />
          </div>
          <div>
            <h3 className="font-bold text-2xl leading-tight">{landmark.name}</h3>
            <p className={`text-sm ${colorObj.text} uppercase tracking-wider mt-1`}>{landmark.category.replace('_', ' ')}</p>
          </div>
        </div>

        <div className="space-y-4">
          {landmark.category === 'ev_station' && <EVSimulationPanel landmark={landmark} />}

          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-1.5">Status</div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              <span className="text-base font-semibold text-green-400">Live API Link Active</span>
            </div>
          </div>

          {(landmark.operator || landmark.address) && (
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="text-xs text-gray-400 uppercase tracking-widest mb-1.5">Operator & Address</div>
              {landmark.operator && <div className="text-base font-medium">{landmark.operator}</div>}
              {landmark.address && <div className="text-sm text-gray-300 mt-1">{landmark.address}</div>}
            </div>
          )}

          {landmark.connections && (
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">Available Connections</div>
              <div className="space-y-2">
                {landmark.connections.map((c: string, idx: number) => (
                  <div key={idx} className="text-sm text-green-300 flex items-center gap-3 bg-green-500/10 p-2 rounded border border-green-500/20">
                    <div className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!landmark.connections && landmark.center && (
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="text-xs text-gray-400 uppercase tracking-widest mb-1.5">Coordinates (X, Z)</div>
              <div className="text-base font-mono text-cyan-400">{Math.round(landmark.center[0])}, {Math.round(landmark.center[1])}</div>
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-4">
          <button
            onClick={onStartDriving}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(220,38,38,0.5)] border border-red-500"
          >
            START DRIVING HERE
          </button>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-bold tracking-wider border border-white/20"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

export const CityStreetViewer = ({ isShowFlights = true, rainIntensity = 5, cameraMode = 'map', cityCenter }: { isShowFlights?: boolean, rainIntensity?: number, cameraMode?: 'map' | 'drone', cityCenter?: { id: string, lat: number, lon: number, alt: number, label: string } }) => {
  const tilesLat = cityCenter?.lat ?? LAT_CENTER;
  const tilesLon = cityCenter?.lon ?? LON_CENTER;
  const tilesAlt = cityCenter?.alt ?? 880;
  // Only show JP Nagar-specific data layers when the home city is selected
  const isHomeCity = !cityCenter || cityCenter.id === 'jp-nagar';
  const [cityData, setCityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [evStations, setEvStations] = useState<any[]>([]);
  const [isSimNight, setIsSimNight] = useState(false);
  const [isSimRain, setIsSimRain] = useState(false);
  const [weather, setWeather] = useState<any>(null);

  const isLiveNight = weather ? !weather.is_day : false;
  const isLiveRain = weather ? weather.weather_code >= 61 : false;
  const [assetFilters, setAssetFilters] = useState<any>({ all: true });
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3 | null>(null);
  const [focusedLandmark, setFocusedLandmark] = useState<any>(null);
  const [expandedLandmark, setExpandedLandmark] = useState<any>(null);
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [isDriveMode, setIsDriveMode] = useState(false);
  const [isCityTransparent, setIsCityTransparent] = useState(false);
  // EV Simulation state
  const [isEvSim, setIsEvSim] = useState(false);
  const [focusedGridNode, setFocusedGridNode] = useState<any>(null);
  const [expandedGridNode, setExpandedGridNode] = useState<any>(null);
  const [showZones, setShowZones] = useState(true);
  const [zoneNavCollapsed, setZoneNavCollapsed] = useState(false);

  useEffect(() => {
    const handleSim = (e: any) => {
      if (e.detail.type === 'toggle-rain') setIsSimRain(prev => !prev);
      if (e.detail.type === 'toggle-night') setIsSimNight(prev => !prev);
    };
    const handleFilter = (e: any) => setAssetFilters(e.detail);
    const handleEvSim = (e: any) => {
      if (e.detail.type === 'toggle-ev-sim') {
        setIsEvSim(prev => !prev);
        setFocusedGridNode(null);
        setExpandedGridNode(null);
      }
    };
    const handleOpacity = (e: any) => {
      const op = e.detail.opacity;
      const isTrans = op < 1.0;
      
      buildingMaterial.opacity = op;
      treeMaterial.opacity = op;
      roadMaterial.opacity = Math.min(1.0, op + 0.15); // roads slightly more opaque so they are visible
      
      if (buildingMaterial.transparent !== isTrans) {
         buildingMaterial.transparent = isTrans;
         buildingMaterial.depthWrite = !isTrans;
         buildingMaterial.needsUpdate = true;
         
         treeMaterial.transparent = isTrans;
         treeMaterial.depthWrite = !isTrans;
         treeMaterial.needsUpdate = true;
         
         roadMaterial.transparent = isTrans;
         roadMaterial.depthWrite = !isTrans;
         roadMaterial.needsUpdate = true;
         
         // Only trigger React re-render when crossing the transparency threshold to avoid lag
         setIsCityTransparent(isTrans);
      }
    };

    window.addEventListener('laip-sim', handleSim);
    window.addEventListener('laip-asset-filter', handleFilter);
    window.addEventListener('laip-ev-sim', handleEvSim);
    window.addEventListener('laip-city-opacity', handleOpacity);
    return () => {
      window.removeEventListener('laip-sim', handleSim);
      window.removeEventListener('laip-asset-filter', handleFilter);
      window.removeEventListener('laip-ev-sim', handleEvSim);
      window.removeEventListener('laip-city-opacity', handleOpacity);
    };
  }, []);

  // Broadcast weather state to App.tsx whenever it changes
  useEffect(() => {
    if (weather) {
      window.dispatchEvent(new CustomEvent('laip-weather', {
        detail: { weather }
      }));
    }
  }, [weather]);

  const handleFlyTo = (st: any) => {
    const pos = new THREE.Vector3(st.center[0], 0, st.center[1]);
    setCameraTarget(pos);
    setExpandedLandmark(null);
    setFocusedLandmark(st);
  };

  const handleExpand = (st: any) => {
    setExpandedLandmark(st);
  };
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
      .then(data => { if (data.stations) setEvStations(data.stations); })
      .catch(e => console.error(e));

    fetch("http://localhost:8001/api/weather")
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setWeather(data);
        }
      })
      .catch(e => console.error(e));
  }, []);

  // Compute and dispatch asset counts when data loads
  useEffect(() => {
    if (!cityData?.buildings || evStations.length === 0) return;

    let apartments = 0;
    let restaurants = 0;
    let hospital = 0;

    cityData.buildings.forEach((b: any) => {
      if (!b.name) return;
      if (b.category === "apartments" || b.category === "residential") apartments++;
      if (b.category === "hospital") hospital++;
      if (b.category === "restaurant" || b.category === "cafe" || b.category === "fast_food") restaurants++;
    });

    window.dispatchEvent(new CustomEvent('laip-asset-counts', {
      detail: { apartments, restaurants, hospital, evStations: evStations.length, roads: cityData.roads.length }
    }));
  }, [cityData, evStations]);

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
  const renderNight = isSimNight || isLiveNight;
  const renderRain = isSimRain || isLiveRain || isDriveMode;

  useEffect(() => {
    buildingMaterial.userData.uIsNight.value = renderNight ? 1 : 0;
  }, [renderNight]);

  // Adjust lighting for better cinematic visibility
  const dimFactor = isCityTransparent ? 0.3 : 1.0;
  
  const sunPos = renderNight ? [-300, -100, -300] : [500, 300, -500]; // Keep sun below horizon at night for Sky
  const lightPos = renderNight ? [-300, 400, -300] : [500, 300, -500]; // Actual directional light source (Moon/Sun)
  const ambientIntensity = (renderNight ? 0.3 : (renderRain ? 0.5 : 0.6)) * dimFactor; // Boosted ambient light
  const dirIntensity = (renderNight ? 1.5 : (renderRain ? 0.8 : 1.0)) * dimFactor; // Bright moonlight
  const skyColor = renderNight ? "#050b14" : (renderRain ? "#475569" : "#e0f2fe"); // Deep realistic blue sky

  return (
    <div className="flex-1 relative w-full h-full" style={{ backgroundColor: skyColor }}>
      <div className="absolute top-2 left-0 w-full p-4 z-[500] pointer-events-none flex justify-between">
        <div>
          <div className="text-white/60 text-xs font-mono uppercase tracking-widest mt-1">
            {cityCenter?.label ?? 'JP Nagar Infrastructure Node'}
          </div>

          {loading && (
            <div className="bg-blue-500/10 text-blue-700 text-xs px-3 py-1.5 rounded-full border border-blue-500/30 backdrop-blur-md inline-flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
              Syncing Massive OSM Drone Data (May take 10s)...
            </div>
          )}
          
          {/* ZONES NAVIGATION PANEL — JP Nagar only */}
          {!isDriveMode && isHomeCity && (
            <div className="mt-4 pointer-events-auto relative z-[500]" style={{ width: zoneNavCollapsed ? 'auto' : '300px' }}>
              {zoneNavCollapsed ? (
                /* Collapsed state: slim tab on the left edge */
                <div className="relative group">
                  <button
                    onClick={() => setZoneNavCollapsed(false)}
                    // title="Expand Zone Navigation"
                    className="cursor-pointer flex items-center justify-center w-8 h-10 bg-black/70 backdrop-blur-md border border-white/20 rounded-r-xl shadow-2xl text-laip-cyan hover:bg-laip-cyan/20 hover:border-laip-cyan/50 transition-all"
                  >
                    {/* Double right arrow */}
                    <ChevronsRight size={16} />
                  </button>
                  {/* Tooltip */}
                  <div className="absolute left-10 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap border border-white/20">
                    Expand Zone Navigation
                  </div>
                </div>
              ) : (
                /* Expanded state: full panel */
                <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-white text-sm font-bold tracking-widest uppercase">Zone Navigation</h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setShowZones(!showZones)}
                        className={`cursor-pointer text-xs px-2 py-1 rounded border transition-colors ${showZones ? 'bg-laip-cyan/20 text-laip-cyan border-laip-cyan/50' : 'bg-white/10 text-gray-400 border-white/20'}`}
                      >
                        {showZones ? 'ON' : 'OFF'}
                      </button>
                      {/* Collapse button with tooltip */}
                      <div className="relative group">
                        <button
                          onClick={() => setZoneNavCollapsed(true)}
                          // title="Collapse Zone Navigation"
                          className=" cursor-pointer flex items-center justify-center w-7 h-7 rounded border border-white/20 bg-white/10 text-gray-300 hover:bg-laip-cyan/20 hover:text-laip-cyan hover:border-laip-cyan/50 transition-all"
                        >
                          {/* Double left arrow */}
                          <ChevronsLeft size={16} />
                        </button>
                        {/* Tooltip */}
                        <div className="absolute right-0 top-full mt-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap border border-white/20 z-10">
                          Hide panel
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {JPNagarPhases.map((phase, i) => {
                      const isSelected = selectedPhase?.name === phase.name;
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedPhase(phase);
                            setCameraTarget(new THREE.Vector3(phase.center[0], 500, phase.center[1]));
                          }}
                          className={`cursor-pointer px-3 py-1.5 text-xs font-semibold rounded transition-colors border ${isSelected ? 'border-white/50' : 'border-transparent hover:border-white/20'}`}
                          style={{ color: phase.color, backgroundColor: `${phase.color}${isSelected ? '30' : '15'}` }}
                        >
                          {phase.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!isDriveMode && isHomeCity && (
        <button
          onClick={() => setIsDriveMode(true)}
          className="fixed bottom-3 left-3 bg-red-600 hover:bg-red-500 text-white font-bold px-8 py-3 rounded shadow-[0_0_20px_#dc2626] border border-red-400/50 z-50 animate-pulse tracking-widest uppercase transition-all"
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

      {!isDriveMode && isHomeCity && (
        <ExpandedLandmarkPanel
          landmark={expandedLandmark}
          onClose={() => setExpandedLandmark(null)}
          onStartDriving={() => {
            setStartPos(expandedLandmark.center);
            setExpandedLandmark(null);
            setIsDriveMode(true);
          }}
        />
      )}

      {/* Power Grid Expanded Panel — JP Nagar only */}
      {!isDriveMode && isHomeCity && expandedGridNode && (
        <PowerGridExpandedPanel
          node={expandedGridNode}
          onClose={() => setExpandedGridNode(null)}
        />
      )}

      <Canvas onClick={() => setExpandedLandmark(null)} shadows camera={{ position: [0, 800, 1000], fov: 40, far: 500000 }} gl={{ logarithmicDepthBuffer: true }}>
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
        <CameraController targetPos={cameraTarget} onArrived={() => setCameraTarget(null)} />
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
          <group position={[0, 32, 0]}>
            <TilesEnvironment isVisible={!isCityTransparent} lat={tilesLat} lon={tilesLon} alt={tilesAlt} />
          </group>

          {/* Render Massive Mega-Mesh Map — JP Nagar only */}
          {isHomeCity && cityData && <MergedCityMap buildings={cityData.buildings} isTransparent={isCityTransparent} />}
          
          {/* Interactive Roads Layer — JP Nagar only */}
          {isHomeCity && cityData && <RoadsLayer roads={cityData.roads} assetFilters={assetFilters} onFlyTo={handleFlyTo} onExpand={handleExpand} focusedLandmark={focusedLandmark} isTransparent={isCityTransparent} />}

          {/* Render Real Lakes — JP Nagar only */}
          {isHomeCity && cityData?.lakes && <LakesLayer lakes={cityData.lakes} />}

          {/* Render Landmarks UI — JP Nagar only */}
          {isHomeCity && cityData && <LandmarksLayer buildings={cityData.buildings} onFlyTo={handleFlyTo} onExpand={handleExpand} focusedLandmark={focusedLandmark} assetFilters={assetFilters} />}

          {/* Real Trees & Procedural Lush Forest — JP Nagar only */}
          {isHomeCity && cityData?.trees && <RealTrees trees={cityData.trees} isTransparent={isCityTransparent} />}
          {isHomeCity && <DenseForest lakes={cityData?.lakes} isTransparent={isCityTransparent} />}
          
          {/* Volumetric Zones — JP Nagar only */}
          {isHomeCity && <ZonesLayer active={cityData != null} showZones={showZones} selectedPhase={selectedPhase} />}

          {/* Streetlights — JP Nagar only */}
          {isHomeCity && cityData?.roads && <StreetlightsLayer roads={cityData.roads} isNight={renderNight} />}

          {/* Project Nolan-Star Driving Features — JP Nagar only */}
          {isHomeCity && (
          <DriveableVehicle
            active={isDriveMode}
            setSpeed={setSpeed}
            buildings={cityData?.buildings}
            roads={cityData?.roads}
            startPos={startPos}
            telemetryRef={telemetryRef}
          />
          )}
          <CinematicRain active={renderRain} intensity={rainIntensity} />

          {/* Dynamic Infrastructure — JP Nagar only */}
          {isHomeCity && (
          <EVStationsLayer
            stations={evStations}
            roads={cityData?.roads}
            onFlyTo={handleFlyTo}
            onExpand={handleExpand}
            focusedLandmark={focusedLandmark}
            assetFilters={assetFilters}
          />
          )}

          {/* EV Station Simulation Power Grid Layer — JP Nagar only */}
          {isHomeCity && isEvSim && cityData && (
            <EVSimulationLayer
              evStations={evStations}
              buildings={cityData.buildings}
              roads={cityData.roads}
              onFlyTo={(node) => {
                const pos = new THREE.Vector3(node.center[0], node.y || -2, node.center[1]);
                setCameraTarget(pos);
                if (node.id) setFocusedGridNode(node);
                setExpandedGridNode(null);
              }}
              onExpand={(node) => setExpandedGridNode(node)}
              focusedNode={focusedGridNode}
            />
          )}

          {/* Dynamic Traffic Engine — JP Nagar only (hide if driving to avoid collision glitches) */}
          {isHomeCity && !isDriveMode && cityData?.roads && <TrafficEngine roads={cityData.roads} />}

          {/* Dynamic Flight Engine */}
          {isShowFlights && <FlightEngine />}

          {/* Orbit Controls tuned for massive drone view zooming */}
          {cameraMode === 'map' && (
            <OrbitControls
              makeDefault={!isDriveMode}
              enabled={!isDriveMode}
              maxPolarAngle={Math.PI / 2.1}
              minPolarAngle={Math.PI / 8}
              minDistance={100}
              maxDistance={25000}
              target={[0, 0, 0]}
            />
          )}

          {/* True WASD Drone Controls */}
          {cameraMode === 'drone' && !isDriveMode && (
            <FlyControls movementSpeed={150} rollSpeed={0.2} dragToLook={true} />
          )}
        </group>

        {/* @ts-ignore */}
        <EffectComposer disableNormalPass multisampling={0}>
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette eskil={false} offset={0.1} darkness={isDriveMode ? 1.2 : 1.0} />
          {(isDriveMode ? <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} /> : null) as any}
          <N8AO aoRadius={12} intensity={renderNight ? 1.0 : 1.5} color="#0f172a" />
          <Bloom luminanceThreshold={isDriveMode ? 0.3 : (renderNight ? 0.4 : 1.5)} mipmapBlur intensity={isDriveMode ? 1.5 : (renderNight ? 1.0 : 0.05)} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
