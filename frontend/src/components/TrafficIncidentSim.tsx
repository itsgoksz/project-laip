import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { RoadGraph } from '../utils/pathfinding';
import { AlertTriangle, X, ShieldAlert, Sparkles, Navigation } from 'lucide-react';

// ── Timing (seconds) ─────────────────────────────────────────────────────────
const T_BUILDUP_START   = 4;
const T_BUILDUP_DUR     = 25;   // 4 → 29 s  congestion grows (15% → 88%)
const T_REROUTE_HOLD    = 35;   // 29 → 64 s  diversion active
const T_RECOVERY_DUR    = 20;   // 64 → 84 s  clears
const T_RECOVERY_START  = T_BUILDUP_START + T_BUILDUP_DUR + T_REROUTE_HOLD; // 64

// ── Parameterized Positions on Incident Trunk Road (Total curve ~452m) ────────
const U_ORANGE_TURN  = 0.164; // Street 28186987 junction (Orange Marked Road at [-183.98, -150.95])
const U_PRIMARY_TURN = 0.519; // Street 28187112 junction (Primary Left Turn at [-23.25, -150.15])
const U_INCIDENT     = 0.565; // Stalled vehicle at [+4.0, -150.0], ~25m AFTER the primary left turn
const U_REJOIN       = 0.685; // Rejoin junction at [51.83, -149.77], past California Burrito

// ── Exact Verified Real-Road Paths (from OSM road network) ────────────────────
const VERIFIED_PRIMARY_PATH: [number, number][] = [
  [-23.25, -150.15],
  [-23.09, -158.29],
  [-21.82, -218.79],
  [-20.78, -268.89],
  [-19.78, -317.07],
  [24.18, -316.38],
  [54.8, -315.91],
  [52.68, -197.41],
  [51.99, -158.24],
  [51.83, -149.77]
];

const VERIFIED_ORANGE_PATH: [number, number][] = [
  [-183.98, -150.95],
  [-183.74, -158.39],
  [-182.93, -222.27],
  [-181.56, -272.54],
  [-179.96, -319.6],
  [-19.78, -317.07],
  [24.18, -316.38],
  [54.8, -315.91],
  [52.68, -197.41],
  [51.99, -158.24],
  [51.83, -149.77]
];

// ── Vehicle Colors ────────────────────────────────────────────────────────────
const CAR_COLORS = [
  new THREE.Color('#f8fafc'), // Pearl White
  new THREE.Color('#38bdf8'), // Electric Cyan
  new THREE.Color('#cbd5e1'), // Metallic Silver
  new THREE.Color('#334155'), // Dark Slate
  new THREE.Color('#ef4444'), // Crimson Red
  new THREE.Color('#fbbf24'), // Sunset Amber
];

interface TrafficIncidentSimProps {
  roads: any[];
  cityData: any;
}

type SimState =
  | 'NORMAL'
  | 'INCIDENT_OCCURRED'
  | 'CONGESTION_BUILDUP'
  | 'ALTERNATIVE_ROUTE_ACTIVE'
  | 'RECOVERY';

type CarState = 'MAIN' | 'BYPASS_PRIMARY' | 'BYPASS_ORANGE' | 'STOPPED_QUEUE';

interface SimCar {
  progress: number;
  speed: number;
  laneOffset: number;
  colorIndex: number;
  routePreference: 'PRIMARY' | 'ORANGE';
  state: CarState;
  bypassProgress: number;
}

export const TrafficIncidentSim: React.FC<TrafficIncidentSimProps> = ({ roads }) => {
  const [simState,   setSimState]   = useState<SimState>('NORMAL');
  const [incident,   setIncident]   = useState<any>(null);
  const [history,    setHistory]    = useState<any[]>([]);
  const [showPopup,  setShowPopup]  = useState(false);
  const [isPaused,   setIsPaused]   = useState(false);

  // Dual bypass paths
  const [primaryPath, setPrimaryPath] = useState<THREE.Vector3[]>([]);
  const [orangePath,  setOrangePath]  = useState<THREE.Vector3[]>([]);

  const simTimerRef     = useRef<number>(0);
  const incidentRef     = useRef<any>(null);
  const simStateRef     = useRef<SimState>('NORMAL');
  const isPausedRef     = useRef(false);
  const primaryPathRef  = useRef<THREE.Vector3[]>([]);
  const orangePathRef   = useRef<THREE.Vector3[]>([]);

  useEffect(() => { incidentRef.current    = incident;    }, [incident]);
  useEffect(() => { simStateRef.current    = simState;    }, [simState]);
  useEffect(() => { isPausedRef.current    = isPaused;    }, [isPaused]);
  useEffect(() => { primaryPathRef.current = primaryPath; }, [primaryPath]);
  useEffect(() => { orangePathRef.current  = orangePath;  }, [orangePath]);

  // ── Build RoadGraph directly from actual OSM roads ──────────────────────────
  const roadGraph = useMemo(() => {
    return roads?.length ? RoadGraph.buildFromRoads(roads) : new RoadGraph();
  }, [roads]);

  // ── Select Main Road Segment from actual roads ──────────────────────────────
  const incidentRoad = useMemo(() => {
    if (!roads?.length) return null;
    const priorityTypes = new Set(['trunk', 'primary', 'secondary', 'tertiary']);
    
    let best: any = null;
    let maxLen = 0;

    roads.forEach(r => {
      if (!r.line || r.line.length < 3) return;
      if (!priorityTypes.has(r.type)) return;

      const dist = Math.hypot(r.line[0][0], r.line[0][1]);
      if (dist < 450) {
        if (r.line.length > maxLen) {
          maxLen = r.line.length;
          best = r;
        }
      }
    });

    if (!best) {
      roads.forEach(r => {
        if (r.line && r.line.length > maxLen) {
          maxLen = r.line.length;
          best = r;
        }
      });
    }
    return best;
  }, [roads]);

  // ── Curve for Main Road (on road surface y = 0.35) ──────────────────────────
  const incidentRoadCurve = useMemo(() => {
    if (!incidentRoad?.line || incidentRoad.line.length < 2) return null;
    try {
      const pts = incidentRoad.line.map((pt: number[]) => new THREE.Vector3(pt[0], 0.35, pt[1]));
      return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
    } catch { return null; }
  }, [incidentRoad]);

  // ── Breakdown position AFTER the primary left turn at u = 0.565 ──────────────
  const incidentPosData = useMemo(() => {
    if (!incidentRoadCurve) return { pos: new THREE.Vector3(0, 0.45, 0), centerPt: new THREE.Vector3(), tangent: new THREE.Vector3(1, 0, 0) };
    const u = U_INCIDENT; // 0.565 (after the left turn at u = 0.519)
    const centerPt = incidentRoadCurve.getPointAt(u);
    const tan = incidentRoadCurve.getTangentAt(u).normalize();
    const leftNormal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const lanePos = centerPt.clone().add(leftNormal.multiplyScalar(2.2));
    lanePos.y = 0.45; // Resting on asphalt surface

    return { pos: lanePos, centerPt, tangent: tan, leftNormal };
  }, [incidentRoadCurve]);

  // ── Sleek Flat Congestion Overlay Ribbon (y = 0.30, flat on road) ────────────
  // Extends backwards from the breakdown (u = 0.565) past the left turn (u = 0.519)
  const congestionCurveGeo = useMemo(() => {
    if (!incidentRoadCurve) return null;
    const subPts: THREE.Vector3[] = [];
    const steps = 30;

    const congLevel = incident?.congestionLevel || 15;
    // Congestion spreads upstream from u = 0.565 backwards towards u = 0.20
    const backFactor = (congLevel / 100) * 0.36; // 0.054 to 0.32
    const startU = Math.max(0.18, U_INCIDENT - backFactor);

    for (let i = 0; i <= steps; i++) {
      const u = startU + (i / steps) * (U_INCIDENT - startU);
      const pt = incidentRoadCurve.getPointAt(u);
      const tan = incidentRoadCurve.getTangentAt(u).normalize();
      const leftNormal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const lanePt = pt.clone().add(leftNormal.multiplyScalar(2.2));
      lanePt.y = 0.30; // Flat ribbon right above asphalt
      subPts.push(lanePt);
    }
    const curve = new THREE.CatmullRomCurve3(subPts);
    const geo = new THREE.TubeGeometry(curve, 35, 4.5, 4, false);
    geo.scale(1, 0.01, 1);
    return geo;
  }, [incidentRoadCurve, incident?.congestionLevel]);

  // ── Compute Both Bypass Paths (Primary Left Turn + Early Orange Road) ────────
  const computeDualBypasses = useCallback(() => {
    if (!incidentRoad || !roadGraph || !incidentRoad.line?.length) {
      // Use verified real-road paths
      setPrimaryPath(VERIFIED_PRIMARY_PATH.map(p => new THREE.Vector3(p[0], 0.35, p[1])));
      setOrangePath(VERIFIED_ORANGE_PATH.map(p => new THREE.Vector3(p[0], 0.35, p[1])));
      return;
    }

    try {
      const line: number[][] = incidentRoad.line;
      const g2 = new RoadGraph();
      const blockedEdges = new Set<string>();

      // Block trunk edges between index 2 and index 8
      for (let i = 2; i < 8; i++) {
        if (line[i] && line[i+1]) {
          const idA = `${line[i][0].toFixed(2)},${line[i][1].toFixed(2)}`;
          const idB = `${line[i+1][0].toFixed(2)},${line[i+1][1].toFixed(2)}`;
          blockedEdges.add(`${idA}->${idB}`);
          blockedEdges.add(`${idB}->${idA}`);
        }
      }

      for (const [id, node] of roadGraph.nodes.entries()) {
        g2.nodes.set(id, { id: node.id, x: node.x, z: node.z, edges: node.edges.map(ed => ({ ...ed })) });
      }
      for (const [id, node] of g2.nodes.entries()) {
        node.edges = node.edges.filter(ed => !blockedEdges.has(`${id}->${ed.toId}`));
      }

      // 1. Primary Bypass (from index 3 [-23.25, -150.15] to index 8 [51.83, -149.77])
      const s1 = line[3];
      const e1 = line[8];
      const path1 = g2.findShortestPath(s1[0], s1[1], e1[0], e1[1]);
      if (path1 && path1.length > 2) {
        setPrimaryPath(path1.map(v => new THREE.Vector3(v.x, 0.35, v.z)));
      } else {
        setPrimaryPath(VERIFIED_PRIMARY_PATH.map(p => new THREE.Vector3(p[0], 0.35, p[1])));
      }

      // 2. Orange Bypass (from index 2 [-183.98, -150.95] to index 8 [51.83, -149.77])
      const s2 = line[2];
      const path2 = g2.findShortestPath(s2[0], s2[1], e1[0], e1[1]);
      if (path2 && path2.length > 2) {
        setOrangePath(path2.map(v => new THREE.Vector3(v.x, 0.35, v.z)));
      } else {
        setOrangePath(VERIFIED_ORANGE_PATH.map(p => new THREE.Vector3(p[0], 0.35, p[1])));
      }
    } catch (err) {
      console.warn("Dual bypass route computation fallback:", err);
      setPrimaryPath(VERIFIED_PRIMARY_PATH.map(p => new THREE.Vector3(p[0], 0.35, p[1])));
      setOrangePath(VERIFIED_ORANGE_PATH.map(p => new THREE.Vector3(p[0], 0.35, p[1])));
    }
  }, [incidentRoad, roadGraph]);

  // ── Reset Helper ───────────────────────────────────────────────────────────
  const resetSim = useCallback(() => {
    setSimState('NORMAL');
    setIncident(null);
    setShowPopup(false);
    setIsPaused(false);
    setPrimaryPath([]);
    setOrangePath([]);
    simTimerRef.current = 0;
  }, []);

  // ── Auto-center camera on exact alert position when component mounts ───────
  useEffect(() => {
    if (incidentPosData?.pos) {
      window.dispatchEvent(new CustomEvent('laip-focus-incident', {
        detail: { x: incidentPosData.pos.x, z: incidentPosData.pos.z }
      }));
    }
  }, [incidentPosData]);

  // ── Event Listeners (Start / Pause / Stop) ──────────────────────────────────
  useEffect(() => {
    const handleStart = () => {
      if (simStateRef.current !== 'NORMAL' || !incidentRoad) return;

      const rawName = incidentRoad.name || `Road (${incidentRoad.type || 'trunk'})`;
      const roadName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

      setIncident({
        type: 'Vehicle Breakdown',
        roadName: `${roadName} (JP Nagar)`,
        position: incidentPosData.pos,
        severity: 'High',
        lanesAffected: 'Left Lane Blocked',
        congestionLevel: 15,
        averageSpeed: 45,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        status: 'Left Lane Blocked / Queue Building',
        startTime: Date.now(),
      });
      setSimState('INCIDENT_OCCURRED');
      setShowPopup(false);
      setPrimaryPath([]);
      setOrangePath([]);
      simTimerRef.current = 0;
    };

    const handlePause = (e: any) => setIsPaused(e.detail?.paused ?? true);

    const handleStop = () => {
      if (simStateRef.current === 'NORMAL') return;
      const inc = incidentRef.current;
      if (inc) {
        const dur = Math.round((Date.now() - inc.startTime) / 1000);
        setHistory(prev => [{ type: inc.type, roadName: inc.roadName, duration: dur, maxCongestion: inc.congestionLevel }, ...prev]);
      }
      resetSim();
    };

    window.addEventListener('laip-start-incident', handleStart);
    window.addEventListener('laip-pause-incident', handlePause as EventListener);
    window.addEventListener('laip-stop-incident',  handleStop);
    return () => {
      window.removeEventListener('laip-start-incident', handleStart);
      window.removeEventListener('laip-pause-incident', handlePause as EventListener);
      window.removeEventListener('laip-stop-incident',  handleStop);
    };
  }, [incidentRoad, incidentPosData, resetSim]);

  // ── Broadcast State to RightPanel HUD ──────────────────────────────────────
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('laip-traffic-sim-state', {
      detail: { simState, incident, history }
    }));
  }, [simState, incident, history]);

  // ── Simulation Timer Loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (simState === 'NORMAL') return;
    const tick = setInterval(() => {
      if (isPausedRef.current) return;
      simTimerRef.current += 1;
      const t  = simTimerRef.current;
      const st = simStateRef.current;

      if (st === 'INCIDENT_OCCURRED' && t >= T_BUILDUP_START) {
        setSimState('CONGESTION_BUILDUP');
        setIncident((p: any) => p ? { ...p, status: 'Left Lane Queue Building...' } : null);
      }

      if (st === 'CONGESTION_BUILDUP') {
        const prog  = Math.min(1, (t - T_BUILDUP_START) / T_BUILDUP_DUR);
        const cong  = Math.round(15 + prog * 73);
        const speed = Math.max(4, Math.round(45 - prog * 41));
        setIncident((p: any) => p ? { ...p, congestionLevel: cong, averageSpeed: speed } : null);

        if (cong >= 65) {
          setSimState('ALTERNATIVE_ROUTE_ACTIVE');
          setIncident((p: any) => p ? { ...p, status: 'Dual AI Bypass Active / Rerouting Traffic' } : null);
          computeDualBypasses();
        }
      }

      if (st === 'ALTERNATIVE_ROUTE_ACTIVE' && t >= T_RECOVERY_START) {
        setSimState('RECOVERY');
        setIncident((p: any) => p ? { ...p, status: 'Vehicle Towing in Progress...' } : null);
      }

      if (st === 'RECOVERY') {
        const prog  = Math.min(1, (t - T_RECOVERY_START) / T_RECOVERY_DUR);
        const cong  = Math.round(88 - prog * 73);
        const speed = Math.round(4 + prog * 41);
        setIncident((p: any) => p ? { ...p, congestionLevel: cong, averageSpeed: speed } : null);

        if (cong <= 15) {
          const inc = incidentRef.current;
          if (inc) {
            setHistory(prev => [{ type: inc.type, roadName: inc.roadName, duration: Math.round((Date.now() - inc.startTime) / 1000), maxCongestion: 88 }, ...prev]);
          }
          window.dispatchEvent(new CustomEvent('laip-notification', {
            detail: { title: 'Incident Cleared', message: 'Left lane cleared. Normal traffic flow restored on all lanes.', type: 'success' }
          }));
          resetSim();
        }
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [simState, computeDualBypasses, resetSim]);

  // ── Enterprise Congestion Color (Amber → Orange → Red) ──────────────────────
  const congestionColor = useMemo(() => {
    if (!incident || simState === 'NORMAL') return '#1c2b3a';
    const c = incident.congestionLevel || 15;
    if (c >= 70) return '#dc2626'; // Red
    if (c >= 42) return '#f97316'; // Orange
    return '#eab308';             // Amber Yellow
  }, [incident, simState]);

  // ── Bypass Route Curves & Visual Geometries ─────────────────────────────────
  const primaryBypassCurve = useMemo(() => {
    if (primaryPath.length < 2) return null;
    return new THREE.CatmullRomCurve3(primaryPath, false, 'catmullrom', 0.1);
  }, [primaryPath]);

  const orangeBypassCurve = useMemo(() => {
    if (orangePath.length < 2) return null;
    return new THREE.CatmullRomCurve3(orangePath, false, 'catmullrom', 0.1);
  }, [orangePath]);

  const primaryBypassGeo = useMemo(() => {
    if (!primaryBypassCurve) return null;
    const geo = new THREE.TubeGeometry(primaryBypassCurve, 128, 4.2, 4, false);
    geo.scale(1, 0.01, 1);
    return geo;
  }, [primaryBypassCurve]);

  const orangeBypassGeo = useMemo(() => {
    if (!orangeBypassCurve) return null;
    const geo = new THREE.TubeGeometry(orangeBypassCurve, 128, 4.2, 4, false);
    geo.scale(1, 0.01, 1);
    return geo;
  }, [orangeBypassCurve]);

  // ── Vehicles Simulation & Smooth Reroute Animation ─────────────────────────
  const NUM_CARS = 75;
  const carsRef  = useRef<SimCar[]>([]);
  const meshRef  = useRef<THREE.InstancedMesh>(null);

  const initCars = useMemo<SimCar[]>(() => {
    return Array.from({ length: NUM_CARS }).map((_, i) => ({
      progress:        (i / NUM_CARS) * 0.98 + 0.01,
      speed:           0.00062 + (i % 6) * 0.00008,
      laneOffset:      (i % 2 === 0 ? -2.2 : 2.2),
      colorIndex:      i % CAR_COLORS.length,
      routePreference: (i % 5 < 2 ? 'ORANGE' : 'PRIMARY') as ('PRIMARY' | 'ORANGE'), // 40% Orange early turn, 60% Primary left turn
      state:           'MAIN' as CarState,
      bypassProgress:  0,
    }));
  }, []);

  useEffect(() => {
    carsRef.current = initCars;
    if (meshRef.current) {
      for (let i = 0; i < NUM_CARS; i++) {
        meshRef.current.setColorAt(i, CAR_COLORS[i % CAR_COLORS.length]);
      }
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [initCars]);

  useFrame((_, delta) => {
    if (!meshRef.current || !incidentRoadCurve) return;
    if (isPausedRef.current) return;

    const dummy = new THREE.Object3D();
    const pos   = new THREE.Vector3();
    const tan   = new THREE.Vector3();
    const st    = simStateRef.current;

    const hasPrimaryBypass = primaryPathRef.current.length > 1 && !!primaryBypassCurve;
    const hasOrangeBypass  = orangePathRef.current.length > 1 && !!orangeBypassCurve;

    carsRef.current.forEach((car, i) => {
      const isRerouteActive = (st === 'ALTERNATIVE_ROUTE_ACTIVE');
      const isRecovery      = (st === 'RECOVERY');

      // ── CASE 1: CAR IS ON PRIMARY BYPASS ────────────────────────────────────
      if (car.state === 'BYPASS_PRIMARY' && primaryBypassCurve) {
        car.bypassProgress += car.speed * 1.15 * delta * 60;

        if (car.bypassProgress >= 1.0) {
          // Rejoin main road past California Burrito & the breakdown at u = 0.685
          car.state = 'MAIN';
          car.progress = U_REJOIN + 0.01;
          car.bypassProgress = 0;
        } else {
          const bp = Math.max(0.0001, Math.min(car.bypassProgress, 0.9999));
          primaryBypassCurve.getPointAt(bp, pos);
          primaryBypassCurve.getTangentAt(bp, tan);
          pos.y = 0.45;
        }
      }
      // ── CASE 2: CAR IS ON EARLY ORANGE DIVERSION BYPASS ────────────────────
      else if (car.state === 'BYPASS_ORANGE' && orangeBypassCurve) {
        car.bypassProgress += car.speed * 1.2 * delta * 60;

        if (car.bypassProgress >= 1.0) {
          // Rejoin main road past California Burrito & the breakdown at u = 0.685
          car.state = 'MAIN';
          car.progress = U_REJOIN + 0.01;
          car.bypassProgress = 0;
        } else {
          const bp = Math.max(0.0001, Math.min(car.bypassProgress, 0.9999));
          orangeBypassCurve.getPointAt(bp, pos);
          orangeBypassCurve.getTangentAt(bp, tan);
          pos.y = 0.45;
        }
      }
      // ── CASE 3: CAR IS TRAVELING ON MAIN ROAD ──────────────────────────────
      else {
        if (isRerouteActive) {
          // 1. Early diversion via Orange Road at u = 0.164 (street 28186987)
          if (
            hasOrangeBypass &&
            car.routePreference === 'ORANGE' &&
            car.progress >= U_ORANGE_TURN - 0.012 &&
            car.progress < U_ORANGE_TURN + 0.025
          ) {
            car.state = 'BYPASS_ORANGE';
            car.bypassProgress = 0.001;
          }
          // 2. Primary left turn at u = 0.519 (street 28187112, BEFORE the incident)
          else if (
            hasPrimaryBypass &&
            car.progress >= U_PRIMARY_TURN - 0.015 &&
            car.progress < U_PRIMARY_TURN + 0.025
          ) {
            car.state = 'BYPASS_PRIMARY';
            car.bypassProgress = 0.001;
          }
          // 3. STRICT RULE: ZERO CARS PASS STRAIGHT PAST THE INCIDENT DURING ACTIVE REROUTING!
          // If a car was already past the left turn (0.52 to 0.565) before diversion activated,
          // it must come to a complete stop behind the incident in the queue until recovery!
          else if (car.progress >= U_PRIMARY_TURN + 0.01 && car.progress < U_INCIDENT) {
            car.state = 'STOPPED_QUEUE';
          }
        } else if (isRecovery) {
          // Recovery active: stopped cars can resume moving
          if (car.state === 'STOPPED_QUEUE') {
            car.state = 'MAIN';
          }
        } else if (st === 'INCIDENT_OCCURRED' || st === 'CONGESTION_BUILDUP') {
          // Queue builds behind the stalled vehicle at u = 0.565
          if (car.progress > 0.42 && car.progress < U_INCIDENT) {
            const dist = U_INCIDENT - car.progress;
            if (dist < 0.035) {
              car.state = 'STOPPED_QUEUE';
            }
          }
        } else {
          car.state = 'MAIN';
        }

        // Speed calculation
        let speedMult = 1.0;
        if (car.state === 'STOPPED_QUEUE') {
          speedMult = 0.0;
        } else if (st === 'CONGESTION_BUILDUP' && car.progress > 0.28 && car.progress < U_INCIDENT) {
          const dist = U_INCIDENT - car.progress;
          speedMult = Math.max(0.06, dist * 2.8);
        }

        car.progress += car.speed * speedMult * delta * 60;

        if (car.progress >= 1.0) {
          car.progress = 0.01;
          car.state    = 'MAIN';
        }

        const p = Math.max(0.0001, Math.min(car.progress, 0.9999));
        const centerPt = incidentRoadCurve.getPointAt(p);
        const roadTan  = incidentRoadCurve.getTangentAt(p).normalize();
        const leftNormal = new THREE.Vector3(-roadTan.z, 0, roadTan.x).normalize();

        pos.copy(centerPt.clone().add(leftNormal.multiplyScalar(car.laneOffset)));
        pos.y = 0.45; // Resting on road surface
        tan.copy(roadTan);
      }

      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().add(tan));
      dummy.scale.set(1.9, 1.0, 3.4);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* 1 ── Stalled Vehicle at Breakdown Site (u = 0.565, AFTER left turn) */}
      {incident && incidentPosData.pos && (
        <group position={[incidentPosData.pos.x, 0.45, incidentPosData.pos.z]}>
          {/* Stalled car body */}
          <mesh renderOrder={10}>
            <boxGeometry args={[3.2, 1.4, 5.2]} />
            <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.5} />
          </mesh>
          {/* Car roof */}
          <mesh position={[0, 1.0, -0.3]} renderOrder={10}>
            <boxGeometry args={[2.6, 0.9, 2.8]} />
            <meshStandardMaterial color="#1e293b" roughness={0.2} />
          </mesh>
          {/* Hazard Lights */}
          <mesh position={[-1.3, 0.4, 2.5]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color="#f97316" />
          </mesh>
          <mesh position={[1.3, 0.4, 2.5]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color="#f97316" />
          </mesh>
        </group>
      )}

      {/* 2 ── Sleek Enterprise Congestion Ribbon (Extends back from breakdown past left turn) */}
      {simState !== 'NORMAL' && congestionCurveGeo && (
        <mesh renderOrder={5}>
          <primitive object={congestionCurveGeo} attach="geometry" />
          <meshStandardMaterial
            color={congestionColor}
            emissive={congestionColor}
            emissiveIntensity={0.8}
            transparent
            opacity={0.70}
            roughness={0.4}
          />
        </mesh>
      )}

      {/* 3 ── PRIMARY Bypass Route (High-visibility Cyan Ribbon at Left Turn u = 0.519) */}
      {(simState === 'ALTERNATIVE_ROUTE_ACTIVE' || simState === 'RECOVERY') && primaryBypassGeo && (
        <mesh renderOrder={6}>
          <primitive object={primaryBypassGeo} attach="geometry" />
          <meshStandardMaterial
            color="#0284c7"
            emissive="#38bdf8"
            emissiveIntensity={1.3}
            transparent
            opacity={0.85}
            roughness={0.3}
          />
        </mesh>
      )}

      {/* 4 ── EARLY OVERFLOW Bypass Route (Vibrant Orange Ribbon at Orange Road u = 0.164) */}
      {(simState === 'ALTERNATIVE_ROUTE_ACTIVE' || simState === 'RECOVERY') && orangeBypassGeo && (
        <mesh renderOrder={6}>
          <primitive object={orangeBypassGeo} attach="geometry" />
          <meshStandardMaterial
            color="#ea580c"
            emissive="#f97316"
            emissiveIntensity={1.4}
            transparent
            opacity={0.85}
            roughness={0.3}
          />
        </mesh>
      )}

      {/* 5 ── Instanced Vehicles (Tires resting on asphalt y = 0.45) */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, NUM_CARS]} renderOrder={10}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.3} metalness={0.6} />
      </instancedMesh>

      {/* 6 ── Enterprise Alert Marker Badge */}
      {incident && incidentPosData.pos && (
        <group position={[incidentPosData.pos.x, 3.5, incidentPosData.pos.z]}>
          <Html center>
            <div className="select-none z-[9999] pointer-events-auto flex flex-col items-center" style={{ transform: 'translateY(-110%)' }}>
              {/* Pulsing alert pin */}
              <div className="relative flex items-center justify-center cursor-pointer" onClick={() => setShowPopup(v => !v)}>
                <span className="absolute inline-flex w-12 h-12 rounded-full bg-red-500 opacity-30 animate-ping" />
                <span className="relative z-10 flex items-center justify-center w-8 h-8 bg-gradient-to-br from-red-600 to-red-800 border border-white/40 rounded-full shadow-lg hover:scale-105 transition-transform">
                  <AlertTriangle size={15} className="text-white" />
                </span>
              </div>

              {/* Label */}
              <div
                className="mt-1 flex items-center gap-1.5 bg-black/90 backdrop-blur border border-red-500/50 text-[9px] font-bold text-red-400 px-2 py-0.5 rounded-full uppercase tracking-wider cursor-pointer whitespace-nowrap"
                onClick={() => setShowPopup(v => !v)}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                VEHICLE BREAKDOWN
              </div>

              {/* Detail Popover */}
              {showPopup && (
                <div
                  className="absolute bottom-[75px] left-1/2 -translate-x-1/2 w-72 bg-[#0b101c]/97 backdrop-blur-lg border border-red-500/40 rounded-xl p-4 shadow-2xl text-left z-[200]"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={14} className="text-red-400" />
                      <span className="text-[11px] font-bold text-white uppercase tracking-wider">Vehicle Breakdown</span>
                    </div>
                    <button className="text-gray-500 hover:text-white" onClick={e => { e.stopPropagation(); setShowPopup(false); }}>
                      <X size={13} />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-[10px]">
                    {([
                      ['Location',      incident.roadName,                'text-white font-medium'],
                      ['Time',          incident.timestamp,               'font-mono text-white'],
                      ['Severity',      'High (Left Lane Blocked)',       'text-red-400 font-bold uppercase'],
                      ['Congestion',    `${incident.congestionLevel}%`,   'text-orange-400 font-semibold'],
                      ['Avg Speed',     `${incident.averageSpeed} km/h`,  'text-yellow-400'],
                    ] as [string,string,string][]).map(([label, value, cls]) => (
                      <div key={label} className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-gray-500">{label}:</span>
                        <span className={`max-w-[160px] truncate ${cls}`}>{value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-0.5">
                      <span className="text-gray-500">Status:</span>
                      <span className="text-cyan-400 font-semibold flex items-center gap-1">
                        <Navigation size={8} className="animate-spin" />
                        {incident.status}
                      </span>
                    </div>
                  </div>

                  {simState === 'ALTERNATIVE_ROUTE_ACTIVE' && (
                    <div className="mt-3 pt-2 border-t border-white/5 space-y-1.5 text-[9px] leading-relaxed">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <Sparkles size={11} className="text-blue-400 shrink-0" />
                        <span>Dual AI Rerouting Active</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-blue-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1" />
                        <span><strong>Primary Left Turn (Cyan):</strong> Diverting traffic before breakdown via North Street.</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-orange-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-1" />
                        <span><strong>Early Diversion (Orange):</strong> Upstream turn relief to prevent junction bottleneck.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};
