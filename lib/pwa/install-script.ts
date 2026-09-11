export const INSTALL_STATE_GLOBAL = "__lfInstall";

// In the head because `beforeinstallprompt` fires before React; not cancelled (owner, 2026-09-08).
export const INSTALL_INIT_SCRIPT = `(function(){try{var s=window.${INSTALL_STATE_GLOBAL}={event:null,installed:false,notify:null};function n(){if(s.notify){s.notify()}}window.addEventListener("beforeinstallprompt",function(e){s.event=e;n()});window.addEventListener("appinstalled",function(){s.event=null;s.installed=true;n()})}catch(e){}})();`;
