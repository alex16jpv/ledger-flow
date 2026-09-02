import { PALETTES, STORAGE_KEYS } from "./palettes";

// Runs inline before the first paint (HANDOFF §3.7); it must stay dependency-free and ES5-safe.
export const THEME_INIT_SCRIPT = `(function(){try{var s=window.localStorage;var p=s.getItem(${JSON.stringify(STORAGE_KEYS.palette)});var m=s.getItem(${JSON.stringify(STORAGE_KEYS.mode)});var r=document.documentElement;if(${JSON.stringify([...PALETTES])}.indexOf(p)>-1){r.setAttribute("data-palette",p)}if(m==="light"||m==="dark"){r.setAttribute("data-mode",m)}}catch(e){}})();`;
