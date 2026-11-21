const API = "https://api.twelvedata.com";
const INTERVALOS = ["1min", "5min", "15min", "1h", "1day"];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let apiKey = localStorage.getItem("td-key") || "";
let tarjetas = [];      // todas las tarjetas vivas (panel + vista previa)
let previa = null;
let ultimos = [];       // últimos resultados de búsqueda

// ---------- API ----------
async function td(ruta) {
  const r = await fetch(`${API}/${ruta}${ruta.includes("?") ? "&" : "?"}apikey=${apiKey}`);
  const j = await r.json();
  if (j.status === "error") throw new Error(j.message);
  return j;
}
const aTiempo = s => Date.parse((s.length === 10 ? s + "T00:00:00" : s.replace(" ", "T")) + "Z") / 1000;

async function cargar(t) {
  try {
    const j = await td(`time_series?symbol=${encodeURIComponent(t.sym)}&interval=${t.interval}&outputsize=150`);
    t.data = j.values.slice().reverse().map(x => ({ time: aTiempo(x.datetime), open: +x.open, high: +x.high, low: +x.low, close: +x.close }));
    t.el.querySelector(".err").textContent = "";
    pintar(t);
  } catch (e) { t.el.querySelector(".err").textContent = e.message; }
}

// ---------- Gráfico ----------
function crearSerie(t) {
  if (t.serie) t.chart.removeSeries(t.serie);
  t.serie = t.mode === "velas"
    ? t.chart.addCandlestickSeries({ upColor: "#26a69a", downColor: "#ef5350", borderVisible: false, wickUpColor: "#26a69a", wickDownColor: "#ef5350" })
    : t.chart.addLineSeries({ color: "#8ab4ff", lineWidth: 2 });
}

function pintar(t) {
  if (!t.data.length) return;
  if (!t.serie) crearSerie(t);
  t.serie.setData(t.mode === "velas" ? t.data : t.data.map(d => ({ time: d.time, value: d.close })));
  const u = t.data[t.data.length - 1], p = t.data[t.data.length - 2] || u;
  const ch = (u.close - p.close) / p.close * 100;
  t.el.querySelector(".precio").textContent = u.close.toFixed(u.close < 10 ? 4 : 2);
  const c = t.el.querySelector(".cambio");
  c.textContent = `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`;
  c.className = "cambio " + (ch >= 0 ? "sube" : "baja");
  if (!t.visto) { t.chart.timeScale().fitContent(); t.visto = true; }
  actualizarPnl(t);
}

// ---------- Ganancias / pérdidas ----------
function actualizarPnl(t) {
  const p = t.el.querySelector(".pnl");
  if (!p) return;
  const u = t.data.length ? t.data[t.data.length - 1].close : 0;
  if (!t.inv || !t.entrada || !u) { p.hidden = true; return; }
  const valor = t.inv / t.entrada * u;
  const g = valor - t.inv;
  const pct = (u / t.entrada - 1) * 100;
  p.hidden = false;
  p.className = "pnl " + (g >= 0 ? "sube" : "baja");
  p.textContent = `${g >= 0 ? "Ganando" : "Perdiendo"} ${Math.abs(g).toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%) · Valor actual: ${valor.toFixed(2)}`;
}

// ---------- Tarjetas ----------
function guardarPanel() {
  const p = tarjetas.filter(t => t.enPanel).map(({ sym, name, mode, interval, inv, entrada }) => ({ sym, name, mode, interval, inv, entrada }));
  localStorage.setItem("td-panel", JSON.stringify(p));
  $("vacio").hidden = p.length > 0;
}

function crearTarjeta(it, enPanel) {
  const el = document.createElement("article");
  el.className = "tarjeta";
  el.innerHTML = `
    <div class="cab"><div><b>${esc(it.sym)}</b><small>${esc(it.name)}</small></div>
      <div class="der"><span class="precio">…</span><span class="cambio"></span></div>
      ${enPanel ? '<button class="pos" title="Meter mi inversión">Mi inversión</button>' : ""}</div>
    ${enPanel ? `<div class="posForm" hidden>
      <label>Dinero invertido<input class="inInv" type="number" min="0" step="any"></label>
      <label>Precio de entrada<input class="inEnt" type="number" min="0" step="any"></label>
      <div class="posBtn"><button class="posOk">Guardar</button><button class="posDel">Borrar</button></div>
    </div>
    <p class="pnl" hidden></p>` : ""}
    <div class="ctrl">
      <div class="modo"><button data-m="linea">Línea</button><button data-m="velas">Velas</button></div>
      <select>${INTERVALOS.map(i => `<option>${i}</option>`).join("")}</select>
    </div>
    <div class="graf"></div><p class="err"></p>
    <button class="accion" title="${enPanel ? "Quitar del panel" : "Añadir al panel"}">${enPanel ? "−" : "+"}</button>`;

  const t = { sym: it.sym, name: it.name, mode: it.mode || "linea", interval: it.interval || "5min", inv: it.inv || 0, entrada: it.entrada || 0, el, enPanel, data: [], serie: null, visto: false };
  t.chart = LightweightCharts.createChart(el.querySelector(".graf"), {
    autoSize: true,
    layout: { background: { color: "#000" }, textColor: "#8c8c8c" },
    grid: { vertLines: { color: "#161616" }, horzLines: { color: "#161616" } },
    timeScale: { timeVisible: true, borderColor: "#262626" },
    rightPriceScale: { borderColor: "#262626" }
  });

  const marcarModo = () => el.querySelectorAll(".modo button").forEach(b => b.classList.toggle("on", b.dataset.m === t.mode));
  marcarModo();
  el.querySelector("select").value = t.interval;

  el.querySelector(".modo").addEventListener("click", e => {
    if (!e.target.dataset.m) return;
    t.mode = e.target.dataset.m; marcarModo(); crearSerie(t); pintar(t);
    if (t.enPanel) guardarPanel();
  });
  el.querySelector("select").addEventListener("change", e => {
    t.interval = e.target.value; t.visto = false; cargar(t);
    if (t.enPanel) guardarPanel();
  });

  if (enPanel) {
    const form = el.querySelector(".posForm");
    const inInv = el.querySelector(".inInv"), inEnt = el.querySelector(".inEnt");
    inInv.value = t.inv || "";
    inEnt.value = t.entrada || "";
    el.querySelector(".pos").addEventListener("click", () => { form.hidden = !form.hidden; });
    el.querySelector(".posOk").addEventListener("click", () => {
      t.inv = parseFloat(inInv.value) || 0;
      t.entrada = parseFloat(inEnt.value) || 0;
      form.hidden = true; guardarPanel(); actualizarPnl(t);
    });
    el.querySelector(".posDel").addEventListener("click", () => {
      t.inv = 0; t.entrada = 0; inInv.value = ""; inEnt.value = "";
      form.hidden = true; guardarPanel(); actualizarPnl(t);
    });
  }

  const btn = el.querySelector(".accion");
  btn.addEventListener("click", () => enPanel ? quitar(t) : añadir(t));
  if (!enPanel && tarjetas.some(x => x.enPanel && x.sym === t.sym)) btn.disabled = true;

  tarjetas.push(t);
  (enPanel ? $("panel") : $("previa")).appendChild(el);
  return t;
}

function destruir(t) {
  t.chart.remove(); t.el.remove();
  tarjetas = tarjetas.filter(x => x !== t);
}
function añadir(pre) {
  if (tarjetas.some(x => x.enPanel && x.sym === pre.sym)) return;
  const t = crearTarjeta(pre, true);
  t.data = pre.data.slice(); pintar(t);
  pre.el.querySelector(".accion").disabled = true;
  guardarPanel();
}
function quitar(t) {
  destruir(t); guardarPanel();
  if (previa && previa.sym === t.sym) previa.el.querySelector(".accion").disabled = false;
}

// ---------- Búsqueda ----------
let espera;
$("buscador").addEventListener("input", e => {
  clearTimeout(espera);
  const q = e.target.value.trim();
  if (q.length < 2) { $("resultados").innerHTML = ""; return; }
  espera = setTimeout(async () => {
    if (!apiKey) return;
    try {
      const j = await td(`symbol_search?symbol=${encodeURIComponent(q)}&outputsize=8`);
      ultimos = j.data || [];
      $("resultados").innerHTML = ultimos.length
        ? ultimos.map((d, i) => `<button class="res" data-i="${i}">${esc(d.symbol)}<span>${esc(d.instrument_name)} · ${esc(d.exchange)} · ${esc(d.instrument_type)}</span></button>`).join("")
        : '<p class="vacio">Sin resultados.</p>';
    } catch (err) { $("resultados").innerHTML = `<p class="err">${esc(err.message)}</p>`; }
  }, 500);
});

$("resultados").addEventListener("click", e => {
  const b = e.target.closest(".res");
  if (!b) return;
  const d = ultimos[b.dataset.i];
  if (previa) destruir(previa);
  previa = crearTarjeta({ sym: d.symbol, name: d.instrument_name }, false);
  cargar(previa);
  $("resultados").innerHTML = "";
});

// ---------- API key ----------
function mostrarAviso() { $("aviso").hidden = !!apiKey; }
$("apikey").value = apiKey;
$("guardarKey").addEventListener("click", () => {
  apiKey = $("apikey").value.trim();
  localStorage.setItem("td-key", apiKey);
  mostrarAviso(); tarjetas.forEach(t => (t.data = []));
});

// ---------- Actualización continua ----------
// El plan gratuito permite ~8 peticiones por minuto: se refresca una tarjeta cada 8 s, por turnos.
let turno = -1;
function tick() {
  if (!apiKey || !tarjetas.length || document.hidden) return;
  const sinDatos = tarjetas.find(t => !t.data.length);
  if (sinDatos) return cargar(sinDatos);
  turno = (turno + 1) % tarjetas.length;
  cargar(tarjetas[turno]);
}

// ---------- Inicio ----------
let guardado = [];
try { guardado = JSON.parse(localStorage.getItem("td-panel")) || []; } catch {}
guardado.forEach(it => crearTarjeta(it, true));
$("vacio").hidden = guardado.length > 0;
mostrarAviso();
tick();
setInterval(tick, 8000);