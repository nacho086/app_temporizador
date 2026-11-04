(function () {
  "use strict";

  // Elementos
  const elTiempo = document.getElementById("tiempo");
  const elEstado = document.getElementById("estado");
  const elDisplay = document.querySelector(".display");
  const elNombre = document.getElementById("nombre");
  const inHoras = document.getElementById("cfg-horas");
  const inMinutos = document.getElementById("cfg-minutos");
  const inSegundos = document.getElementById("cfg-segundos");
  const btnIniciar = document.getElementById("btn-iniciar");
  const btnPausar = document.getElementById("btn-pausar");
  const btnReiniciar = document.getElementById("btn-reiniciar");
  const listaRegistro = document.getElementById("lista-registro");
  const registroVacio = document.getElementById("registro-vacio");
  const chkSonido = document.getElementById("chk-sonido");

  // Estado
  let totalMs = 0;          // tiempo asignado
  let acumuladoMs = 0;      // tiempo transcurrido antes de la última pausa
  let inicioTs = null;      // marca de tiempo del último inicio
  let intervalo = null;
  let corriendo = false;
  let sesionActiva = false; // hay una exposición en curso (corriendo o pausada)

  const AVISO_MS = 60 * 1000; // aviso cuando queda 1 minuto

  // Audio
  let audioCtx = null;
  let alertaEmitida = false;

  // El contexto de audio debe crearse/reanudarse a partir de un clic del usuario
  function prepararAudio() {
    try {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    } catch (e) {
      audioCtx = null;
    }
  }

  // Tres pitidos suaves y breves
  function sonarAlerta() {
    if (!chkSonido.checked || !audioCtx) return;
    const ahora = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = ahora + i * 0.45;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    }
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatear(ms) {
    const totalSeg = Math.floor(Math.abs(ms) / 1000);
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  function leerConfiguracion() {
    const clamp = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
    const h = clamp(inHoras.value, 99);
    const m = clamp(inMinutos.value, 59);
    const s = clamp(inSegundos.value, 59);
    inHoras.value = h;
    inMinutos.value = m;
    inSegundos.value = s;
    return ((h * 60 + m) * 60 + s) * 1000;
  }

  function transcurrido() {
    return acumuladoMs + (corriendo ? Date.now() - inicioTs : 0);
  }

  function actualizarPantalla() {
    const restante = totalMs - transcurrido();
    elDisplay.classList.remove("aviso", "excedido");

    if (corriendo && restante <= 0 && !alertaEmitida) {
      alertaEmitida = true;
      sonarAlerta();
    }

    if (restante < 0) {
      elTiempo.textContent = "-" + formatear(restante);
      elDisplay.classList.add("excedido");
      elEstado.textContent = "Tiempo excedido";
    } else {
      elTiempo.textContent = formatear(restante);
      if (corriendo && totalMs > 0 && restante <= AVISO_MS) {
        elDisplay.classList.add("aviso");
        elEstado.textContent = "Queda menos de un minuto";
      } else if (corriendo) {
        elEstado.textContent = "En curso";
      }
    }
  }

  function bloquearConfiguracion(bloquear) {
    [inHoras, inMinutos, inSegundos].forEach(function (i) {
      i.disabled = bloquear;
    });
  }

  function iniciar() {
    if (!sesionActiva) {
      totalMs = leerConfiguracion();
      if (totalMs <= 0) {
        elEstado.textContent = "Definí un tiempo mayor a cero";
        return;
      }
      acumuladoMs = 0;
      alertaEmitida = false;
      sesionActiva = true;
      bloquearConfiguracion(true);
    }
    prepararAudio();
    corriendo = true;
    inicioTs = Date.now();
    intervalo = setInterval(actualizarPantalla, 200);
    btnIniciar.disabled = true;
    btnPausar.disabled = false;
    btnPausar.textContent = "Pausar";
    actualizarPantalla();
  }

  function pausar() {
    if (!corriendo) return;
    acumuladoMs += Date.now() - inicioTs;
    corriendo = false;
    clearInterval(intervalo);
    intervalo = null;
    btnIniciar.disabled = false;
    btnIniciar.textContent = "Continuar";
    btnPausar.disabled = true;
    elEstado.textContent = "En pausa";
    actualizarPantalla();
    if (totalMs - acumuladoMs >= 0) {
      elEstado.textContent = "En pausa";
    }
  }

  function agregarRegistro() {
    const usado = transcurrido();
    const nombre = elNombre.value.trim() || "Sin nombre";
    const diff = usado - totalMs;
    let texto = formatear(usado) + " de " + formatear(totalMs);
    if (diff > 1000) {
      texto += " (+" + formatear(diff) + ")";
    }

    const li = document.createElement("li");
    const spanNombre = document.createElement("span");
    spanNombre.textContent = nombre;
    const spanDetalle = document.createElement("span");
    spanDetalle.className = "detalle";
    spanDetalle.textContent = texto;
    li.appendChild(spanNombre);
    li.appendChild(spanDetalle);
    listaRegistro.insertBefore(li, listaRegistro.firstChild);
    registroVacio.style.display = "none";
  }

  function reiniciar() {
    // Si hubo una exposición con tiempo consumido, se guarda en el registro
    if (sesionActiva && transcurrido() > 0) {
      agregarRegistro();
    }
    clearInterval(intervalo);
    intervalo = null;
    corriendo = false;
    sesionActiva = false;
    alertaEmitida = false;
    acumuladoMs = 0;
    inicioTs = null;
    bloquearConfiguracion(false);
    btnIniciar.disabled = false;
    btnIniciar.textContent = "Iniciar";
    btnPausar.disabled = true;
    mostrarTiempoConfigurado();
    elEstado.textContent = "Listo";
  }

  function mostrarTiempoConfigurado() {
    elDisplay.classList.remove("aviso", "excedido");
    elTiempo.textContent = formatear(leerConfiguracion());
  }

  // Eventos
  btnIniciar.addEventListener("click", iniciar);
  btnPausar.addEventListener("click", pausar);
  btnReiniciar.addEventListener("click", reiniciar);

  [inHoras, inMinutos, inSegundos].forEach(function (i) {
    i.addEventListener("change", function () {
      if (!sesionActiva) mostrarTiempoConfigurado();
    });
  });

  // Atajo: barra espaciadora inicia/pausa (si no se está escribiendo en un campo)
  document.addEventListener("keydown", function (e) {
    if (e.code !== "Space") return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "BUTTON") return;
    e.preventDefault();
    if (corriendo) pausar();
    else iniciar();
  });

  mostrarTiempoConfigurado();
})();
