import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { RightPanel } from './components/RightPanel';
import { BottomBar } from './components/BottomBar';
import { SceneViewer } from './components/SceneViewer';
import { CityStreetViewer } from './components/CityStreetViewer';
import { ChevronDown, MapPin } from 'lucide-react';

const CITIES = [
  { id: 'jp-nagar', label: 'JP Nagar, Bengaluru', lat: 12.905, lon: 77.590, alt: 880 },
  { id: 'helsinki', label: 'Helsinki, Finland', lat: 60.1666, lon: 24.9435, alt: 30 },
  { id: 'new-york', label: 'New York, United States', lat: 40.7127, lon: -74.0060, alt: 10 },
  { id: 'monte-carlo', label: 'Monte Carlo, Monaco', lat: 43.7403, lon: 7.4266, alt: 50 },
];

function App() {
  const [activeView, setActiveView] = useState<'zeon' | 'city'>('city');
  const [weather, setWeather] = useState<any>(null);
  const [isSimNight, setIsSimNight] = useState(false);
  const [isSimRain, setIsSimRain] = useState(false);
  const [isEvSim, setIsEvSim] = useState(false);
  const [isShowFlights, setIsShowFlights] = useState(true);
  const [cameraMode, setCameraMode] = useState<'map' | 'drone'>('map');
  const [rainIntensity, setRainIntensity] = useState(5);
  const [assetCounts, setAssetCounts] = useState<any>({ apartments: 0, restaurants: 0, hospital: 0, evStations: 0, roads: 0, traffic: 0 });
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
        setCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for weather/sim events from CityStreetViewer
  useEffect(() => {
    const handleWeather = (e: any) => {
      setWeather(e.detail.weather);
    };
    const handleSim = (e: any) => {
      if (e.detail.type === 'toggle-rain') setIsSimRain(prev => !prev);
      if (e.detail.type === 'toggle-night') setIsSimNight(prev => !prev);
    };
    const handleEvSim = (e: any) => {
      if (e.detail.type === 'toggle-ev-sim') setIsEvSim(prev => !prev);
    };
    const handleCounts = (e: any) => setAssetCounts(e.detail);
    const handleRainIntensity = (e: any) => setRainIntensity(e.detail.intensity);

    window.addEventListener('laip-weather', handleWeather);
    window.addEventListener('laip-sim', handleSim);
    window.addEventListener('laip-ev-sim', handleEvSim);
    window.addEventListener('laip-asset-counts', handleCounts);
    window.addEventListener('laip-rain-intensity', handleRainIntensity);
    return () => {
      window.removeEventListener('laip-weather', handleWeather);
      window.removeEventListener('laip-sim', handleSim);
      window.removeEventListener('laip-ev-sim', handleEvSim);
      window.removeEventListener('laip-asset-counts', handleCounts);
      window.removeEventListener('laip-rain-intensity', handleRainIntensity);
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-laip-bg text-white font-sans selection:bg-laip-cyan selection:text-black">
      
      {/* 3D Scene — Full Bleed Background */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        {activeView === 'zeon' ? <SceneViewer /> : <CityStreetViewer isShowFlights={isShowFlights} rainIntensity={rainIntensity} cameraMode={cameraMode} cityCenter={selectedCity} />}
      </div>

      {/* Top Floating Header Pill */}
      <header className="absolute top-6 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-6 px-6 py-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl pointer-events-auto transition-all">
        <div className="flex items-center gap-6">
          {/* View Tabs */}
          <div className="flex items-center bg-black/20 rounded-full border border-white/5 p-1">
            <button 
              onClick={() => setActiveView('zeon')}
              className={`px-5 py-1.5 rounded-full text-xs tracking-wider transition-all ${activeView === 'zeon' ? 'bg-laip-cyan/20 text-laip-cyan font-bold shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'text-gray-400 hover:text-white'}`}
            >
              ZEON HUB
            </button>
            <button 
              onClick={() => setActiveView('city')}
              className={`px-5 py-1.5 rounded-full text-xs tracking-wider transition-all ${activeView === 'city' ? 'bg-laip-cyan/20 text-laip-cyan font-bold shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'text-gray-400 hover:text-white'}`}
            >
              CITY STREET
            </button>
          </div>

          {activeView === 'city' && (
          <button
            onClick={() => setIsShowFlights(prev => !prev)}
            title="used by OpenSky API"
            className={`flex items-center gap-1.5 border border-white/10 text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer ${isShowFlights ? 'bg-black/30 text-white' : 'bg-transparent text-gray-400'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isShowFlights ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'}`}></span>
            <span className={`font-medium ${isShowFlights ? 'text-blue-300' : ''}`}>Show Flights</span>
          </button>
          )}
          <button
            onClick={() => setCameraMode(prev => prev === 'map' ? 'drone' : 'map')}
            title="Toggle WASD Drone Camera"
            className={`flex items-center gap-1.5 border border-white/10 text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer ${cameraMode === 'drone' ? 'bg-laip-cyan/20 text-laip-cyan border-laip-cyan/30' : 'bg-transparent text-gray-400'}`}
          >
            <span className={`font-medium`}>Drone Cam</span>
          </button>
          {/* Weather Indicators */}
          {activeView === 'city' && weather && (
            <div className="flex items-center gap-3">
              <div className="h-4 w-px bg-white/10"></div>
              <div className="flex items-center gap-1.5 bg-black/20 border border-white/5 text-white text-xs px-3 py-1.5 rounded-full">
                <span className="text-gray-400 text-[10px] uppercase tracking-wider font-medium">Temp</span>
                <span className="font-semibold text-white">{weather.temperature}°C</span>
              </div>
              <div 
                className="flex items-center gap-1.5 bg-black/20 border border-white/5 text-white text-xs px-3 py-1.5 rounded-full cursor-help"
                title={`Live Condition Code: ${weather.weather_code}`}
              >
                <span className="text-gray-400 text-[10px] uppercase tracking-wider font-medium">Sky</span>
                <span className="font-semibold">
                  {weather.weather_code >= 61 ? '🌧 Rain' : (!weather.is_day ? '🌙 Night' : '☀ Clear')}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="h-4 w-px bg-white/10"></div>
          {/* City Selector */}
          <div className="relative" ref={cityDropdownRef}>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]"></span>
                <span className="text-gray-300 font-medium">System Online</span>
              </div>
              <button
                onClick={() => setCityDropdownOpen(prev => !prev)}
                title="Switch city"
                className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-black/30 hover:bg-white/10 text-white transition-all"
              >
                <MapPin size={12} className="text-laip-cyan" />
                <span className="font-semibold tracking-wide">{selectedCity.label}</span>
                <ChevronDown size={12} className={`transition-transform ${cityDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {/* Dropdown */}
            {cityDropdownOpen && (
              <div className="absolute right-0 top-full mt-3 w-56 bg-black/80 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-[999]">
                <div className="px-4 py-3 border-b border-white/10">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Select City</span>
                </div>
                {CITIES.map(city => (
                  <button
                    key={city.id}
                    onClick={() => { setSelectedCity(city); setCityDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 text-xs transition-colors ${
                      selectedCity.id === city.id
                        ? 'bg-laip-cyan/15 text-laip-cyan'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <MapPin size={12} className={selectedCity.id === city.id ? 'text-laip-cyan' : 'text-gray-500'} />
                    <span className="font-medium">{city.label}</span>
                    {selectedCity.id === city.id && (
                      <span className="ml-auto text-[9px] bg-laip-cyan/20 text-laip-cyan px-2 py-0.5 rounded-full font-bold tracking-wider">ACTIVE</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Floating Left Sidebar */}
      <div className="absolute left-6 top-24 bottom-6 w-[280px] z-40 pointer-events-none">
        <Sidebar isNight={isSimNight} isRain={isSimRain} isEvSim={isEvSim} assetCounts={assetCounts} />
      </div>

      {/* Floating Right Panel */}
      <div className="absolute right-6 top-24 bottom-6 w-[320px] z-40 pointer-events-none flex flex-col items-end">
        <RightPanel isNight={isSimNight} isRain={isSimRain} isEvSim={isEvSim} rainIntensity={rainIntensity} cameraMode={cameraMode} />
      </div>

      {/* Floating Bottom Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <BottomBar />
      </div>
    </div>
  );
}

export default App;
