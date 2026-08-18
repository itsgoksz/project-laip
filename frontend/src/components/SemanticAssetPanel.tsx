import React, { useEffect } from 'react';

export const SemanticAssetPanel = ({ onClose, data }: { onClose: () => void, data?: any }) => {
  const isOnline = data?.status !== false;
  
  // Disable body scroll just in case
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto"
      onWheel={(e) => { e.stopPropagation(); }}
      onPointerDown={(e) => { e.stopPropagation(); }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      
      {/* Modal Content */}
      <div 
        className="bg-[#0f141e]/95 backdrop-blur-md rounded-lg shadow-2xl overflow-hidden border border-[#1e293b] relative z-10" 
        style={{ width: '360px', fontFamily: 'Inter, sans-serif' }}
      >
        {/* Header Image */}
      <div className="h-32 bg-gray-800 relative">
        <img 
          src="https://images.unsplash.com/photo-1593941707882-a5bba14938c7?q=80&w=2072&auto=format&fit=crop" 
          alt="EV Charger Interior" 
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f141e]/95 to-transparent"></div>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-2 right-2 bg-black/60 hover:bg-black text-white rounded-full w-7 h-7 flex items-center justify-center transition-colors border border-white/20"
        >
          ✕
        </button>
      </div>
      
      {/* Content */}
      <div className="p-4 -mt-6 relative z-10">
        <h2 className="text-lg font-bold text-white mb-1">{data?.operator || "Zeon"} {data?.power || 150}kW Unit</h2>
        <p className="text-[10px] text-cyan-400 mb-4 uppercase tracking-wider font-semibold">
          {data?.connectionType || "DC Fast Charger"} • ID: {data?.id || "ZN-BLR-04"} • 
          <span className={isOnline ? "text-green-400 ml-1" : "text-red-400 ml-1"}>
            {isOnline ? "ONLINE" : "OFFLINE"}
          </span>
        </p>
        
        <div className="flex gap-2 mb-4">
          <button className="bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-200 text-[10px] px-3 py-1.5 rounded font-medium transition-colors">
            View Service Log
          </button>
          <button className="bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-200 text-[10px] px-3 py-1.5 rounded font-medium transition-colors">
            Download Report
          </button>
        </div>

        <div className="text-xs text-slate-300 leading-relaxed space-y-3 mb-5">
          <p>
            The object highlighted in the space is a <strong className="text-white">{data?.power || 150}kW {data?.connectionType || "DC"} Charging Module</strong> operated by {data?.operator || "Zeon"}. It features liquid-cooled cables and a direct connection to the internal power conversion matrix. 
          </p>
          <p>
            {isOnline 
              ? "The latest weekly diagnostic report indicates a slight thermal variance on the left connector pin. Nominal operation continues."
              : "ALERT: This station is currently reporting an OFFLINE status to the Open Charge Map network. Maintenance required."}
          </p>
        </div>

        {/* AI Chat Example */}
        <div className="bg-cyan-900/40 text-cyan-50 p-2.5 rounded-lg text-[11px] mb-3 ml-6 rounded-tr-none border border-cyan-800/50">
          What is the recommended service schedule for this unit based on the current status?
        </div>
        
        <div className="text-[11px] text-slate-400 mb-4 border-l-2 border-cyan-600 pl-2">
          {isOnline 
            ? "The AI recommends scheduling a Level 2 physical inspection within 14 days, focusing on the coolant flow rate and connector pin resistance."
            : "The AI recommends immediately dispatching a Level 3 technician to investigate the offline status and verify grid connectivity."}
        </div>
        
        {/* Input */}
        <div className="relative mt-2">
          <input 
            type="text" 
            placeholder="Ask AI Copilot..." 
            className="w-full bg-[#1e293b] border border-[#334155] rounded-full py-1.5 pl-3 pr-8 text-[11px] text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500"
          />
          <button className="absolute right-2 top-1.5 text-cyan-500 hover:text-cyan-300">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};
