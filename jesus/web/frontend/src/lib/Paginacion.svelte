<script>
  import { createEventDispatcher } from 'svelte';
  import Icono from './Icono.svelte';

  export let pagina = 1;
  export let paginas = 1;
  const dispatch = createEventDispatcher();

  // Números visibles: 1 … p-1 p p+1 … N
  $: numeros = (() => {
    const set = new Set([1, paginas, pagina - 1, pagina, pagina + 1].filter((n) => n >= 1 && n <= paginas));
    const lista = [...set].sort((a, b) => a - b);
    const out = [];
    lista.forEach((n, i) => {
      if (i && n - lista[i - 1] > 1) out.push('…');
      out.push(n);
    });
    return out;
  })();

  const ir = (n) => n !== pagina && n >= 1 && n <= paginas && dispatch('cambiar', n);
</script>

{#if paginas > 1}
  <nav class="paginacion" aria-label="Páginas">
    <button class="icon-btn" on:click={() => ir(pagina - 1)} disabled={pagina === 1} aria-label="Anterior">
      <Icono nombre="chevronLeft" tam={18} />
    </button>
    {#each numeros as n}
      {#if n === '…'}<span class="puntos">…</span>
      {:else}
        <button class="num" class:active={n === pagina} aria-current={n === pagina ? 'page' : undefined} on:click={() => ir(n)}>{n}</button>
      {/if}
    {/each}
    <button class="icon-btn" on:click={() => ir(pagina + 1)} disabled={pagina === paginas} aria-label="Siguiente">
      <Icono nombre="chevronRight" tam={18} />
    </button>
  </nav>
{/if}

<style>
  .paginacion { display: flex; justify-content: center; align-items: center; gap: 4px; margin-top: 28px; }
  .num { min-width: 38px; height: 38px; border-radius: 9px; font-size: 14px; font-weight: 600; color: var(--muted); transition: background 0.15s; }
  .num:hover { background: var(--line-2); color: var(--ink); }
  .num.active { background: var(--brand); color: #172033; }
  .puntos { color: var(--muted-2); padding: 0 4px; }
  .icon-btn:disabled { opacity: 0.35; cursor: default; }
</style>
