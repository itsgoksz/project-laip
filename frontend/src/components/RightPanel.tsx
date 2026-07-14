import { Activity, Zap, Cpu, MessageSquare } from 'lucide-react';

export const RightPanel = () => {
  return (
    <div className="w-80 border-l border-laip-border bg-laip-panel p-4 flex flex-col h-full shrink-0 z-10 backdrop-blur-md">
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pr-2">
        
        {/* Telemetry Section */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity size={14} className="text-laip-orange" /> Live Telemetry
          </h2>
          
          <div className="space-y-3">
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
          </div>
        </section>

        {/* Assets Section */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" /> Active Alerts
          </h2>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <div className="text-sm font-semibold text-orange-400 mb-1">Transformer Load Warning</div>
            <div className="text-xs text-gray-400">Substation B approaching 90% capacity due to EV charging spikes.</div>
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
