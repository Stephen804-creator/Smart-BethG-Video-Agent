import React from 'react';

const paths = {
  Download: [['path',{d:'M12 3v12M7 10l5 5 5-5M5 21h14'}]],
  Plus: [['path',{d:'M12 5v14M5 12h14'}]],
  Play: [['path',{d:'m9 6 10 6-10 6V6Z'}]],
  Menu: [['path',{d:'M4 6h16M4 12h16M4 18h16'}]],
  Clapperboard: [['path',{d:'M4 4h16v16H4zM4 9h16M8 4l3 5M14 4l3 5'}]],
  Sparkles: [['path',{d:'m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5L12 3ZM19 16l-.7 2.3L16 19l2.3.7L19 22l.7-2.3L19 16Z'}]],
  LayoutDashboard: [['rect',{x:'3',y:'3',width:'7',height:'7'}],['rect',{x:'14',y:'3',width:'7',height:'7'}],['rect',{x:'3',y:'14',width:'7',height:'7'}],['rect',{x:'14',y:'14',width:'7',height:'7'}]],
  BookOpen: [['path',{d:'M2 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H2V4ZM22 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7V4Z'}]],
  Camera: [['path',{d:'M14.5 4h-5L8 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4l-1.5-3Z'}],['circle',{cx:'12',cy:'13',r:'3'}]],
  Link: [['path',{d:'M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7L11 6'}],['path',{d:'M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7L13 18'}]],
  FolderOpen: [['path',{d:'m3 7 2-3h6l2 3h8v12H3V7Z'}],['path',{d:'M3 7h18'}]],
  WandSparkles: [['path',{d:'M15 4V2M15 8v2M11 6h2M17 6h2M15 5l1 1M15 7l1-1M5 21l10-10'}],['path',{d:'m3 19 2 2'}]],
  Settings: [['path',{d:'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z'}],['path',{d:'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.6v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.3v-2.6h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h2.6v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0-1.5 1h-.2v2.6h.2a1.7 1.7 0 0 0 1.5 1Z'}]],
  LogOut: [['path',{d:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'}]],
  Zap: [['path',{d:'m13 2-9 12h7l-1 8 9-12h-7l1-8Z'}]],
  PanelRight: [['rect',{x:'3',y:'3',width:'18',height:'18',rx:'2'}],['path',{d:'M15 3v18'}]],
  ArrowRight: [['path',{d:'M5 12h14M13 6l6 6-6 6'}]],
  Move: [['path',{d:'M12 2v20M2 12h20M8 5l4-3 4 3M8 19l4 3 4-3M5 8l-3 4 3 4M19 8l3 4-3 4'}]],
  Message: [['path',{d:'M4 5h16v11H8l-4 4V5Z'}]],
  Brain: [['path',{d:'M9 4a3 3 0 0 0-5 2.2A3 3 0 0 0 5 12a3 3 0 0 0 0 5 3 3 0 0 0 4 2.5M15 4a3 3 0 0 1 5 2.2A3 3 0 0 1 19 12a3 3 0 0 1 0 5 3 3 0 0 1-4 2.5M9 4v16M15 4v16'}]],
  RefreshCw: [['path',{d:'M20 11a8 8 0 0 0-14.9-4M4 5v5h5M4 13a8 8 0 0 0 14.9 4M20 19v-5h-5'}]],
  Search: [['circle',{cx:'11',cy:'11',r:'7'}],['path',{d:'m20 20-4-4'}]],
  Image: [['rect',{x:'3',y:'4',width:'18',height:'16',rx:'2'}],['circle',{cx:'8',cy:'9',r:'1.5'}],['path',{d:'m3 17 5-5 4 4 3-3 6 5'}]],
  Scissors: [['circle',{cx:'6',cy:'6',r:'2'}],['circle',{cx:'6',cy:'18',r:'2'}],['path',{d:'m8 7 13 5-13 5M8 7l6 5-6 5'}]],
  Volume: [['path',{d:'M11 5 6 9H3v6h3l5 4V5Z'}],['path',{d:'M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12'}]],
  Layers: [['path',{d:'m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5'}]],
  Timer: [['circle',{cx:'12',cy:'13',r:'8'}],['path',{d:'M12 9v4l2 2M9 2h6'}]],
  User: [['circle',{cx:'12',cy:'8',r:'3'}],['path',{d:'M5 21a7 7 0 0 1 14 0'}]],
  Globe: [['circle',{cx:'12',cy:'12',r:'9'}],['path',{d:'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18'}]],
  ScrollText: [['path',{d:'M7 3h12v18H7a3 3 0 0 1 0-6h12M7 3a3 3 0 0 0 0 6h12'}],['path',{d:'M10 12h6M10 16h5'}]],
  Scale: [['path',{d:'M12 3v18M5 6h14M7 6l-3 6h6L7 6ZM17 6l-3 6h6l-3-6ZM8 21h8'}]],
  FileText: [['path',{d:'M6 3h9l3 3v15H6V3Z'}],['path',{d:'M14 3v4h4M9 12h6M9 16h6'}]],
  Box: [['path',{d:'m12 3 8 4-8 4-8-4 8-4ZM4 7v10l8 4 8-4V7M12 11v10'}]],
  ArrowLeftRight: [['path',{d:'M3 8h14M13 4l4 4-4 4M21 16H7M11 12l-4 4 4 4'}]],
  Lightbulb: [['path',{d:'M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-1 1-2 2-2 4h-4c0-2-1-3-2-4Z'}]],
  Upload: [['path',{d:'M12 16V4M7 9l5-5 5 5M5 20h14'}]],
  Shield: [['path',{d:'M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z'}],['path',{d:'m9 12 2 2 4-5'}]],
  CircleAlert: [['circle',{cx:'12',cy:'12',r:'9'}],['path',{d:'M12 8v4M12 16h.01'}]],
  Check: [['path',{d:'m5 12 4 4L19 6'}]]
};

export function Icon({ name, size = 18, strokeWidth = 1.8, label }) {
  const nodes = paths[name] || paths.Sparkles;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : 'true'} role={label ? 'img' : undefined}>
    {nodes.map(([tag, attrs], index) => React.createElement(tag, { ...attrs, key: index }))}
    {label && <title>{label}</title>}
  </svg>;
}
