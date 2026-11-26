<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { api } from './api.js';
  import { usuario } from './sesion.js';
  import { haceTiempo } from './datos.js';
  import { cargarNotifs } from './notificaciones.js';
  import Icono from './Icono.svelte';

  // Conversación entre cliente y proveedor dentro de una solicitud
  export let solicitudId;
  export let otro = ''; // nombre de la otra persona

  let mensajes = [];
  let texto = '';
  let cargando = true;
  let enviando = false;
  let error = '';
  let caja;
  let timer;

  async function cargar(scroll = false) {
    try {
      const nuevos = await api(`/solicitudes/${solicitudId}/mensajes`);
      const cambio = nuevos.length !== mensajes.length;
      mensajes = nuevos;
      error = '';
      if (cambio || scroll) { await tick(); bajar(); }
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

  onMount(() => {
    cargar(true).then(cargarNotifs);
    timer = setInterval(() => document.visibilityState === 'visible' && cargar(), 6000);
  });
  onDestroy(() => clearInterval(timer));
</script>

<div class="chat">
  <div class="chat-msgs" bind:this={caja}>
    {#if cargando}
      <p class="muted small center">Cargando conversación…</p>
    {:else if mensajes.length === 0}
      <div class="chat-vacio">
        <Icono nombre="chat" tam={24} />
        <p>Aún no hay mensajes. Escríbele a {otro || 'la otra parte'} para coordinar fechas, entrega o dudas.</p>
      </div>
    {:else}
      {#each mensajes as m (m.id)}
        <div class="burbuja" class:mia={m.autor_id === $usuario?.id}>
          <p>{m.texto}</p>
          <span>{m.autor_id === $usuario?.id ? 'Tú' : m.autor_nombre.split(' ')[0]} · {haceTiempo(m.created_at)}</span>
        </div>
      {/each}
    {/if}
  </div>
  {#if error}<p class="form-error">{error}</p>{/if}
  <form class="chat-form" on:submit|preventDefault={enviar}>
    <textarea class="input" rows="1" placeholder="Escribe un mensaje…" bind:value={texto} on:keydown={tecla} maxlength="2000"></textarea>
    <button class="btn btn-primary" type="submit" disabled={!texto.trim() || enviando} aria-label="Enviar">
      <Icono nombre="send" tam={16} />
    </button>
  </form>
</div>

<style>
  .chat { display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .chat-msgs {
    display: flex; flex-direction: column; gap: 8px;
    height: 280px; overflow-y: auto; padding: 12px;
    border: 1px solid var(--line); border-radius: 12px; background: var(--bg);
  }
  .chat-vacio { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; color: var(--muted); font-size: 14px; max-width: 300px; }
  .burbuja { align-self: flex-start; max-width: 80%; padding: 8px 12px; border-radius: 14px 14px 14px 4px; background: var(--surface); border: 1px solid var(--line); }
  .burbuja.mia { align-self: flex-end; border-radius: 14px 14px 4px 14px; background: var(--brand-soft); border-color: transparent; }
  .burbuja p { font-size: 14px; white-space: pre-line; overflow-wrap: anywhere; color: var(--text); }
  .burbuja span { display: block; margin-top: 2px; font-size: 11px; color: var(--muted); }
  .chat-form { display: flex; gap: 8px; align-items: flex-end; }
  .chat-form textarea { min-height: 44px; max-height: 120px; resize: none; }
  .chat-form .btn { width: 46px; padding: 0; flex-shrink: 0; height: 44px; }
</style>
