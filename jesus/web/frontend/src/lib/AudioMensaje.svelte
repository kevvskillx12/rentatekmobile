<script>
  // Reproductor de una nota de voz del chat. El audio es privado: se descarga con la sesión
  // del usuario (no se puede poner la URL directo en <audio>) y se reproduce desde memoria.
  import { onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { BASE } from './api.js';
  import { sesion } from './sesion.js';
  import Icono from './Icono.svelte';

  export let id;
  export let seg = 0;

  let audio;
  let url = '';
  let cargando = false;
  let sonando = false;
  let actual = 0;
  let total = seg || 0;
  let fallo = false;

  const formato = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  async function alternar() {
    if (sonando) return audio.pause();
    if (!url) {
      cargando = true;
      fallo = false;
      try {
        const r = await fetch(`${BASE}/mensajes/${id}/audio`, { headers: { Authorization: `Bearer ${get(sesion)?.token}` } });
        if (!r.ok) throw new Error();
        url = URL.createObjectURL(await r.blob());
        audio.src = url;
      } catch {
        fallo = true;
        return;
      } finally {
        cargando = false;
      }
    }
    try {
      await audio.play();
    } catch {
      fallo = true;
    }
  }

  function alAvanzar() {
    actual = audio.currentTime;
    if (Number.isFinite(audio.duration) && audio.duration > 0) total = audio.duration;
  }

  function saltar(e) {
    if (!url || !total) return;
    const r = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * total;
  }

  onDestroy(() => url && URL.revokeObjectURL(url));
</script>

<div class="nota">
  <button class="play" on:click={alternar} aria-label={sonando ? 'Pausar' : 'Reproducir nota de voz'} disabled={cargando}>
    {#if cargando}<span class="spinner"></span>{:else if sonando}<span class="pausa"></span>{:else}<span class="triangulo"></span>{/if}
  </button>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="pista" on:click={saltar}>
    <div class="relleno" style="width: {total ? Math.min(100, (actual / total) * 100) : 0}%"></div>
  </div>
  <span class="tiempo">{fallo ? 'Error' : formato(sonando || actual ? actual : total)}</span>
  <Icono nombre="mic" tam={14} />
  <audio bind:this={audio} on:play={() => (sonando = true)} on:pause={() => (sonando = false)}
    on:ended={() => { sonando = false; actual = 0; }} on:timeupdate={alAvanzar} on:loadedmetadata={alAvanzar} preload="none"></audio>
</div>

<style>
  .nota { display: flex; align-items: center; gap: 10px; width: 100%; padding: 2px 0; color: var(--muted); }
  .play {
    width: 36px; height: 36px; border-radius: 50%; border: none; flex-shrink: 0; cursor: pointer;
    display: grid; place-items: center; background: var(--brand); color: #172033;
  }
  .triangulo { width: 0; height: 0; margin-left: 3px; border-style: solid; border-width: 7px 0 7px 11px; border-color: transparent transparent transparent currentColor; }
  .pausa { width: 10px; height: 12px; border-left: 3px solid currentColor; border-right: 3px solid currentColor; }
  .pista { flex: 1; height: 6px; border-radius: 999px; background: var(--line); cursor: pointer; overflow: hidden; }
  .relleno { height: 100%; background: var(--brand-ink); transition: width 0.15s linear; }
  .tiempo { font-size: 12px; font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; }
</style>
