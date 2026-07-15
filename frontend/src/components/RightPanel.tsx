import { Activity, MessageSquare, Sliders } from 'lucide-react';

export const RightPanel = ({ isNight, isRain, isEvSim, rainIntensity }: any) => {

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

  const rainStat = getRainStatus(rainIntensity || 5);
  const windSpd = Math.floor((rainIntensity || 5) * 1.5 + 5);
  const windStat = getWindStatus(windSpd);

  return (
    <div className="w-80 border-l border-laip-border bg-laip-panel p-4 flex flex-col h-full shrink-0 z-10 backdrop-blur-md">
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pr-2">

        {/* Telemetry Section */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity size={14} className="text-laip-orange" /> Live Telemetry
          </h2>

          <div className="space-y-3">
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

            {((!isRain && !isNight) || isEvSim) && (
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
          </div>
        </section>

        {/* Alerts Section */}
        {/* <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" /> Active Alerts
          </h2>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <div className="text-sm font-semibold text-orange-400 mb-1">Transformer Load Warning</div>
            <div className="text-xs text-gray-400">Substation B approaching 90% capacity due to EV charging spikes.</div>
          </div>
        </section> */}


        {/* Simulation Controls Section */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Sliders size={14} className="text-laip-cyan" /> Simulation Controls
          </h2>

          <div className="space-y-3">
            {isRain ? (
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
            ) : (isNight || isEvSim) ? (
              <div className="text-sm text-gray-500 italic p-4 bg-black/20 rounded-lg border border-white/5 text-center">
                No data available
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic p-4 bg-black/20 rounded-lg border border-white/5 text-center">
                No active simulation
              </div>
            )}
          </div>
        </section>

      </div>

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
