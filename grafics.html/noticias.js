const NIVEL = { 4: "Muy alta", 3: "Alta", 2: "Media-alta", 1: "Media" };

let manual = {};
try { manual = JSON.parse(localStorage.getItem("not-actual")) || {}; } catch {}

const eventos = NOTICIAS_SEMANA.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
const idEv = e => `${e.date}|${e.country}|${e.title}`;

function pintarNoticias() {
  if (!eventos.length) { $("notEstado").textContent = "No hay noticias cargadas."; return; }
  const ini = new Date(eventos[0].date).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
  const fin = new Date(eventos[eventos.length - 1].date).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
  $("notEstado").textContent = `Semana del ${ini} al ${fin}. Escribe el dato publicado cuando salga: se guarda solo.`;

  let h = "<tr><th>Hora</th><th>Divisa</th><th>Noticia</th><th>Importancia</th><th>Forecast</th><th>Anterior</th><th>Dato publicado</th></tr>";
  let dia = "";
  for (const e of eventos) {
    const f = new Date(e.date);
    const d = f.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    if (d !== dia) { dia = d; h += `<tr class="dia"><td colspan="7">${esc(d)}</td></tr>`; }
    const hora = f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const id = idEv(e);
    h += `<tr><td>${hora}</td><td>${esc(e.country)}</td><td>${esc(e.title)}</td><td class="n${e.n}">${NIVEL[e.n]}</td>
      <td>${esc(e.forecast || "—")}</td><td>${esc(e.previous || "—")}</td>
      <td><input class="act" data-id="${esc(id)}" value="${esc(manual[id] || "")}" placeholder="—"></td></tr>`;
  }
  $("notTabla").innerHTML = h;
}

$("notTabla").addEventListener("change", e => {
  if (!e.target.classList.contains("act")) return;
  manual[e.target.dataset.id] = e.target.value.trim();
  localStorage.setItem("not-actual", JSON.stringify(manual));
});

$("btnNoticias").addEventListener("click", () => {
  const sec = $("noticias");
  const abrir = sec.hidden;
  sec.hidden = !abrir;
  document.querySelectorAll("main > section:not(#noticias)").forEach(s => (s.hidden = abrir));
  $("btnNoticias").textContent = abrir ? "Volver" : "Noticias";
});

pintarNoticias();