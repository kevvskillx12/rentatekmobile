<script>
  import { fade } from 'svelte/transition';
  import { usuario } from '../lib/sesion.js';
  import { favoritos } from '../lib/favoritos.js';
  import { api } from '../lib/api.js';
  import { normalizar } from '../lib/datos.js';
  import Tarjeta from '../lib/Tarjeta.svelte';
  import Icono from '../lib/Icono.svelte';

  let lista = [];
  let cargando = true;
  let errorCarga = '';

  async function cargar() {
    cargando = true;
    errorCarga = '';
    try {
      lista = (await api('/favoritos')).map(normalizar);
    } catch (e) {
      errorCarga = e.message;
    } finally {
      cargando = false;
    }
  }

  $: if ($usuario) cargar();
  // Al quitar un favorito desde la tarjeta, desaparece de la lista
  $: visibles = lista.filter((m) => $favoritos.has(m.id));
</script>

{#if !$usuario}
  <div class="container detail-wrap">
    <div class="empty-state card">
      <Icono nombre="heart" tam={28} />
      <h3>Inicia sesión para ver tus favoritos</h3>
      <a class="btn btn-dark" href="#/acceso">Iniciar sesión</a>
    </div>
  </div>
{:else}
  <section class="page-head">
    <div class="container page-head-inner">
      <div>
        <p class="eyebrow">Favoritos</p>
        <h1>Equipos guardados</h1>
        <p class="page-sub">Tócale al corazón en cualquier equipo para guardarlo aquí y compararlo después.</p>
      </div>
    </div>
  </section>

  <section class="container dash">
    {#if cargando}
      <div class="grid-cards">{#each Array(3) as _}<div class="skeleton-card"></div>{/each}</div>
    {:else if errorCarga}
      <div class="empty-state card">
        <Icono nombre="alert" tam={28} />
        <h3>No se pudieron cargar tus favoritos</h3>
        <p>{errorCarga}</p>
        <button class="btn btn-dark" on:click={cargar}>Reintentar</button>
      </div>
    {:else if visibles.length === 0}
      <div class="empty-state card" in:fade>
        <Icono nombre="heart" tam={28} />
        <h3>Aún no tienes favoritos</h3>
        <p>Explora el catálogo y guarda los equipos que te interesen.</p>
        <a class="btn btn-primary" href="#/catalogo">Explorar catálogo</a>
      </div>
    {:else}
      <div class="grid-cards">
        {#each visibles as maquina (maquina.id)}
          <div out:fade={{ duration: 150 }}><Tarjeta {maquina} /></div>
        {/each}
      </div>
    {/if}
  </section>
{/if}
