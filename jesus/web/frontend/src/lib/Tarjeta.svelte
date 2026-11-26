<script>
  import { formatoDinero, ESTADOS_MAQUINA } from './datos.js';
  import { favoritos, alternarFavorito } from './favoritos.js';
  import Icono from './Icono.svelte';
  import Estrellas from './Estrellas.svelte';
  export let maquina;

  $: fav = $favoritos.has(maquina.id);
</script>

<article class="card-maq">
  <div class="card-img">
    <img src={maquina.imagen} alt={maquina.nombre} loading="lazy" />
    <span class="badge badge-float estado-{maquina.estado}">{ESTADOS_MAQUINA[maquina.estado] || maquina.estado}</span>
    <button class="fav-btn" class:on={fav} on:click|preventDefault|stopPropagation={() => alternarFavorito(maquina.id)}
      aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'} aria-pressed={fav}>
      <Icono nombre="heart" tam={18} relleno={fav} />
    </button>
  </div>

  <div class="card-body">
    <p class="eyebrow">{maquina.categoria}</p>
    <h3><a class="stretched" href={`#/maquina/${maquina.id}`}>{maquina.nombre}</a></h3>
    <p class="meta"><Icono nombre="pin" tam={14} /> {maquina.ubicacion}</p>

    <div class="card-rating">
      {#if maquina.resenas}
        <Estrellas valor={maquina.promedio} tam={14} />
        <span><b>{maquina.promedio?.toFixed(1)}</b> ({maquina.resenas})</span>
      {:else}
        <span class="muted">Sin reseñas aún</span>
      {/if}
      {#if maquina.verificado}
        <span class="verif" title="Proveedor verificado"><Icono nombre="shield" tam={13} /> Verificado</span>
      {/if}
    </div>

    {#if maquina.specs.length}
      <ul class="spec-chips">
        {#each maquina.specs.slice(0, 2) as s}<li>{s}</li>{/each}
      </ul>
    {/if}

    <div class="card-foot">
      <div class="precio">
        <strong>{formatoDinero(maquina.precio)}</strong><span>/ día</span>
      </div>
      <span class="card-cta">Ver detalles <Icono nombre="arrowRight" tam={15} /></span>
    </div>
  </div>
</article>
