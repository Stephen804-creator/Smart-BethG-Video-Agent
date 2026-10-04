import React from 'react';

const paths = {
  Menu: [['path',{d:'M4 6h16M4 12h16M4 18h16'}]],
  Clapperboard: [['path',{d:'M4 4h16v16H4zM4 9h16M8 4l3 5M14 4l3 5'}]],
  Sparkles: [['path',{d:'m12 3-1.5 5.5L5 10l5.5 1.5L12 17l1.5-5.5L19 10l-5.5-1.5L12 3ZM19 16l-.7 2.3L16 19l2.3.7L19 22l.7-2.3L22 19l-2.3-.7L19 16Z'}]],
  LayoutDashboard: [['rect',{x:'3',y:'3',width:'7',height:'7'}],['rect',{x:'14',y:'3',width:'7',height:'7'}],['rect',{x:'3',y:'14',width:'7',height:'7'}],['rect',{x:'14',y:'14',width:'7',height:'7'}]],
  BookOpen: [['path',{d:'M2 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H2V4ZM22 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7V4Z'}]],
  Camera: [['path',{d:'M14.5 4h-5L8 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4l-1.5-3Z'}],['circle',{cx:'12',cy:'13',r:'3'}]],
  Link: [['path',{d:'M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7L11 6'}],['path',{d:'M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7L13 18'}]],
  FolderOpen: [['path',{d:'m3 7 2-3h6l2 3h8v12H3V7Z'}],['path',{d:'M3 7h18'}]],
  WandSparkles: [['path',{d:'M15 4V2M15 8v2M11 6h2M17 6h2M15 5l1 1M15 7l1-1M5 21l10-10'}],['path',{d:'m3 19 2 2'}]],
  Settings: [['path',{d:'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z'}],['path',{d:'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.6v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.3v-2.6h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h2.6v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v2.6h-.2a1.7 1.7 0 0 0-1.5 1Z'}]],
  LogOut: [['path',{d:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'}]],
  Zap: [['path',{d:'m13 2-9 12h7l-1 8 9-12h-7l1-8Z'}]],
  PanelRight: [['rect',{x:'3',y:'3',width:'18',height:'18',rx:'2'}],['path',{d:'M15 3v18'}]],
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
