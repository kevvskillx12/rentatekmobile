<script>
  import { formatoDinero, ESTADOS_MAQUINA } from './datos.js';
  import Icono from './Icono.svelte';
  export let maquina;
</script>

<article class="card-maq">
  <div class="card-img">
    <img src={maquina.imagen} alt={maquina.nombre} loading="lazy" />
    <span class="badge badge-float estado-{maquina.estado}">{ESTADOS_MAQUINA[maquina.estado] || maquina.estado}</span>
  </div>

  <div class="card-body">
    <p class="eyebrow">{maquina.categoria}</p>
    <h3><a class="stretched" href={`#/maquina/${maquina.id}`}>{maquina.nombre}</a></h3>
    <p class="meta"><Icono nombre="pin" tam={14} /> {maquina.ubicacion}</p>

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
