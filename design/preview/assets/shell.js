// The preview viewer: palette, mode, device size and the plate search. Not part of the design.
(function () {
  const DEVICES = { mobile: 390, tablet: 820, desktop: 1280 };
  const store = (k, v) => {
    try {
      if (v !== undefined) localStorage.setItem(k, v);
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const root = document.documentElement;
  const q = new URLSearchParams(location.search); // ?palette=brisa&mode=dark&device=desktop&frame=tall
  const state = {
    palette: q.get("palette") || store("pv-palette") || "tinta",
    mode: q.get("mode") || store("pv-mode") || "light",
    device: q.get("device") || store("pv-device") || "mobile",
  };

  function apply() {
    root.dataset.palette = state.palette;
    if (state.mode === "system") root.removeAttribute("data-mode");
    else root.dataset.mode = state.mode;
    document.body.dataset.device = state.device;
    document.querySelectorAll(".device").forEach((el) => {
      el.style.width = DEVICES[state.device] + "px";
      el.dataset.device = state.device;
      el.classList.toggle("tall", q.get("frame") === "tall");
    });
    document.querySelectorAll("[data-pv]").forEach((b) => b.setAttribute("aria-pressed", String(state[b.dataset.pv] === b.dataset.value)));
    const sel = document.querySelector("#pv-palette");
    if (sel) sel.value = state.palette;
  }

  const top = document.querySelector(".pv-top");
  if (top) {
    top.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pv]");
      if (!b) return;
      state[b.dataset.pv] = b.dataset.value;
      store("pv-" + b.dataset.pv, b.dataset.value);
      apply();
    });
    const sel = top.querySelector("#pv-palette");
    if (sel)
      sel.addEventListener("change", (e) => {
        state.palette = e.target.value;
        store("pv-palette", state.palette);
        apply();
      });
  }

  const input = document.querySelector("#pv-q");
  const results = document.querySelector("#pv-results");
  if (input && results) {
    const plates = window.LF_PLATES || [];
    let hits = [];
    let cursor = 0;
    const draw = () => {
      results.hidden = hits.length === 0 && input.value.trim() === "";
      if (input.value.trim() === "") return;
      results.hidden = false;
      results.innerHTML = hits.length
        ? hits.map((p, i) => `<a class="${i === cursor ? "on" : ""}" href="${p.p}#${p.i}">${p.t}<span class="where">${p.g}</span></a>`).join("")
        : '<div class="none">Nothing with that name</div>';
    };
    const search = () => {
      const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      hits = terms.length === 0 ? [] : plates.filter((p) => terms.every((t) => (p.t + " " + p.g + " " + p.i).toLowerCase().includes(t))).slice(0, 12);
      cursor = 0;
      draw();
    };
    input.addEventListener("input", search);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        input.value = "";
        search();
        return;
      }
      if (hits.length === 0) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        cursor = (cursor + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length;
        draw();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        location.href = hits[cursor].p + "#" + hits[cursor].i;
      }
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".pv-search")) results.hidden = true;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== input) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  apply();
})();
