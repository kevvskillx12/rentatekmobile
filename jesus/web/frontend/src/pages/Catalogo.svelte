<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { categorias as catsBD } from '../lib/equipos.js';
  import { api } from '../lib/api.js';
  import { normalizar } from '../lib/datos.js';
  import Tarjeta from '../lib/Tarjeta.svelte';
  import Icono from '../lib/Icono.svelte';
  import Modal from '../lib/Modal.svelte';
  import Paginacion from '../lib/Paginacion.svelte';

  export let busquedaInicial = '';
  export let ubicacionInicial = '';
  export let categoriaInicial = '';

  const POR_PAGINA = 12;
  const SIN_LIMITE = 1e9;

  let texto = busquedaInicial;
  let categoria = categoriaInicial || 'Todas';
  let ubicacion = ubicacionInicial;
  let soloDisponibles = false;
  let precioMax = SIN_LIMITE;
  let orden = 'recientes';
  let pagina = 1;
  let filtrosMovil = false;

  let resultados = [];
  let total = 0;
  let paginas = 1;
  let cargando = true;
  let errorCarga = '';
  let ubicaciones = [];
  let precioTope = 0;

  onMount(async () => {
    try {
      const f = await api('/maquinaria/filtros');
      ubicaciones = f.ciudades;
      precioTope = f.precio_max;
    } catch {}
  });

  // Categorías en el orden de la tabla, solo las que tienen equipos
  $: categorias = [{ nombre: 'Todas', total: null }, ...$catsBD.filter((c) => c.total > 0)];
  $: tope = Math.max(10000, Math.ceil(precioTope / 500) * 500);
  $: limite = Math.min(precioMax, tope);

  // Texto con retardo para no consultar en cada tecla
  let textoQ = texto, ubicacionQ = ubicacion, t1;
  $: { clearTimeout(t1); const a = texto, b = ubicacion; t1 = setTimeout(() => { textoQ = a; ubicacionQ = b; }, 300); }

  // Cualquier cambio de filtro regresa a la página 1
  $: textoQ, ubicacionQ, categoria, soloDisponibles, limite, orden, (pagina = 1);

  $: params = (() => {
    const p = new URLSearchParams({ pagina: String(pagina), limite: String(POR_PAGINA), orden });
    if (textoQ.trim()) p.set('q', textoQ.trim());
    if (ubicacionQ.trim()) p.set('ciudad', ubicacionQ.trim());
    if (categoria !== 'Todas') p.set('categoria', categoria);
    if (soloDisponibles) p.set('disponibles', '1');
    if (limite < tope) p.set('precio_max', String(limite));
    return p.toString();
  })();

  let ultima = 0;
  async function cargar(qs) {
    const yo = ++ultima;
    cargando = true;
    errorCarga = '';
    try {
      const r = await api(`/maquinaria?${qs}`);
      if (yo !== ultima) return; // llegó una respuesta más nueva
      resultados = r.items.map(normalizar);
      total = r.total;
      paginas = r.paginas;
    } catch (e) {
      if (yo === ultima) errorCarga = e.message;
    } finally {
      if (yo === ultima) cargando = false;
    }
  }
  $: cargar(params);

  function irPagina(n) {
    pagina = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $: activos = [
    texto.trim() && { k: 'texto', t: `“${texto.trim()}”` },
    categoria !== 'Todas' && { k: 'categoria', t: categoria },
    ubicacion.trim() && { k: 'ubicacion', t: ubicacion.trim() },
    soloDisponibles && { k: 'disp', t: 'Solo disponibles' },
    limite < tope && { k: 'precio', t: `Hasta $${limite.toLocaleString('es-MX')}` }
  ].filter(Boolean);

  function quitar(k) {
    if (k === 'texto') texto = '';
    if (k === 'categoria') categoria = 'Todas';
    if (k === 'ubicacion') ubicacion = '';
    if (k === 'disp') soloDisponibles = false;
    if (k === 'precio') precioMax = SIN_LIMITE;
  }

  function limpiar() {
    texto = '';
    categoria = 'Todas';
    ubicacion = '';
    soloDisponibles = false;
    precioMax = SIN_LIMITE;
  }
</script>

<section class="page-head">
  <div class="container page-head-inner">
    <div>
      <p class="eyebrow">Catálogo</p>
      <h1>{categoria !== 'Todas' ? categoria : 'Toda la maquinaria'}</h1>
      <p class="page-sub">Equipos publicados por proveedores de la región, con precio por día.</p>
    </div>
    <label class="search-inline">
      <Icono nombre="search" tam={18} />
      <input type="text" placeholder="Buscar por nombre, categoría o descripción…" bind:value={texto} />
    </label>
  </div>
</section>

<section class="container catalog-layout">
  <aside class="filters card">
    <div class="filters-head">
      <h3><Icono nombre="filter" tam={16} /> Filtros</h3>
      {#if activos.length}<button class="link-btn" on:click={limpiar}>Limpiar</button>{/if}
    </div>

    <div class="field">
      <span class="label">Categoría</span>
      <div class="cat-list">
        {#each categorias as c (c.nombre)}
          <button class:active={categoria === c.nombre} on:click={() => (categoria = c.nombre)}>
            {c.nombre}{#if c.total != null} <small>({c.total})</small>{/if}
          </button>
        {/each}
      </div>
    </div>

    <label class="field">
      <span class="label">Ubicación</span>
      <input class="input" type="text" list="f-ubis" placeholder="Todas las ciudades" bind:value={ubicacion} />
      <datalist id="f-ubis">{#each ubicaciones as u}<option value={u}></option>{/each}</datalist>
    </label>

    <label class="field">
      <span class="label label-row">Precio máximo <b>{limite < tope ? `$${limite.toLocaleString('es-MX')}` : 'Sin límite'}</b></span>
      <input type="range" min="500" max={tope} step="100" value={limite}
        on:change={(e) => (precioMax = Number(e.currentTarget.value))} />
    </label>

    <label class="switch">
      <input type="checkbox" bind:checked={soloDisponibles} />
      <span class="switch-track"></span>
      Solo disponibles
    </label>
  </aside>

  <div class="catalog-main">
    <div class="toolbar">
      <p class="muted">
        {#if cargando && !resultados.length}Cargando…{:else}<b>{total}</b> {total === 1 ? 'equipo' : 'equipos'}{#if paginas > 1} · página {pagina} de {paginas}{/if}{/if}
      </p>
      <div class="toolbar-right">
        <button class="btn btn-ghost btn-sm only-mobile" on:click={() => (filtrosMovil = true)}>
          <Icono nombre="filter" tam={15} /> Filtros {#if activos.length}({activos.length}){/if}
        </button>
        <select class="input input-sm" bind:value={orden} aria-label="Ordenar">
          <option value="recientes">Más recientes</option>
          <option value="calificacion">Mejor calificados</option>
          <option value="precio-asc">Precio: menor a mayor</option>
          <option value="precio-desc">Precio: mayor a menor</option>
        </select>
      </div>
    </div>

    {#if activos.length}
      <div class="chips-activos" transition:fade={{ duration: 150 }}>
        {#each activos as a (a.k)}
          <button class="chip-activo" on:click={() => quitar(a.k)} transition:fly={{ y: -4, duration: 150 }}>
            {a.t} <Icono nombre="x" tam={13} />
          </button>
        {/each}
      </div>
    {/if}

    {#if cargando && !resultados.length}
      <div class="grid-cards">{#each Array(6) as _}<div class="skeleton-card"></div>{/each}</div>
    {:else if errorCarga}
      <div class="empty-state card">
        <Icono nombre="alert" tam={28} />
        <h3>No se pudo cargar el catálogo</h3>
        <p>{errorCarga}</p>
        <button class="btn btn-dark" on:click={() => cargar(params)}>Reintentar</button>
      </div>
    {:else if resultados.length === 0}
      <div class="empty-state card" in:fade>
        <Icono nombre="search" tam={28} />
        <h3>Sin resultados</h3>
        <p>No encontramos maquinaria con esos filtros.</p>
        <button class="btn btn-ghost" on:click={limpiar}>Limpiar filtros</button>
      </div>
    {:else}
      <div class="grid-cards" class:recargando={cargando}>
        {#each resultados as maquina (maquina.id)}
          <div in:fade={{ duration: 200 }}>
            <Tarjeta {maquina} />
          </div>
        {/each}
      </div>
      <Paginacion {pagina} {paginas} on:cambiar={(e) => irPagina(e.detail)} />
    {/if}
  </div>
</section>

<Modal open={filtrosMovil} titulo="Filtros" on:close={() => (filtrosMovil = false)}>
  <div class="field">
    <span class="label">Categoría</span>
    <div class="cat-list">
      {#each categorias as c (c.nombre)}
        <button class:active={categoria === c.nombre} on:click={() => (categoria = c.nombre)}>
          {c.nombre}{#if c.total != null} <small>({c.total})</small>{/if}
        </button>
      {/each}
    </div>
  </div>
  <label class="field">
    <span class="label">Ubicación</span>
    <input class="input" type="text" list="f-ubis" placeholder="Todas las ciudades" bind:value={ubicacion} />
  </label>
  <label class="field">
    <span class="label label-row">Precio máximo <b>{limite < tope ? `$${limite.toLocaleString('es-MX')}` : 'Sin límite'}</b></span>
    <input type="range" min="500" max={tope} step="100" value={limite}
      on:change={(e) => (precioMax = Number(e.currentTarget.value))} />
  </label>
  <label class="switch">
    <input type="checkbox" bind:checked={soloDisponibles} />
    <span class="switch-track"></span>
    Solo disponibles
  </label>
  <svelte:fragment slot="pie">
    <button class="btn btn-ghost" on:click={limpiar}>Limpiar</button>
    <button class="btn btn-primary" on:click={() => (filtrosMovil = false)}>Ver {total} equipos</button>
  </svelte:fragment>
</Modal>

<style>
  .recargando { opacity: 0.55; transition: opacity 0.2s; pointer-events: none; }
</style>
