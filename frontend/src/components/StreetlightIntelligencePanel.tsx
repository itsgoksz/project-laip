import React, { useEffect, useState } from 'react';

export const StreetlightIntelligencePanel = ({ onClose, data }: { onClose: () => void, data?: any }) => {
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<{ sender: 'user' | 'ai', text: string }[]>([]);
  
  const isOnline = data?.status === 'OK';
  const healthColor = data?.health_score >= 80 ? 'text-green-400' : (data?.health_score >= 50 ? 'text-yellow-400' : 'text-red-400');
  const statusBg = data?.status === 'OK' ? 'bg-green-500/10 border-green-500/30 text-green-300' : (data?.status === 'WARNING' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' : 'bg-red-500/10 border-red-500/30 text-red-300');

  // Disable body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    // Set default AI recommendation
    let initialMessage = "";
    if (data?.status === 'OK') {
      initialMessage = `AI Copilot: Street light ${data?.asset_id} is operating nominally. Health score is ${data?.health_score}/100. Next routine maintenance is scheduled in 30 days.`;
    } else if (data?.status === 'WARNING') {
      initialMessage = `AI Copilot Alert: Street light ${data?.asset_id} is showing early signs of degradation. ${data?.recommendation?.reason}`;
    } else {
      initialMessage = `AI Copilot Critical Alert: Street light ${data?.asset_id} requires immediate inspection. ${data?.recommendation?.reason}`;
    }
    setChatLog([{ sender: 'ai', text: initialMessage }]);
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [data]);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userQuery = chatInput;
    setChatLog(prev => [...prev, { sender: 'user', text: userQuery }]);
    setChatInput('');

    // Generate responsive answer based on asset state
    setTimeout(() => {
      let aiResponse = "";
      const q = userQuery.toLowerCase();
      if (q.includes("health") || q.includes("score")) {
        aiResponse = `The health score of ${data?.health_score}/100 is computed from: ${data?.age_days} days of service, historical fault count, and electrical parameters.`;
      } else if (q.includes("recommend") || q.includes("fix") || q.includes("action") || q.includes("maintenance")) {
        aiResponse = `Recommended action: ${data?.recommendation?.action}. Priority is ${data?.recommendation?.priority}.`;
      } else if (q.includes("sodium") || q.includes("led") || q.includes("type")) {
        aiResponse = `This is a ${data?.light_type} streetlight rated for ${data?.power_rating}W. ${data?.light_type === 'Sodium' ? 'Sodium vapor lights consume more energy and have shorter bulb replacement cycles compared to LEDs.' : 'LED modules are highly efficient and draw minimal standby current.'}`;
      } else if (q.includes("anomaly") || q.includes("issue") || q.includes("problem")) {
        aiResponse = `Detected issues: ${data?.detected_issues?.join(', ') || 'None'}. Anomaly score is ${data?.anomaly_score}.`;
      } else {
        aiResponse = `Based on the diagnostic logs of ${data?.asset_id}, the recommended next step is: "${data?.recommendation?.action}". Let me know if you would like me to generate a work order ticket.`;
      }
      setChatLog(prev => [...prev, { sender: 'ai', text: aiResponse }]);
    }, 800);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto py-20"
      onWheel={(e) => { e.stopPropagation(); }}
      onPointerDown={(e) => { e.stopPropagation(); }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      
      {/* Modal Content */}
      <div 
        className="bg-[#0f141e]/95 backdrop-blur-md rounded-[1.5rem] shadow-2xl overflow-hidden border border-[#1e293b] relative z-10 flex flex-col" 
        style={{ width: '400px', maxHeight: '70vh', fontFamily: 'Inter, sans-serif' }}
      >
        {/* Header Photo */}
        <div className="h-32 bg-gray-800 relative shrink-0">
          <img 
            src={data?.light_type === 'Sodium' 
              ? "https://unsplash.com/photos/park-bench-under-a-lamppost-at-night-epv-w4fQnVA?q=80&w=2070&auto=format&fit=crop" // warm orange street light
              : "https://unsplash.com/photos/a-street-light-against-cloudy-twilight-background-copy-space-YXCXhfetDhc?q=80&w=2070&auto=format&fit=crop" // white LED streetlight
            } 
            alt="Streetlight" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f141e]/95 to-transparent"></div>
          
          <div className="absolute bottom-3 left-4">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${statusBg} uppercase tracking-wider`}>
              {data?.status}
            </span>
            <h2 className="text-xl font-bold text-white mt-1.5">{data?.asset_id}</h2>
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors border border-white/20 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
        
        {/* Body Content - Scrollable with min-h-0 for flex layout containment */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0 custom-scrollbar space-y-4">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3.5 bg-white/5 p-3.5 rounded-xl border border-white/5">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Light Source</div>
              <div className="text-xs font-semibold text-gray-200 mt-0.5">{data?.light_type} Vapor ({data?.power_rating}W)</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Health Index</div>
              <div className={`text-xs font-bold ${healthColor} mt-0.5`}>{data?.health_score} / 100</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Asset Lifespan</div>
              <div className="text-xs font-semibold text-gray-200 mt-0.5">{data?.age_days} days (~{round(data?.age_days / 365, 1)} yrs)</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Manufacturer</div>
              <div className="text-xs font-semibold text-gray-200 mt-0.5">{data?.manufacturer}</div>
            </div>
          </div>

          {/* Telemetry Metrics */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Live Sensor Readings</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-black/40 border border-white/5 p-2 rounded-lg">
                <div className="text-[9px] text-gray-500 uppercase font-semibold">Power</div>
                <div className="text-sm font-bold font-mono text-laip-cyan mt-0.5">{data?.power_consumption}W</div>
                <div className="text-[8px] text-gray-600 mt-0.5">Rating: {data?.power_rating}W</div>
              </div>
              <div className="bg-black/40 border border-white/5 p-2 rounded-lg">
                <div className="text-[9px] text-gray-500 uppercase font-semibold">Voltage</div>
                <div className="text-sm font-bold font-mono text-laip-cyan mt-0.5">{data?.voltage}V</div>
                <div className="text-[8px] text-gray-600 mt-0.5">Nominal: 225V</div>
              </div>
              <div className="bg-black/40 border border-white/5 p-2 rounded-lg">
                <div className="text-[9px] text-gray-500 uppercase font-semibold">Current</div>
                <div className="text-sm font-bold font-mono text-laip-cyan mt-0.5">{data?.current}A</div>
                <div className="text-[8px] text-gray-600 mt-0.5">Calculated</div>
              </div>
            </div>
          </div>

          {/* Anomalies section */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">ML Anomaly Analysis</h3>
            <div className="bg-black/40 border border-white/5 p-3 rounded-lg space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Outlier/Anomaly Score</span>
                <span className="font-mono text-yellow-500 font-bold">{data?.anomaly_score}</span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${data?.anomaly_detected ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-green-500'}`}
                  style={{ width: `${data?.anomaly_score * 100}%` }}
                ></div>
              </div>
              
              <div className="text-[10px] text-gray-400 leading-relaxed pt-1.5 border-t border-white/5">
                <span className="font-semibold text-slate-300">Issues Flagged:</span>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-300">
                  {data?.detected_issues?.map((issue: string, idx: number) => (
                    <li key={idx} className={data?.anomaly_detected ? "text-red-400" : "text-green-400"}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">AI Copilot Recommendation</h3>
            <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
              data?.recommendation?.priority === 'HIGH' 
                ? 'bg-red-500/10 border-red-500/30 text-red-200' 
                : (data?.recommendation?.priority === 'MEDIUM' 
                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-200' 
                    : 'bg-green-500/10 border-green-500/30 text-green-200')
            }`}>
              <div className="font-bold uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  data?.recommendation?.priority === 'HIGH' ? 'bg-red-500 animate-pulse' : (data?.recommendation?.priority === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500')
                }`}></span>
                Priority: {data?.recommendation?.priority}
              </div>
              <div className="font-semibold text-white mb-1.5">{data?.recommendation?.action}</div>
              <p className="text-gray-300 text-[11px]">{data?.recommendation?.reason}</p>
            </div>
          </div>

          {/* AI Chat Log */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Ask AI Copilot</h3>
            <div className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar">
              {chatLog.map((chat, idx) => (
                <div key={idx} className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-xl px-3 py-1.5 text-xs max-w-[85%] ${
                    chat.sender === 'user' 
                      ? 'bg-laip-cyan/20 text-laip-cyan rounded-tr-none border border-laip-cyan/30' 
                      : 'bg-white/5 text-gray-300 rounded-tl-none border border-white/5'
                  }`}>
                    {chat.text}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Input box */}
            <div className="relative mt-2">
              <input 
                type="text" 
                placeholder="Ask about health, recommendations, or ballast..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                className="w-full bg-[#1e293b] border border-[#334155] rounded-full py-2 pl-3 pr-9 text-[11px] text-white focus:outline-none focus:border-laip-cyan placeholder-slate-500"
              />
              <button 
                onClick={handleSendChat}
                className="absolute right-2.5 top-2 text-laip-cyan hover:text-cyan-300 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// Helper round utility
function round(value: any, decimals: number) {
  if (value === undefined || value === null) return 0;
  return Number(Math.round(+(value + 'e' + decimals)) + 'e-' + decimals);
}
