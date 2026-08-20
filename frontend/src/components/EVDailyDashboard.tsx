import React, { useMemo } from 'react';
import { Zap, Activity, IndianRupee, MapPin, X } from 'lucide-react';

export const EVDailyDashboard = ({
  evStations,
  stationMetrics,
  onClose
}: {
  evStations: any[];
  stationMetrics: any;
  onClose: () => void;
}) => {
  // Compute aggregate stats across all stations
  const { totals, stationStats } = useMemo(() => {
    let totalCars = 0;
    let totalKWh = 0;
    let totalRev = 0;

    const stats = evStations.map(st => {
      const metrics = stationMetrics?.[st.id] || { totalCarsServed: 0, totalEnergyKWh: 0, totalRevenue: 0 };
      const cars = Math.round(metrics.totalCarsServed || 0);
      const energy = Math.round(metrics.totalEnergyKWh || 0);
      const rev = Math.round(metrics.totalRevenue || 0);

      totalCars += cars;
      totalKWh += energy;
      totalRev += rev;

      return {
        ...st,
        cars,
        energy,
        rev
      };
    });

    return {
      totals: { cars: totalCars, energy: totalKWh, rev: totalRev },
      stationStats: stats.sort((a, b) => b.rev - a.rev)
    };
  }, [evStations, stationMetrics]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
      <div className="bg-[#040e19]/90 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-2xl w-full max-w-5xl flex flex-col overflow-hidden backdrop-blur-xl relative">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-gradient-to-r from-laip-cyan/10 to-transparent">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-laip-cyan/20 rounded-xl border border-laip-cyan/30 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
              <Activity className="w-6 h-6 text-laip-cyan" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-wider">GLOBAL EV ANALYTICS</h2>
              <p className="text-sm text-gray-400 font-medium tracking-widest uppercase mt-1">Live JP Nagar Station Metrics</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Global Summary Cards */}
        <div className="grid grid-cols-3 gap-6 p-6 bg-black/20">
          <div className="bg-[#0a1929] border border-white/5 rounded-xl p-5 flex items-center gap-5 shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="p-4 bg-blue-500/20 rounded-xl border border-blue-500/30">
              <Zap className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-blue-400/80 font-bold tracking-widest uppercase mb-1">Total Energy Delivered</p>
              <div className="text-3xl font-black text-white flex items-baseline gap-2">
                {totals.energy.toLocaleString()} <span className="text-lg text-gray-500 font-medium">kWh</span>
              </div>
            </div>
          </div>
          
          <div className="bg-[#0a1929] border border-white/5 rounded-xl p-5 flex items-center gap-5 shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="p-4 bg-green-500/20 rounded-xl border border-green-500/30">
              <IndianRupee className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-green-400/80 font-bold tracking-widest uppercase mb-1">Gross Revenue</p>
              <div className="text-3xl font-black text-white flex items-baseline gap-2">
                <span className="text-green-500">₹</span> {totals.rev.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-[#0a1929] border border-white/5 rounded-xl p-5 flex items-center gap-5 shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-laip-cyan/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="p-4 bg-laip-cyan/20 rounded-xl border border-laip-cyan/30">
              <Activity className="w-8 h-8 text-laip-cyan" />
            </div>
            <div>
              <p className="text-sm text-laip-cyan/80 font-bold tracking-widest uppercase mb-1">Total Vehicles Served</p>
              <div className="text-3xl font-black text-white flex items-baseline gap-2">
                {totals.cars.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Stations Table */}
        <div className="flex-1 overflow-auto p-6 pt-0">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="pb-3 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10">Station Name</th>
                <th className="pb-3 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10">Location Type</th>
                <th className="pb-3 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 text-right">Vehicles Served</th>
                <th className="pb-3 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 text-right">Energy (kWh)</th>
                <th className="pb-3 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 text-right">Revenue (₹)</th>
              </tr>
            </thead>
            <tbody>
              {stationStats.map((st, idx) => (
                <tr key={st.id} className="bg-white/5 hover:bg-white/10 transition-colors group">
                  <td className="p-4 rounded-l-lg border-y border-l border-white/5 group-hover:border-white/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-white font-bold tracking-wide">{st.name || st.label}</div>
                        <div className="text-xs text-gray-400 mt-1 uppercase tracking-widest flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {st.address || "JP Nagar Area"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 border-y border-white/5 group-hover:border-white/20">
                    <span className="px-3 py-1 bg-white/10 text-white rounded-full text-xs font-bold uppercase tracking-widest">
                      {st.placement || "HUB"}
                    </span>
                  </td>
                  <td className="p-4 text-right border-y border-white/5 group-hover:border-white/20">
                    <span className="text-white font-bold text-lg">{st.cars.toLocaleString()}</span>
                  </td>
                  <td className="p-4 text-right border-y border-white/5 group-hover:border-white/20">
                    <span className="text-blue-400 font-bold text-lg">{st.energy.toLocaleString()}</span>
                  </td>
                  <td className="p-4 text-right rounded-r-lg border-y border-r border-white/5 group-hover:border-white/20">
                    <span className="text-green-400 font-bold text-lg">₹{st.rev.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
