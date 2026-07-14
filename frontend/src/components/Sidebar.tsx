import { ChevronRight, ChevronDown, Building2, Layers, Cpu, Wind } from 'lucide-react';
import { useState } from 'react';

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

export const Sidebar = () => {
  return (
    <div className="w-72 border-r border-laip-border bg-laip-panel p-4 flex flex-col h-full shrink-0 z-10 backdrop-blur-md">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-laip-cyan/10 flex items-center justify-center border border-laip-cyan/30 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
          <Building2 size={20} className="text-laip-cyan" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wider leading-tight">LAIP</h1>
          <div className="text-[10px] text-laip-cyan uppercase tracking-widest font-semibold">Command Center</div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Asset Hierarchy</h2>
        
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
      </div>
    </div>
  );
};
