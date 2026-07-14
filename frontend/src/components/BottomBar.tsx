import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useState, useEffect } from 'react';

export const BottomBar = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(p => {
          const next = p >= 100 ? 100 : p + 0.3;
          if (next >= 100) setIsPlaying(false);
          return next;
        });
      }, 16);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('sim-progress', { detail: progress }));
  }, [progress]);

  return (
    <div className="h-16 border-t border-laip-border bg-laip-panel flex items-center px-6 shrink-0 z-10 backdrop-blur-md">
      <div className="flex items-center gap-4 w-48">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Simulation</h3>
        <span className="text-laip-cyan text-xs font-mono bg-laip-cyan/10 px-2 py-1 rounded">14:30:00</span>
      </div>
      
      <div className="flex-1 flex items-center gap-4 px-8">
        <div className="flex items-center gap-2">
          <button 
            className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
            onClick={() => setProgress(0)}
          >
            <SkipBack size={16} />
          </button>
          <button 
            className="p-2 bg-laip-cyan/20 hover:bg-laip-cyan/30 rounded-full text-laip-cyan border border-laip-cyan/50 transition-colors"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
            <SkipForward size={16} />
          </button>
        </div>
        
        <div className="flex-1 relative flex items-center h-full">
          <div className="absolute w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-laip-cyan rounded-full transition-all duration-300 relative shadow-[0_0_10px_rgba(0,240,255,0.8)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={progress}
            onChange={(e) => setProgress(parseInt(e.target.value))}
            className="w-full absolute opacity-0 cursor-pointer"
          />
        </div>
      </div>
      
      <div className="w-48 flex justify-end">
        <div className="text-xs text-gray-500">Scenario: <span className="text-gray-300">Peak Load Test</span></div>
      </div>
    </div>
  );
};
