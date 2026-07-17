import { ChevronRight, ChevronDown, Building2, Layers, Cpu, Wind, CloudRain, Moon, EvCharger, Eye, EyeOff, Zap, Radio, Network } from 'lucide-react';
import { useState, useEffect } from 'react';

const TreeNode = ({ label, icon: Icon, children, defaultExpanded = false }: any) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="ml-2">
      <div 
        className="flex items-center p-2 rounded hover:bg-white/10 cursor-pointer text-sm transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {children ? (
          expanded ? <ChevronDown size={14} className="mr-1 text-laip-cyan" /> : <ChevronRight size={14} className="mr-1 text-laip-cyan" />
        ) : (
          <div className="w-[18px]" />
        )}
        {Icon && <Icon size={14} className="mr-2 text-gray-400" />}
        <span className="text-gray-200">{label}</span>
      </div>
      {expanded && children && (
        <div className="ml-4 border-l border-laip-border/50 pl-2">
          {children}
        </div>
      )}
    </div>
  );
};

const CollapsibleSection = ({ title, children, defaultExpanded = true, action }: any) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="mb-6">
      <div 
        className="flex items-center justify-between cursor-pointer group mb-3" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest group-hover:text-laip-cyan transition-colors">{title}</h2>
          {action && (
            <div onClick={(e) => e.stopPropagation()}>
              {action}
            </div>
          )}
        </div>
        {expanded ? <ChevronDown size={14} className="text-gray-500 group-hover:text-laip-cyan" /> : <ChevronRight size={14} className="text-gray-500 group-hover:text-laip-cyan" />}
      </div>
      {expanded && <div>{children}</div>}
    </div>
  );
};

export const Sidebar = ({ isNight = false, isRain = false, isEvSim = false, assetCounts }: { isNight?: boolean, isRain?: boolean, isEvSim?: boolean, assetCounts?: any }) => {
  const [masterVisible, setMasterVisible] = useState(true);
  const [assetFilters, setAssetFilters] = useState({
    all: true,
    apartments: false,
    restaurants: false,
    hospital: false,
    evStations: false
  });

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('laip-asset-filter', { detail: { ...assetFilters, masterVisible } }));
  }, [assetFilters, masterVisible]);

  const handleFilterChange = (key: keyof typeof assetFilters) => {
    setAssetFilters(prev => {
      if (key === 'all') {
        return { all: true, apartments: false, restaurants: false, hospital: false, evStations: false };
      } else {
        const next = { ...prev, [key]: !prev[key], all: false };
        const anyTrue = Object.entries(next).some(([k, v]) => k !== 'all' && v);
        if (!anyTrue) next.all = true;
        return next;
      }
    });
  };

  // EV Power Grid hierarchy selection: null = Main Grid (full view), 0/1/2 = specific sub
  const [selectedGridBranch, setSelectedGridBranch] = useState<number | null>(null);

  const selectGridBranch = (subIdx: number | null) => {
    setSelectedGridBranch(subIdx);
    window.dispatchEvent(new CustomEvent('laip-grid-select', { detail: { subIdx } }));
  };

  // Reset grid branch when EV sim is turned off
  useEffect(() => {
    if (!isEvSim) {
      setSelectedGridBranch(null);
      window.dispatchEvent(new CustomEvent('laip-grid-select', { detail: { subIdx: null } }));
    }
  }, [isEvSim]);

  return (
    <div className="w-72 border-r border-laip-border bg-laip-panel p-4 flex flex-col h-full shrink-0 z-10 backdrop-blur-md">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-laip-cyan/10 flex items-center justify-center border border-laip-cyan/30 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
          <Building2 size={20} className="text-laip-cyan" />
        </div>
        <div>
          <div className="flex items-start gap-2">
            <h1 className="text-lg font-bold tracking-wider leading-tight">
              LAIP
            </h1>

            <span className="text-[9px] text-gray-400 font-medium mt-0.5">
              v1.0.0
            </span>
          </div>

          <div className="text-[10px] text-laip-cyan uppercase tracking-widest font-semibold">
            Management System
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {/* EV Power Grid Hierarchy — only visible when EV simulation is on */}
        {isEvSim && (
          <CollapsibleSection title="EV Power Grid" defaultExpanded>
            <div className="ml-2">
              {/* Main Grid / Full View Row */}
              <div
                onClick={() => selectGridBranch(null)}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm transition-all border mb-1 ${
                  selectedGridBranch === null
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                    : 'hover:bg-white/10 border-transparent text-gray-400'
                }`}
              >
                <div className="flex items-center justify-center w-5 h-5 rounded bg-amber-500/20 shrink-0">
                  <Zap size={11} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold truncate">BESCOM JP Nagar</div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider">Main Power Grid</div>
                </div>
                {selectedGridBranch === null && (
                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider shrink-0">Full View</span>
                )}
              </div>

              {/* Substations */}
              <div className="ml-2 pl-3 border-l border-amber-500/25 space-y-1">
                {[
                  { name: 'Sarakki Sub-Station', feeder: 'JPR-F04', evCount: 4 },
                  { name: 'BTM Layout Sub-Station', feeder: 'BTM-F07', evCount: 3 },
                  { name: 'Bannerghatta Rd Sub-Station', feeder: 'BNR-F02', evCount: 3 },
                ].map((sub, i) => (
                  <div
                    key={i}
                    onClick={() => selectGridBranch(i)}
                    className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all border ${
                      selectedGridBranch === i
                        ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300 shadow-[0_0_6px_rgba(234,179,8,0.2)]'
                        : 'hover:bg-white/10 border-transparent text-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-center w-4 h-4 rounded bg-yellow-500/20 shrink-0">
                      <Radio size={9} className="text-yellow-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium truncate">{sub.name}</div>
                      <div className="text-[8px] text-gray-600 uppercase tracking-wider">{sub.feeder} · {sub.evCount} EV stations</div>
                    </div>
                    {selectedGridBranch === i && (
                      <span className="text-[8px] font-bold text-yellow-400 uppercase shrink-0">Branch</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Legend */}
              {selectedGridBranch !== null && (
                <div className="mt-3 p-2 bg-black/30 rounded border border-white/5 flex items-start gap-2">
                  <Network size={10} className="text-gray-500 mt-0.5 shrink-0" />
                  <div className="text-[9px] text-gray-500 leading-relaxed">
                    Showing branch: <span className="text-yellow-400">Main Grid → Sub-Station → EV Stations</span>. Other branches hidden.
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Static Asset Hierarchy — hide when EV simulation is on */}
        {!isEvSim && (
          <CollapsibleSection title="Asset Hierarchy" defaultExpanded={false}>
          <TreeNode label="HQ Campus" icon={Building2} defaultExpanded>
            <TreeNode label="Building A" icon={Building2} defaultExpanded>
              <TreeNode label="Floor 1" icon={Layers}>
                <TreeNode label="Lobby HVAC" icon={Wind} />
                <TreeNode label="Server Room AC" icon={Wind} />
              </TreeNode>
              <TreeNode label="Floor 2 (Labs)" icon={Layers} />
            </TreeNode>
            <TreeNode label="Parking Garage" icon={Building2} defaultExpanded>
              <TreeNode label="Level G" icon={Layers} defaultExpanded>
                <TreeNode label="EV Charger Station 1" icon={Cpu} />
                <TreeNode label="EV Charger Station 2" icon={Cpu} />
                <TreeNode label="EV Charger Station 3" icon={Cpu} />
              </TreeNode>
            </TreeNode>
          </TreeNode>
          </CollapsibleSection>
        )}

        <CollapsibleSection 
          title="Assets" 
          defaultExpanded
          action={
            <button 
              onClick={() => setMasterVisible(!masterVisible)}
              className="text-gray-500 hover:text-laip-cyan transition-colors flex items-center justify-center ml-1"
              title={masterVisible ? "Hide all assets" : "Show all assets"}
            >
              {masterVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          }
        >
          <div className="space-y-2.5 text-sm text-gray-300 ml-2">
            {[
              { id: 'all', label: 'All', count: assetCounts ? (assetCounts.apartments + assetCounts.restaurants + assetCounts.hospital + assetCounts.evStations) : 0 },
              { id: 'apartments', label: 'Apartments', count: assetCounts?.apartments || 0 },
              { id: 'restaurants', label: 'Restaurants', count: assetCounts?.restaurants || 0 },
              { id: 'hospital', label: 'Hospital', count: assetCounts?.hospital || 0 },
              { id: 'evStations', label: 'EV Stations', count: assetCounts?.evStations || 0 }
            ].map(item => (
              <label key={item.id} className="flex items-center gap-3 cursor-pointer group transition-colors ml-[32px] py-0.5">
                <input 
                  type="checkbox" 
                  checked={assetFilters[item.id as keyof typeof assetFilters]}
                  onChange={() => handleFilterChange(item.id as keyof typeof assetFilters)}
                  className="w-4 h-4 appearance-none rounded-sm border border-white/20 bg-black/50 checked:bg-laip-cyan/20 checked:border-laip-cyan cursor-pointer transition-all relative flex items-center justify-center after:content-[''] checked:after:block after:hidden after:w-1.5 after:h-2.5 after:border-r-2 after:border-b-2 after:border-laip-cyan after:rotate-45 after:-mt-1 hover:border-white/40 shadow-[0_0_10px_rgba(0,240,255,0)] checked:shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                />
                <span className="text-gray-400 group-hover:text-gray-200 transition-colors">{item.label} {item.count ? `(${item.count})` : ''}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Simulations" defaultExpanded>
          <div className="space-y-1">
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('laip-sim', { detail: { type: 'toggle-rain' } }))}
              className={`w-full flex items-center p-2 rounded text-sm transition-all border cursor-pointer ${
                isRain 
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.3)]' 
                  : 'hover:bg-white/10 border-transparent text-gray-200'
              }`}
            >
              <CloudRain size={16} className={`mr-3 ${isRain ? 'text-cyan-400' : 'text-cyan-400/60'}`} />
              <span>Rain Simulation</span>
              {isRain && <span className="ml-auto text-[10px] font-bold text-cyan-400 uppercase tracking-wider">ON</span>}
            </button>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('laip-sim', { detail: { type: 'toggle-night' } }))}
              className={`w-full flex items-center p-2 rounded text-sm transition-all border cursor-pointer ${
                isNight 
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.3)]' 
                  : 'hover:bg-white/10 border-transparent text-gray-200'
              }`}
            >
              <Moon size={16} className={`mr-3 ${isNight ? 'text-indigo-400' : 'text-indigo-400/60'}`} />
              <span>Night View</span>
              {isNight && <span className="ml-auto text-[10px] font-bold text-indigo-400 uppercase tracking-wider">ON</span>}
            </button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Simulation Use Cases" defaultExpanded>
          <div className="space-y-1">
            <button 
              onClick={() => {
                const nextState = !isEvSim;
                window.dispatchEvent(new CustomEvent('laip-ev-sim', { detail: { type: 'toggle-ev-sim' } }));
                if (nextState) {
                  // Select only EV stations when turning simulation ON
                  setAssetFilters({
                    all: false,
                    apartments: false,
                    restaurants: false,
                    hospital: false,
                    evStations: true
                  });
                }
              }}
              className={`w-full flex items-center p-2 rounded text-sm transition-all border cursor-pointer ${
                isEvSim 
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                  : 'hover:bg-white/10 border-transparent text-gray-200'
              }`}
            >
              <EvCharger size={16} className={`mr-3 ${isEvSim ? 'text-amber-400' : 'text-amber-400/60'}`} />
              <span>EV Station Simulation</span>
              {isEvSim && <span className="ml-auto text-[10px] font-bold text-amber-400 uppercase tracking-wider">ON</span>}
            </button>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
};
