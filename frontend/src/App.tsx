import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { RightPanel } from './components/RightPanel';
import { BottomBar } from './components/BottomBar';
import { SceneViewer } from './components/SceneViewer';
import { CityStreetViewer } from './components/CityStreetViewer';

function App() {
  const [activeView, setActiveView] = useState<'zeon' | 'city'>('city');
  const [weather, setWeather] = useState<any>(null);
  const [isNight, setIsNight] = useState(false);
  const [isRain, setIsRain] = useState(false);

  // Listen for weather/sim events from CityStreetViewer
  useEffect(() => {
    const handleWeather = (e: any) => {
      setWeather(e.detail.weather);
      setIsNight(e.detail.isNight);
      setIsRain(e.detail.isRain);
    };
    const handleSim = (e: any) => {
      if (e.detail.type === 'toggle-rain') setIsRain(prev => !prev);
      if (e.detail.type === 'toggle-night') setIsNight(prev => !prev);
    };
    window.addEventListener('laip-weather', handleWeather);
    window.addEventListener('laip-sim', handleSim);
    return () => {
      window.removeEventListener('laip-weather', handleWeather);
      window.removeEventListener('laip-sim', handleSim);
    };
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-laip-bg text-white font-sans selection:bg-laip-cyan selection:text-black">
      {/* Left Sidebar */}
      <Sidebar isNight={isNight} isRain={isRain} />
      
      {/* Main Center Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        
        {/* Top Navigation / Header */}
        <header className="h-14 border-b border-laip-border bg-laip-panel/80 backdrop-blur-md z-20 flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold tracking-widest text-gray-400">LAIP <span className="text-laip-cyan">v1.0.0</span></span>
              <div className="h-4 w-px bg-laip-border"></div>
            </div>
            {/* View Tabs */}
            <div className="flex items-center bg-black/40 rounded border border-white/10 p-1">
              <button 
                onClick={() => setActiveView('zeon')}
                className={`px-4 py-1 rounded text-xs tracking-wider transition-colors ${activeView === 'zeon' ? 'bg-laip-cyan text-black font-bold' : 'text-gray-400 hover:text-white'}`}
              >
                ZEON HUB
              </button>
              <button 
                onClick={() => setActiveView('city')}
                className={`px-4 py-1 rounded text-xs tracking-wider transition-colors ${activeView === 'city' ? 'bg-laip-cyan text-black font-bold' : 'text-gray-400 hover:text-white'}`}
              >
                CITY STREET
              </button>
            </div>
            {/* Weather Indicators (only shown in City Street view when weather data available) */}
            {activeView === 'city' && weather && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-px bg-laip-border"></div>
                <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 text-white text-xs px-2.5 py-1 rounded">
                  <span className="text-gray-400 text-[10px] uppercase tracking-wider">Temp</span>
                  <span className="font-bold text-laip-cyan">{weather.temperature}°C</span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 text-white text-xs px-2.5 py-1 rounded">
                  <span className="text-gray-400 text-[10px] uppercase tracking-wider">Sky</span>
                  <span className="font-bold">{isRain ? '🌧 Rain' : (isNight ? '🌙 Night' : '☀ Clear')}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 text-white text-xs px-2.5 py-1 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                  <span className="font-bold text-blue-400">OpenSky</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-laip-cyan shadow-[0_0_8px_#00f0ff]"></span>
              <span className="text-gray-300">System Online</span>
            </div>
          </div>
        </header>

        {/* 3D Scene — sits below the header, no absolute positioning */}
        <div className="flex-1 w-full min-h-0 relative overflow-hidden">
          {activeView === 'zeon' ? <SceneViewer /> : <CityStreetViewer />}
        </div>
        
        {/* Bottom Timeline Bar */}
        <BottomBar />
      </div>
      
      {/* Right Intelligence Panel */}
      <RightPanel />
    </div>
  );
}

export default App;
