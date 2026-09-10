export const INSTALLED_VIEWPORT_SUFFIX = ", maximum-scale=1, user-scalable=no";

// The served document must stay scalable: pinch and text zoom are WCAG 1.4.4, and axe's
// `meta-viewport` reads the HTML. Fixing the scale is honoured only where the app owns the window —
// iOS ignores `user-scalable` in Safari as a browser — so it is applied at runtime under
// `display-mode: standalone`, in the head like the theme script: dependency-free and ES5-safe. Next
// may emit the viewport meta after this tag, hence the second pass on `DOMContentLoaded`.
export const VIEWPORT_INIT_SCRIPT = `(function(){try{var s="${INSTALLED_VIEWPORT_SUFFIX}";var q=typeof window.matchMedia==="function"?window.matchMedia("(display-mode: standalone)"):null;function a(){var m=document.querySelector("meta[name=viewport]");if(!m){return false}var c=m.getAttribute("content")||"";var f=c.indexOf("user-scalable")>-1;var i=navigator.standalone===true||!!(q&&q.matches);if(i&&!f){m.setAttribute("content",c+s)}else if(!i&&f){m.setAttribute("content",c.split(s).join(""))}return true}if(!a()){document.addEventListener("DOMContentLoaded",function(){a()})}if(q&&q.addEventListener){q.addEventListener("change",a)}}catch(e){}})();`;
