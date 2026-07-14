import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { RightPanel } from './components/RightPanel';
import { BottomBar } from './components/BottomBar';
import { SceneViewer } from './components/SceneViewer';
import { CityStreetViewer } from './components/CityStreetViewer';

function App() {
  const [activeView, setActiveView] = useState<'zeon' | 'city'>('zeon');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-laip-bg text-white font-sans selection:bg-laip-cyan selection:text-black">
      {/* Left Sidebar */}
      <Sidebar />
      
      {/* Main Center Area */}
      <div className="flex-1 flex flex-col relative h-full min-w-0">
        
        {/* Top Navigation / Header */}
        <header className="h-14 border-b border-laip-border bg-laip-panel/50 backdrop-blur-md absolute top-0 left-0 w-full z-10 flex items-center px-6 justify-between">
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
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-laip-cyan shadow-[0_0_8px_#00f0ff]"></span>
              <span className="text-gray-300">System Online</span>
            </div>
          </div>
        </header>

        {/* 3D Scene */}
        <div className="flex-1 w-full h-full relative">
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
