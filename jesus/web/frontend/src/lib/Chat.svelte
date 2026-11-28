<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { api } from './api.js';
  import { usuario } from './sesion.js';
  import { cargarNotifs } from './notificaciones.js';
  import { cargarConversaciones } from './mensajes.js';
  import Icono from './Icono.svelte';
  import AudioMensaje from './AudioMensaje.svelte';

  // Conversación entre cliente y proveedor dentro de una solicitud (estilo WhatsApp, con notas de voz)
  export let solicitudId;
  export let otro = ''; // nombre de la otra persona
  export let alto = '280px'; // alto del área de mensajes (si no se usa `llenar`)
  export let llenar = false; // ocupar todo el alto del contenedor (apartado Mensajes)

  const MAX_SEG = 120; // duración máxima de una nota de voz

  let mensajes = [];
  let texto = '';
  let cargando = true;
  let enviando = false;
  let error = '';
  let caja;
  let timer;

  // Grabación
  let grabando = false;
  let segundos = 0;
  let grabador = null;
  let trozos = [];
  let reloj;
  let descartar = false;

  // Responder a un mensaje: se toca el mensaje -> "Responder" (o se desliza a la derecha)
  let respondiendo = null; // mensaje citado
  let menuDe = null; // id del mensaje con el menú abierto
  let resaltado = null; // id del mensaje original al saltar a él
  let caja2; // textarea
  let arrastre = { id: null, x0: 0, y0: 0, dx: 0 };

  async function cargar(scroll = false) {
    try {
      const nuevos = await api(`/solicitudes/${solicitudId}/mensajes`);
      const cambio = nuevos.length !== mensajes.length;
      mensajes = nuevos;
      error = '';
      if (cambio || scroll) { await tick(); bajar(); }
      if (cambio) cargarConversaciones(); // actualiza el contador de no leídos del menú
    } catch (e) {
      error = e.message;
    } finally {
      cargando = false;
    }
  }

  function bajar() {
    if (caja) caja.scrollTop = caja.scrollHeight;
  }

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    enviando = true;
    try {
      await api(`/solicitudes/${solicitudId}/mensajes`, { method: 'POST', body: { texto: t, respuesta_a: respondiendo?.id } });
      texto = '';
      respondiendo = null;
      await cargar(true);
      cargarConversaciones();
    } catch (e) {
      error = e.message;
    } finally {
      enviando = false;
    }
  }

  function tecla(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  // ---------- notas de voz ----------
  function formatoTiempo(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  async function empezarGrabacion() {
    error = '';
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      error = 'Tu dispositivo no permite grabar audio aquí.';
      return;
    }
    let flujo;
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      error = 'Necesitamos permiso del micrófono para grabar. Actívalo en los ajustes de la app.';
      return;
    }
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
    grabador = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : undefined);
    trozos = [];
    descartar = false;
    grabador.ondataavailable = (e) => e.data.size && trozos.push(e.data);
    grabador.onstop = () => {
      flujo.getTracks().forEach((t) => t.stop());
      clearInterval(reloj);
      const dur = segundos;
      grabando = false;
      segundos = 0;
      if (!descartar && dur >= 1) subirAudio(new Blob(trozos, { type: grabador.mimeType || tipo || 'audio/webm' }), dur);
    };
    grabador.start();
    grabando = true;
    segundos = 0;
    reloj = setInterval(() => {
      segundos += 1;
      if (segundos >= MAX_SEG) terminarGrabacion(true);
    }, 1000);
  }

  function terminarGrabacion(enviarla) {
    if (!grabador || grabador.state === 'inactive') return;
    descartar = !enviarla;
    grabador.stop();
  }

  async function subirAudio(blob, seg) {
    enviando = true;
    try {
      // Content-Type sin parámetros (audio/webm), el backend valida el tipo
      const limpio = new Blob([blob], { type: blob.type.split(';')[0] });
      const resp = respondiendo ? `&respuesta_a=${respondiendo.id}` : '';
      await api(`/solicitudes/${solicitudId}/audio?seg=${seg}${resp}`, { method: 'POST', body: limpio });
      respondiendo = null;
      await cargar(true);
      cargarConversaciones();
    } catch (e) {
      error = e.message;
    } finally {
      enviando = false;
    }
  }

  // ---------- responder ----------
  const esMio = (autorId) => autorId === $usuario?.id;
  const nombreCorto = (n) => String(n || '').split(' ')[0];
  const resumen = (t, audio) => (audio ? '🎤 Mensaje de voz' : String(t || '').slice(0, 140));

  function tocarMensaje(m, e) {
    // El botón de reproducir y la cita tienen su propia acción
    if (e.target.closest('button, .cita')) return;
    menuDe = menuDe === m.id ? null : m.id;
  }

  async function responderA(m) {
    respondiendo = m;
    menuDe = null;
    await tick();
    caja2?.focus();
  }

  async function copiar(m) {
    menuDe = null;
    try {
      await navigator.clipboard.writeText(m.texto);
    } catch {}
  }

  async function irAlOriginal(rid) {
    const el = caja?.querySelector(`[data-id="${rid}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    resaltado = rid;
    setTimeout(() => (resaltado = null), 1400);
  }

  // Deslizar a la derecha para responder (pantallas táctiles)
  function inicioToque(m, e) {
    const t = e.touches[0];
    arrastre = { id: m.id, x0: t.clientX, y0: t.clientY, dx: 0 };
  }
  function moverToque(e) {
    if (!arrastre.id) return;
    const t = e.touches[0];
    const dx = t.clientX - arrastre.x0;
    if (Math.abs(t.clientY - arrastre.y0) > 30) return (arrastre = { id: null, dx: 0 }); // es scroll
    arrastre = { ...arrastre, dx: Math.max(0, Math.min(80, dx)) };
  }
  function finToque(m) {
    if (arrastre.id === m.id && arrastre.dx > 55) responderA(m);
    arrastre = { id: null, dx: 0 };
  }

  // ---------- separadores por día ----------
  const claveDia = (f) => new Date(f).toDateString();
  function etiquetaDia(f) {
    const d = new Date(f);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', ...(d.getFullYear() !== hoy.getFullYear() ? { year: 'numeric' } : {}) });
  }
  const hora = (f) => new Date(f).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });

  onMount(() => {
    cargar(true).then(cargarNotifs);
    timer = setInterval(() => document.visibilityState === 'visible' && !grabando && cargar(), 6000);
  });
  onDestroy(() => {
    clearInterval(timer);
    terminarGrabacion(false);
  });
</script>

<div class="chat" class:llenar>
  <div class="chat-msgs" style={llenar ? '' : `height: ${alto}`} bind:this={caja}>
    {#if cargando}
      <p class="muted small center">Cargando conversación…</p>
    {:else if mensajes.length === 0}
      <div class="chat-vacio">
        <Icono nombre="chat" tam={24} />
        <p>Aún no hay mensajes. Escríbele a {otro || 'la otra parte'} o mándale una nota de voz para coordinar fechas, entrega o dudas.</p>
      </div>
    {:else}
      {#each mensajes as m, i (m.id)}
        {#if i === 0 || claveDia(m.created_at) !== claveDia(mensajes[i - 1].created_at)}
          <div class="dia"><span>{etiquetaDia(m.created_at)}</span></div>
        {/if}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="fila" class:mia={esMio(m.autor_id)} data-id={m.id}
          style={arrastre.id === m.id && arrastre.dx ? `transform: translateX(${arrastre.dx}px)` : ''}
          on:touchstart={(e) => inicioToque(m, e)} on:touchmove={moverToque} on:touchend={() => finToque(m)}>
          {#if arrastre.id === m.id && arrastre.dx > 20}
            <span class="flecha-resp" style="opacity: {Math.min(1, arrastre.dx / 55)}"><Icono nombre="reply" tam={16} /></span>
          {/if}
          <div class="burbuja" class:mia={esMio(m.autor_id)} class:audio={m.tiene_audio} class:resaltado={resaltado === m.id}
            on:click={(e) => tocarMensaje(m, e)}>
            {#if m.respuesta_a}
              <button type="button" class="cita" class:cita-mia={esMio(m.resp_autor_id)} on:click={() => irAlOriginal(m.respuesta_a)}>
                <strong>{esMio(m.resp_autor_id) ? 'Tú' : nombreCorto(m.resp_autor_nombre)}</strong>
                <span>{resumen(m.resp_texto, m.resp_audio)}</span>
              </button>
            {/if}
            {#if m.tiene_audio}
              <AudioMensaje id={m.id} seg={m.audio_seg} />
            {:else}
              <p>{m.texto}</p>
            {/if}
            <span class="hora">{hora(m.created_at)}</span>
          </div>
          {#if menuDe === m.id}
            <div class="menu-msg">
              <button type="button" on:click={() => responderA(m)}><Icono nombre="reply" tam={15} /> Responder</button>
              {#if !m.tiene_audio}<button type="button" on:click={() => copiar(m)}><Icono nombre="file" tam={15} /> Copiar</button>{/if}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
  {#if error}<p class="form-error">{error}</p>{/if}

  {#if respondiendo}
    <div class="respondiendo">
      <div class="cita" class:cita-mia={esMio(respondiendo.autor_id)}>
        <strong>Respondiendo a {esMio(respondiendo.autor_id) ? 'ti' : nombreCorto(respondiendo.autor_nombre)}</strong>
        <span>{resumen(respondiendo.texto, respondiendo.tiene_audio)}</span>
      </div>
      <button type="button" class="icon-btn" on:click={() => (respondiendo = null)} aria-label="Cancelar respuesta"><Icono nombre="x" tam={16} /></button>
    </div>
  {/if}

  {#if grabando}
    <div class="chat-form grabando">
      <button class="redondo cancelar" type="button" on:click={() => terminarGrabacion(false)} aria-label="Cancelar nota de voz">
        <Icono nombre="trash" tam={18} />
      </button>
      <div class="grabando-info">
        <span class="punto"></span> Grabando… <strong>{formatoTiempo(segundos)}</strong>
        <span class="muted small">máx. {formatoTiempo(MAX_SEG)}</span>
      </div>
      <button class="redondo enviar" type="button" on:click={() => terminarGrabacion(true)} aria-label="Enviar nota de voz">
        <Icono nombre="send" tam={18} />
      </button>
    </div>
  {:else}
    <form class="chat-form" on:submit|preventDefault={enviar}>
      <textarea class="input caja-texto" rows="1" placeholder="Escribe un mensaje…" bind:this={caja2} bind:value={texto} on:keydown={tecla} maxlength="2000"></textarea>
      {#if texto.trim()}
        <button class="redondo enviar" type="submit" disabled={enviando} aria-label="Enviar">
          <Icono nombre="send" tam={18} />
        </button>
      {:else}
        <button class="redondo enviar" type="button" disabled={enviando} on:click={empezarGrabacion} aria-label="Grabar nota de voz" title="Grabar nota de voz">
          {#if enviando}<span class="spinner"></span>{:else}<Icono nombre="mic" tam={18} />{/if}
        </button>
      {/if}
    </form>
  {/if}
</div>

<style>
  .chat { display: flex; flex-direction: column; gap: 8px; width: 100%; }
  .chat.llenar { height: 100%; min-height: 0; }
  .chat-msgs {
    display: flex; flex-direction: column; gap: 4px;
    overflow-y: auto; padding: 12px 10px;
    border-radius: 14px; background: var(--bg);
    overscroll-behavior: contain;
  }
  .llenar .chat-msgs { flex: 1; min-height: 0; }
  .chat-vacio { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; color: var(--muted); font-size: 14px; max-width: 300px; }

  .dia { display: flex; justify-content: center; margin: 10px 0 6px; }
  .dia span {
    font-size: 11px; font-weight: 600; color: var(--muted); background: var(--surface);
    padding: 3px 10px; border-radius: 999px; box-shadow: var(--sh-sm);
  }

  .fila {
    position: relative; display: flex; flex-direction: column; align-items: flex-start;
    transition: transform 0.15s ease-out;
  }
  .fila.mia { align-items: flex-end; }
  .flecha-resp {
    position: absolute; left: -30px; top: 50%; transform: translateY(-50%);
    width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
    background: var(--surface); color: var(--muted); box-shadow: var(--sh-sm);
  }
  .burbuja { cursor: pointer; transition: box-shadow 0.2s, background 0.3s; }
  .burbuja.resaltado { box-shadow: 0 0 0 3px var(--brand); }
  .cita {
    width: 100%; display: grid; gap: 1px; text-align: left; margin-bottom: 2px;
    padding: 5px 8px; border: none; border-left: 3px solid #3b82f6; border-radius: 8px;
    background: rgba(15, 23, 42, 0.06); color: var(--text); font: inherit; cursor: pointer;
  }
  .cita.cita-mia { border-left-color: var(--brand); }
  .cita strong { font-size: 12px; color: #3b82f6; }
  .cita.cita-mia strong { color: var(--brand-ink); }
  .cita span { font-size: 12.5px; color: var(--muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .menu-msg {
    display: flex; gap: 4px; margin-top: 4px; padding: 4px; border-radius: 12px;
    background: var(--surface); box-shadow: var(--sh); z-index: 2;
  }
  .menu-msg button {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: none; border-radius: 8px;
    background: transparent; color: var(--text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .menu-msg button:hover { background: var(--line-2); }
  .respondiendo { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 8px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); }
  .respondiendo .cita { cursor: default; flex: 1; min-width: 0; margin: 0; }

  .burbuja {
    max-width: 82%; padding: 7px 10px 5px; border-radius: 16px 16px 16px 4px;
    background: var(--surface); box-shadow: var(--sh-sm);
    display: flex; flex-wrap: wrap; align-items: flex-end; gap: 2px 10px;
  }
  .burbuja.mia { border-radius: 16px 16px 4px 16px; background: var(--brand-soft); }
  .burbuja.audio { min-width: 220px; }
  .burbuja p { margin: 0; font-size: 15px; line-height: 1.35; white-space: pre-line; overflow-wrap: anywhere; color: var(--text); }
  .hora { margin-left: auto; font-size: 10.5px; color: var(--muted); line-height: 1.6; }

  .chat-form { display: flex; gap: 8px; align-items: flex-end; }
  .caja-texto {
    min-height: 46px; max-height: 120px; resize: none; border-radius: 23px; padding: 12px 16px;
    line-height: 1.3;
  }
  .redondo {
    width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0; border: none; cursor: pointer;
    display: grid; place-items: center;
  }
  .redondo.enviar { background: var(--brand); color: #172033; }
  .redondo.enviar:disabled { opacity: 0.6; cursor: default; }
  .redondo.cancelar { background: var(--bad-soft); color: var(--bad); }

  .grabando { align-items: center; }
  .grabando-info {
    flex: 1; display: flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 14px;
    border-radius: 23px; background: var(--surface); border: 1px solid var(--line); font-size: 14px;
  }
  .grabando-info .muted { margin-left: auto; }
  .punto { width: 10px; height: 10px; border-radius: 50%; background: #ef4444; animation: latido 1s infinite; }
  @keyframes latido { 50% { opacity: 0.25; } }
</style>
