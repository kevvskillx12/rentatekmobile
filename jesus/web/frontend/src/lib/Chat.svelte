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
      await api(`/solicitudes/${solicitudId}/mensajes`, { method: 'POST', body: { texto: t } });
      texto = '';
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
      await api(`/solicitudes/${solicitudId}/audio?seg=${seg}`, { method: 'POST', body: limpio });
      await cargar(true);
      cargarConversaciones();
    } catch (e) {
      error = e.message;
    } finally {
      enviando = false;
    }
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
        <div class="burbuja" class:mia={m.autor_id === $usuario?.id} class:audio={m.tiene_audio}>
          {#if m.tiene_audio}
            <AudioMensaje id={m.id} seg={m.audio_seg} />
          {:else}
            <p>{m.texto}</p>
          {/if}
          <span class="hora">{hora(m.created_at)}</span>
        </div>
      {/each}
    {/if}
  </div>
  {#if error}<p class="form-error">{error}</p>{/if}

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
      <textarea class="input caja-texto" rows="1" placeholder="Escribe un mensaje…" bind:value={texto} on:keydown={tecla} maxlength="2000"></textarea>
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

  .burbuja {
    align-self: flex-start; max-width: 82%; padding: 7px 10px 5px; border-radius: 16px 16px 16px 4px;
    background: var(--surface); box-shadow: var(--sh-sm);
    display: flex; flex-wrap: wrap; align-items: flex-end; gap: 2px 10px;
  }
  .burbuja.mia { align-self: flex-end; border-radius: 16px 16px 4px 16px; background: var(--brand-soft); }
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
