<script>
  import { createEventDispatcher } from 'svelte';
  // Muestra una calificación (0–5). Con `editable` permite elegirla.
  export let valor = 0;
  export let tam = 16;
  export let editable = false;

  const dispatch = createEventDispatcher();
  let hover = 0;
  $: mostrado = hover || valor || 0;
  // Ancho de relleno por estrella (admite medias)
  const relleno = (i, v) => Math.max(0, Math.min(1, v - i)) * 100;
</script>

{#if editable}
  <div class="estrellas editable" role="group" aria-label="Calificación" on:mouseleave={() => (hover = 0)}>
    {#each [1, 2, 3, 4, 5] as n}
      <button type="button" aria-pressed={valor === n} aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
        class:on={n <= mostrado} on:mouseenter={() => (hover = n)} on:click={() => dispatch('change', n)}
        style="font-size: {tam}px">★</button>
    {/each}
  </div>
{:else}
  <span class="estrellas" role="img" aria-label={`${Number(valor || 0).toFixed(1)} de 5 estrellas`} style="font-size: {tam}px">
    {#each [0, 1, 2, 3, 4] as i}
      <span class="e"><span class="lleno" style="width: {relleno(i, mostrado)}%">★</span>★</span>
    {/each}
  </span>
{/if}

<style>
  .estrellas { display: inline-flex; gap: 1px; line-height: 1; letter-spacing: 0; }
  .e { position: relative; color: var(--line); }
  .lleno { position: absolute; inset: 0 auto 0 0; overflow: hidden; color: var(--star); }
  .editable { gap: 4px; }
  .editable button { color: var(--line); line-height: 1; transition: transform 0.12s, color 0.12s; padding: 0; }
  .editable button.on { color: var(--star); }
  .editable button:hover { transform: scale(1.15); }
</style>
