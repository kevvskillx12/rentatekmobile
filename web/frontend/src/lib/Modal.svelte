<script>
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { bloquearScroll, enfocar } from './ui.js';
  import Icono from './Icono.svelte';

  export let open = false;
  export let titulo = '';
  export let subtitulo = '';
  export let ancho = 'md'; // sm | md | lg

  const dispatch = createEventDispatcher();
  const cerrar = () => dispatch('close');

  function tecla(e) {
    if (open && e.key === 'Escape') cerrar();
  }
</script>

<svelte:window on:keydown={tecla} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-fondo" transition:fade={{ duration: 180 }} on:click|self={cerrar} use:bloquearScroll>
    <div
      class="modal modal-{ancho}"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      tabindex="-1"
      use:enfocar
      transition:fly={{ y: 28, duration: 260, easing: cubicOut }}
    >
      <header class="modal-head">
        <div>
          <h3>{titulo}</h3>
          {#if subtitulo}<p>{subtitulo}</p>{/if}
        </div>
        <button class="icon-btn" on:click={cerrar} aria-label="Cerrar"><Icono nombre="x" /></button>
      </header>

      <div class="modal-body"><slot /></div>

      {#if $$slots.pie}
        <footer class="modal-foot"><slot name="pie" /></footer>
      {/if}
    </div>
  </div>
{/if}
