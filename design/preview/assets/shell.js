// Barra de herramientas del preview: paleta, modo y tamaño de dispositivo. No forma parte del diseño.
(function () {
  const PAGES = [
    ["index.html", "Índice"], ["00-fundamentos.html", "Fundamentos"], ["01-inicio.html", "Inicio"],
    ["02-registrar.html", "Registrar"], ["03-presupuestos.html", "Presupuestos"], ["04-acceso.html", "Acceso"],
    ["05-movimientos.html", "Movimientos"], ["06-cuentas.html", "Cuentas"], ["07-categorias.html", "Categorías"],
    ["08-presupuesto-detalle.html", "Presupuesto"], ["09-estadisticas.html", "Estadísticas"], ["10-ajustes.html", "Ajustes"],
    ["11-estados.html", "Estados"], ["12-publico.html", "Público"], ["13-variaciones.html", "Variaciones"],
  ];
  const PALETTES = [["tinta", "Tinta"], ["brisa", "Brisa (demo)"]];
  const DEVICES = [["mobile", "Móvil 390", 390], ["tablet", "Tablet 820", 820], ["desktop", "Escritorio 1280", 1280]];
  const store = (k, v) => { try { v === undefined ? 0 : localStorage.setItem(k, v); return localStorage.getItem(k); } catch { return null; } };
  const root = document.documentElement;
  const q = new URLSearchParams(location.search);   // ?palette=brisa&mode=dark&device=desktop
  const state = {
    palette: q.get("palette") || store("pv-palette") || "tinta",
    mode: q.get("mode") || store("pv-mode") || "light",
    device: q.get("device") || store("pv-device") || (document.body.dataset.device || "mobile"),
  };
  function apply() {
    root.dataset.palette = state.palette;
    if (state.mode === "system") root.removeAttribute("data-mode"); else root.dataset.mode = state.mode;
    const dev = DEVICES.find((d) => d[0] === state.device) || DEVICES[0];
    document.body.dataset.device = dev[0];
    document.querySelectorAll(".device").forEach((el) => { el.style.width = dev[2] + "px"; el.dataset.device = dev[0]; el.classList.toggle("tall", q.get("frame") === "tall"); });
    document.querySelectorAll("[data-pv]").forEach((b) => b.setAttribute("aria-pressed", String(state[b.dataset.pv] === b.dataset.value)));
    const sel = document.querySelector("#pv-palette"); if (sel) sel.value = state.palette;
  }
  const here = location.pathname.split("/").pop() || "index.html";
  const bar = document.createElement("div");
  bar.className = "pv-bar";
  bar.innerHTML = `
    <div class="pv-group pv-nav">${PAGES.map(([h, t]) => `<a href="${h}" ${h === here ? 'class="on"' : ""}>${t}</a>`).join("")}</div>
    <div class="pv-group"><label>Paleta <select id="pv-palette">${PALETTES.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label></div>
    <div class="pv-group pv-seg">${[["light", "Claro"], ["dark", "Oscuro"], ["system", "Sistema"]].map(([v, t]) => `<button data-pv="mode" data-value="${v}">${t}</button>`).join("")}</div>
    <div class="pv-group pv-seg pv-devices">${DEVICES.map(([v, t]) => `<button data-pv="device" data-value="${v}">${t}</button>`).join("")}</div>`;
  document.body.prepend(bar);
  bar.addEventListener("click", (e) => { const b = e.target.closest("[data-pv]"); if (!b) return; state[b.dataset.pv] = b.dataset.value; store("pv-" + b.dataset.pv, b.dataset.value); apply(); });
  bar.querySelector("#pv-palette").addEventListener("change", (e) => { state.palette = e.target.value; store("pv-palette", state.palette); apply(); });
  apply();
})();
