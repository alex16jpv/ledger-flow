export const INSTALL_STATE_GLOBAL = "__lfInstall";

// The browser fires `beforeinstallprompt` once per page load, before the app is interactive and on
// whatever screen the user landed on. Listening from a React effect inside Settings loses it every
// time the user arrives there by client navigation, which is every time. This runs in the head, like
// the theme script (HANDOFF §3.7): dependency-free, ES5-safe, and early enough to catch the event.
// It does NOT preventDefault: the owner asked for the browser's own invitation to survive (2026-09-08),
// so Chrome still shows its mini-infobar and the app keeps the event for its own row.
export const INSTALL_INIT_SCRIPT = `(function(){try{var s=window.${INSTALL_STATE_GLOBAL}={event:null,installed:false,notify:null};function n(){if(s.notify){s.notify()}}window.addEventListener("beforeinstallprompt",function(e){s.event=e;n()});window.addEventListener("appinstalled",function(){s.event=null;s.installed=true;n()})}catch(e){}})();`;
