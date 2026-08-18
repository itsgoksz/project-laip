import { useState, useEffect } from 'react';
import { Activity, MessageSquare, Sliders, Zap, Radio, RefreshCw, Navigation, AlertTriangle, CheckCircle2, Lightbulb, ArrowUpRight, ChevronRight, ChevronLeft } from 'lucide-react';

// Computed from BESCOM mock data
const SUB_CAPACITIES = [
  { capacity: 8, loadFactor: 0.68, evCount: 4, name: 'Sarakki' },
  { capacity: 6, loadFactor: 0.61, evCount: 3, name: 'BTM Layout' },
  { capacity: 5, loadFactor: 0.55, evCount: 3, name: 'Bannerghatta Rd' },
];
const TOTAL_GRID_MW = +(SUB_CAPACITIES.reduce((acc, s) => acc + s.capacity * s.loadFactor, 0) * 0.9).toFixed(2);
const TOTAL_EV_STATIONS = SUB_CAPACITIES.reduce((acc, s) => acc + s.evCount, 0);
const EV_KW_PER_STATION = 50; // DC fast charger kW
const EV_ACTIVE_RATE = 0.82; // 82% utilization
const EV_ACTIVE_KW = +(TOTAL_EV_STATIONS * EV_KW_PER_STATION * EV_ACTIVE_RATE).toFixed(0);

export const RightPanel = ({ isNight, isRain, isEvSim, isStreetlightsSim, isStreetlightsAssetFilter, rainIntensity, cameraMode }: any) => {
  const [transparency, setTransparency] = useState(50);
  const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({});
  const [simMetrics, setSimMetrics] = useState({ gridMW: TOTAL_GRID_MW, activePercentage: EV_ACTIVE_RATE * 100 });
  const [streetlightData, setStreetlightData] = useState<any[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const isStreetlightsActive = isStreetlightsSim || isStreetlightsAssetFilter;

  useEffect(() => {
    const handleSimMetrics = (e: any) => {
      if (e.detail) {
        setSimMetrics(prev => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('laip-ev-sim-metrics', handleSimMetrics);
    return () => window.removeEventListener('laip-ev-sim-metrics', handleSimMetrics);
  }, []);

  useEffect(() => {
    const handleData = (e: any) => {
      if (e.detail) {
        setStreetlightData(e.detail);
      }
    };
    window.addEventListener('laip-streetlight-data', handleData);
    
    // Fallback fetch on mount in case data was already loaded before mount
    const fetchInitial = async () => {
      try {
        const res = await fetch("http://localhost:8001/api/streetlights");
        const data = await res.json();
        if (data.streetlights) {
          setStreetlightData(data.streetlights);
        }
      } catch (err) {
        console.warn("Failed initial fetch of streetlights in RightPanel", err);
      }
    };
    fetchInitial();

    return () => window.removeEventListener('laip-streetlight-data', handleData);
  }, []);

  useEffect(() => {
    if (cameraMode !== 'drone') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      setPressedKeys(prev => ({ ...prev, [e.key.toLowerCase()]: true, [e.key]: true }));
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      setPressedKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false, [e.key]: false }));
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [cameraMode]);

  const getKeyStyle = (key: string) => {
    const isPressed = pressedKeys[key.toLowerCase()] || pressedKeys[key];
    return isPressed
      ? 'bg-laip-cyan text-black font-bold border-laip-cyan shadow-[0_0_8px_#00f0ff] scale-105 transition-all'
      : 'bg-white/10 text-white border-white/20';
  };

  const getRainStatus = (intensity: number) => {
    if (intensity > 50) return { text: "Violent / Intense", color: "text-red-500" };
    if (intensity >= 7.6) return { text: "Heavy", color: "text-orange-500" };
    if (intensity >= 2.5) return { text: "Moderate", color: "text-yellow-400" };
    return { text: "Light", color: "text-laip-cyan" };
  };

  const getWindStatus = (speed: number) => {
    if (speed > 100) return { text: "Hurricane Force", color: "text-red-500" };
    if (speed > 60) return { text: "Gale", color: "text-orange-500" };
    if (speed > 30) return { text: "Strong Breeze", color: "text-yellow-400" };
    if (speed > 10) return { text: "Moderate Breeze", color: "text-laip-cyan" };
    return { text: "Light Air", color: "text-gray-400" };
  };

  const handleIntensityChange = (e: any) => {
    const val = parseFloat(e.target.value);
    window.dispatchEvent(new CustomEvent('laip-rain-intensity', { detail: { intensity: val } }));
  };

  const handleTransparencyChange = (e: any) => {
    const val = parseInt(e.target.value);
    setTransparency(val);
    window.dispatchEvent(new CustomEvent('laip-transparency', { detail: { value: val } }));
  };

  const handleTransparencyReset = () => {
    setTransparency(50);
    window.dispatchEvent(new CustomEvent('laip-transparency', { detail: { value: 50 } }));
  };

  // Reset transparency when EV sim is turned off
  useEffect(() => {
    if (!isEvSim) {
      setTransparency(50);
      window.dispatchEvent(new CustomEvent('laip-transparency', { detail: { value: 50 } }));
    }
  }, [isEvSim]);

  const rainStat = getRainStatus(rainIntensity || 5);
  const windSpd = Math.floor((rainIntensity || 5) * 1.5 + 5);
  const windStat = getWindStatus(windSpd);

  // Live animated EV values (pulse every 3s for realism)
  const [evTick, setEvTick] = useState(0);
  useEffect(() => {
    if (!isEvSim) return;
    const id = setInterval(() => setEvTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, [isEvSim]);
  const liveGridMW = isEvSim ? simMetrics.gridMW.toFixed(2) : '—';
  const liveEvActivePercentage = isEvSim ? Math.round(simMetrics.activePercentage).toString() : '—';
  const gridStatus = isEvSim && simMetrics.gridMW > 10 ? { text: 'High Load', color: 'text-orange-400' } : { text: 'Nominal', color: 'text-laip-cyan' };

  // Streetlight calculations
  const totalLights = streetlightData.length || 100;
  const ledLightsCount = streetlightData.filter(l => l.light_type === 'LED').length || 43;
  const sodiumLightsCount = streetlightData.filter(l => l.light_type === 'Sodium').length || 57;
  const okLightsCount = streetlightData.filter(l => l.status === 'OK' && !l.anomaly_detected && l.health_score >= 80).length;
  const faultyLights = streetlightData.filter(l => l.status !== 'OK' || l.anomaly_detected || l.health_score < 80);
  const displayOkCount = streetlightData.length ? okLightsCount : 95;
  const displayFaultyLights = streetlightData.length ? faultyLights : [
    { asset_id: 'SL-12', status: 'CRITICAL', health_score: 35, light_type: 'LED', detected_issues: ['Nighttime Failure (No power draw)'] },
    { asset_id: 'SL-34', status: 'WARNING', health_score: 62, light_type: 'Sodium', detected_issues: ['Excessive Power consumption'] },
    { asset_id: 'SL-56', status: 'WARNING', health_score: 55, light_type: 'Sodium', detected_issues: ['Severe Voltage Sag'] },
    { asset_id: 'SL-78', status: 'CRITICAL', health_score: 41, light_type: 'LED', detected_issues: ['Intermittent Flickering'] },
    { asset_id: 'SL-90', status: 'WARNING', health_score: 48, light_type: 'Sodium', detected_issues: ['Aging Degradation'] }
  ];

  const isPipelineDim = transparency < 50;
  const isBuildingDim = transparency > 50;

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        className="relative w-fit h-auto bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex flex-row items-center gap-2 pointer-events-auto shadow-2xl cursor-pointer hover:bg-white/5 transition-all group ml-auto"
      >
        <div className="flex items-center justify-center text-gray-400 group-hover:text-white transition-colors pl-1">
          <ChevronLeft size={16} />
        </div>
        <div className="w-8 h-8 rounded-lg bg-laip-orange/10 flex items-center justify-center border border-laip-orange/30">
          <Activity size={16} className="text-laip-orange" />
        </div>
        
        {/* Custom Tooltip */}
        <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/80 text-white text-xs px-3 py-1.5 rounded whitespace-nowrap border border-white/20 shadow-xl z-50">
          Live Telemetry Data
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-5 flex flex-col pointer-events-auto shadow-2xl">
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pr-2">

        {/* Telemetry Section */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity size={14} className="text-laip-orange" /> Live Telemetry
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse panel"
              className="ml-auto w-6 h-6 rounded bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-laip-cyan transition-all cursor-pointer"
            >
              <ChevronRight size={12} />
            </button>
          </h2>

          <div className="space-y-3">
            {isStreetlightsActive ? (
              <>
                {/* Overall Summary Card */}
                <div className="bg-laip-cyan/5 border border-laip-cyan/20 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-2 flex justify-between items-center">
                    <span className="flex items-center gap-1.5"><Activity size={12} className="text-laip-cyan" /> Streetlights Overview</span>
                    <span className="text-[10px] bg-laip-cyan/25 text-laip-cyan px-2 py-0.5 rounded font-bold uppercase tracking-wider">Live</span>
                  </div>
                  
                  {/* Grid stats */}
                  <div className="grid grid-cols-2 gap-2 text-center mb-2.5">
                    <div className="bg-black/35 border border-white/5 p-2 rounded">
                      <div className="text-[9px] text-gray-500 uppercase font-semibold">Total Assets</div>
                      <div className="text-xl font-bold font-mono text-white mt-0.5">{totalLights}</div>
                    </div>
                    <div className="bg-black/35 border border-white/5 p-2 rounded">
                      <div className="text-[9px] text-gray-500 uppercase font-semibold">Operational</div>
                      <div className="text-xl font-bold font-mono text-green-400 mt-0.5">{displayOkCount}</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[10px] text-gray-400 border-t border-white/5 pt-2">
                    <div className="flex justify-between">
                      <span>LED Fixtures (50W)</span>
                      <span className="text-yellow-100 font-semibold">{ledLightsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sodium Vapor (150W)</span>
                      <span className="text-amber-500 font-semibold">{sodiumLightsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Attention Needed</span>
                      <span className={`font-semibold ${displayFaultyLights.length > 0 ? 'text-red-400' : 'text-green-400'}`}>{displayFaultyLights.length}</span>
                    </div>
                  </div>
                </div>

                {/* Attention List Card */}
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 flex flex-col min-h-[220px]">
                  <div className="text-xs font-semibold text-gray-400 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-red-400"><AlertTriangle size={12} /> Maintenance Queue</span>
                    <span className="text-[9px] text-gray-500">{displayFaultyLights.length} issues</span>
                  </div>
                  
                  {displayFaultyLights.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-black/20 rounded border border-white/5">
                      <CheckCircle2 size={24} className="text-green-400 mb-2" />
                      <div className="text-xs text-gray-300 font-medium">All Systems Nominal</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">No anomalies detected</div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1 flex-1">
                      {displayFaultyLights.map((light: any, idx: number) => {
                        const isCritical = light.status === 'CRITICAL' || light.health_score < 50;
                        const statusColor = isCritical ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
                        return (
                          <div key={idx} className="flex items-center justify-between p-2 bg-black/40 border border-white/5 rounded hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-2">
                              <Lightbulb size={14} className={isCritical ? 'text-red-500 animate-pulse' : 'text-yellow-500'} />
                              <div>
                                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                  {light.asset_id}
                                  <span className={`text-[8px] px-1 py-0.2 rounded font-semibold border ${statusColor}`}>
                                    {light.status}
                                  </span>
                                </div>
                                <div className="text-[9px] text-gray-400">
                                  Health: {light.health_score}/100 · {light.light_type}
                                </div>
                                <div className="text-[9px] text-red-400/80 truncate max-w-[160px] mt-0.5">
                                  {light.detected_issues?.[0] || 'Anomaly detected'}
                                </div>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent('laip-streetlight-flyto', { detail: { assetId: light.asset_id } }));
                              }}
                              title={`Focus camera on ${light.asset_id}`}
                              className="p-1.5 hover:bg-white/10 rounded text-laip-cyan hover:text-cyan-300 cursor-pointer border border-transparent hover:border-laip-cyan/30 transition-all shrink-0"
                            >
                              <ArrowUpRight size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {isRain && (
                  <>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1 flex justify-between">
                        <span>Rain Intensity</span>
                        <span className={rainStat.color}>{rainStat.text}</span>
                      </div>
                      <div className="text-2xl font-mono text-white flex items-end gap-1">
                        {rainIntensity?.toFixed(1)} <span className="text-sm text-gray-500 mb-1">mm/hr</span>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1 flex justify-between">
                        <span>Wind Speed</span>
                        <span className={windStat.color}>{windStat.text}</span>
                      </div>
                      <div className="text-2xl font-mono text-white flex items-end gap-1">
                        {windSpd} <span className="text-sm text-gray-500 mb-1">km/h</span>
                      </div>
                    </div>
                  </>
                )}

                {isEvSim && (
                  <>
                    {/* Total Grid Load */}
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1 flex justify-between">
                        <span className="flex items-center gap-1"><Zap size={10} className="text-amber-400" /> Total Grid Load</span>
                        <span className={gridStatus.color}>{gridStatus.text}</span>
                      </div>
                      <div className="text-2xl font-mono text-white flex items-end gap-1">
                        {liveGridMW} <span className="text-sm text-gray-500 mb-1">MW</span>
                      </div>
                      <div className="mt-2 text-[10px] text-gray-500">
                        {SUB_CAPACITIES.map((s, i) => (
                          <div key={i} className="flex justify-between mt-0.5">
                            <span>{s.name}</span>
                            <span className="text-yellow-400/70">{(s.capacity * s.loadFactor * 0.9).toFixed(2)} MW</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* EV Charging Load */}
                    <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1 flex justify-between">
                        <span className="flex items-center gap-1"><Radio size={10} className="text-green-400" /> EV Charging Load</span>
                        <span className="text-green-400">Active</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="text-3xl font-light text-white tracking-tight leading-none">{liveEvActivePercentage}<span className="text-sm text-gray-500 ml-1">%</span></div>
                        <div className="text-[9px] uppercase tracking-wider text-orange-400 font-semibold mb-1">High Demand</div>
                      </div>
                      <div className="mt-1 text-[10px] text-gray-500">
                        {TOTAL_EV_STATIONS} stations × {EV_KW_PER_STATION} kW DC fast charge
                        <div className="mt-0.5 text-green-400/60">{Math.round(EV_ACTIVE_RATE * 100)}% utilization rate</div>
                      </div>
                    </div>
                  </>
                )}

                {((!isRain && !isNight && !isEvSim)) && (
                  <>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1 flex justify-between">
                        <span>Total Grid Load</span>
                        <span className="text-laip-cyan">Nominal</span>
                      </div>
                      <div className="text-2xl font-mono text-white flex items-end gap-1">
                        4.2 <span className="text-sm text-gray-500 mb-1">MW</span>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1 flex justify-between">
                        <span>EV Charging Active</span>
                        <span className="text-laip-orange">High Demand</span>
                      </div>
                      <div className="text-2xl font-mono text-white flex items-end gap-1">
                        85 <span className="text-sm text-gray-500 mb-1">%</span>
                      </div>
                    </div>
                  </>
                )}

                {(isNight && !isRain && !isEvSim) && (
                  <div className="text-sm text-gray-500 italic p-4 bg-black/20 rounded-lg border border-white/5 text-center">
                    No data available
                  </div>
                )}
              </>
            )}
          </div>
        </section>


        {/* Simulation Controls Section */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sliders size={14} className="text-laip-cyan" /> Simulation Controls
          </h2>

          <div className="space-y-3">
            {isStreetlightsActive && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-gray-400">
                <span className="font-semibold text-white">Simulation: Streetlights</span>
                <p className="mt-1 text-[10px] text-gray-500 leading-relaxed">
                  Streetlight intelligence layers are active. Click on any streetlight bulb in the 3D viewport to inspect detailed AI diagnostics and chat with the Copilot.
                </p>
              </div>
            )}

            {!isStreetlightsActive && isRain && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2">Rain Intensity Control</div>
                <input
                  type="range"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={rainIntensity || 5}
                  onChange={handleIntensityChange}
                  className="w-full accent-laip-cyan cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>Light</span>
                  <span>Violent</span>
                </div>
              </div>
            )}

            {!isStreetlightsActive && isEvSim && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2 flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    Layer Transparency
                    <button onClick={handleTransparencyReset} title="Reset" className={`cursor-pointer transition-colors ${transparency !== 50 ? 'text-yellow-300' : 'text-gray-500 cursor-default'}`}>
                      <RefreshCw size={12} />
                    </button>
                  </span>
                  <span className={`text-[10px] font-semibold ${isPipelineDim ? 'text-yellow-400' : isBuildingDim ? 'text-amber-400' : 'text-gray-500'}`}>
                    {isPipelineDim ? 'Pipelines Dimmed' : isBuildingDim ? 'Buildings Dimmed' : 'Balanced'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={transparency}
                  onChange={handleTransparencyChange}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span className="text-yellow-400/70">← Dim Pipelines</span>
                  <span className="text-amber-400/70">Dim Buildings →</span>
                </div>
              </div>
            )}

            {!isStreetlightsActive && !isRain && !isEvSim && (isNight ? (
              <div className="text-sm text-gray-500 italic p-4 bg-black/20 rounded-lg border border-white/5 text-center">
                No data available
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic p-4 bg-black/20 rounded-lg border border-white/5 text-center">
                No active simulation
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Drone Cam Flight Controls Section (Displayed above AI Copilot border when Drone Cam is ON) */}
      {cameraMode === 'drone' && (
        <section className="mt-4 pt-4 border-t border-laip-border">
          <h2 className="text-xs font-semibold text-laip-cyan uppercase tracking-widest mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Navigation size={14} className="text-laip-cyan animate-pulse" /> Drone Cam Controls
            </span>
            <span className="text-[9px] bg-laip-cyan/20 text-laip-cyan px-2 py-0.5 rounded font-mono font-semibold">ON</span>
          </h2>

          <div className="bg-black/40 border border-laip-cyan/30 rounded-lg p-3 space-y-2.5">
            {/* WSAD Movement */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">Movement (WASD)</span>
              <div className="flex items-center gap-1 font-mono">
                {['W', 'A', 'S', 'D'].map(k => (
                  <kbd key={k} className={`w-6 h-6 flex items-center justify-center rounded border text-[11px] font-bold shadow ${getKeyStyle(k)}`}>
                    {k}
                  </kbd>
                ))}
              </div>
            </div>

            {/* Q & E Roll/Elevation */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">Roll / Altitude (QE)</span>
              <div className="flex items-center gap-1 font-mono">
                {['Q', 'E'].map(k => (
                  <kbd key={k} className={`w-6 h-6 flex items-center justify-center rounded border text-[11px] font-bold shadow ${getKeyStyle(k)}`}>
                    {k}
                  </kbd>
                ))}
              </div>
            </div>

            {/* Arrow Keys */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">Arrow Steer</span>
              <div className="flex items-center gap-1 font-mono">
                {[
                  { label: '↑', key: 'ArrowUp' },
                  { label: '↓', key: 'ArrowDown' },
                  { label: '←', key: 'ArrowLeft' },
                  { label: '→', key: 'ArrowRight' }
                ].map(item => (
                  <kbd key={item.key} className={`w-6 h-6 flex items-center justify-center rounded border text-[11px] font-bold shadow ${getKeyStyle(item.key)}`}>
                    {item.label}
                  </kbd>
                ))}
              </div>
            </div>

            {/* Mouse Steering */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
              <span className="text-gray-400 text-[11px]">Look & Pitch</span>
              <span className="text-[10px] font-mono text-laip-cyan bg-laip-cyan/10 px-2 py-0.5 rounded border border-laip-cyan/20">Mouse Drag</span>
            </div>
          </div>
        </section>
      )}

      {/* AI Copilot Placeholder */}
      <div className="mt-4 pt-4 border-t border-laip-border">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <MessageSquare size={14} className="text-laip-cyan" /> AI Copilot
        </h2>
        <div className="bg-black/40 rounded-lg p-3 border border-white/5">
          <div className="text-sm text-gray-400 italic mb-3">"What happens to the local grid if 10 EV chargers pull max power?"</div>
          <div className="relative">
            <input
              type="text"
              placeholder="Ask Copilot..."
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-laip-cyan/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
