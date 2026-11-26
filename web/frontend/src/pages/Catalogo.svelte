<script>
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { todos, cargando, errorCarga, recargar } from '../lib/equipos.js';
  import Tarjeta from '../lib/Tarjeta.svelte';
  import Icono from '../lib/Icono.svelte';
  import Modal from '../lib/Modal.svelte';

  export let busquedaInicial = '';
  export let ubicacionInicial = '';

  const SIN_LIMITE = 1e9;
  const sinAcentos = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  let texto = busquedaInicial;
  let categoria = 'Todas';
  let ubicacion = ubicacionInicial;
  let soloDisponibles = false;
  let precioMax = SIN_LIMITE;
  let orden = 'recientes';
  let filtrosMovil = false;

  $: categorias = ['Todas', ...new Set($todos.map((m) => m.categoria))];
  $: ubicaciones = [...new Set($todos.map((m) => m.ubicacion))];
  $: tope = Math.max(10000, Math.ceil(Math.max(0, ...$todos.map((m) => m.precio)) / 500) * 500);
  $: limite = Math.min(precioMax, tope);

  $: filtrados = $todos.filter((m) => {
    const q = sinAcentos(texto.trim());
    return (
      (sinAcentos(m.nombre).includes(q) || sinAcentos(m.categoria).includes(q)) &&
      (categoria === 'Todas' || m.categoria === categoria) &&
      sinAcentos(m.ubicacion).includes(sinAcentos(ubicacion.trim())) &&
      (!soloDisponibles || m.estado === 'disponible') &&
      m.precio <= limite
    );
  });

  $: resultados =
    orden === 'precio-asc' ? [...filtrados].sort((a, b) => a.precio - b.precio)
    : orden === 'precio-desc' ? [...filtrados].sort((a, b) => b.precio - a.precio)
    : filtrados;

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
      <h1>Toda la maquinaria</h1>
      <p class="page-sub">Equipos publicados por proveedores de la región, con precio por día.</p>
    </div>
    <label class="search-inline">
      <Icono nombre="search" tam={18} />
      <input type="text" placeholder="Buscar por nombre o categoría…" bind:value={texto} />
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
        {#each categorias as c}
          <button class:active={categoria === c} on:click={() => (categoria = c)}>{c}</button>
        {/each}
      </div>
    </div>

    <label class="field">
      <span class="label">Ubicación</span>
      <input class="input" type="text" list="f-ubis" placeholder="Todas las ciudades" bind:value={ubicacion} />
      <datalist id="f-ubis">{#each ubicaciones as u}<option value={u}></option>{/each}</datalist>
    </label>

    <label class="field">
      <span class="label label-row">Precio máximo <b>${limite.toLocaleString('es-MX')}</b></span>
      <input type="range" min="500" max={tope} step="100" value={limite}
        on:input={(e) => (precioMax = Number(e.currentTarget.value))} />
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
        {#if $cargando}Cargando…{:else}<b>{resultados.length}</b> {resultados.length === 1 ? 'equipo' : 'equipos'}{/if}
      </p>
      <div class="toolbar-right">
        <button class="btn btn-ghost btn-sm only-mobile" on:click={() => (filtrosMovil = true)}>
          <Icono nombre="filter" tam={15} /> Filtros {#if activos.length}({activos.length}){/if}
        </button>
        <select class="input input-sm" bind:value={orden} aria-label="Ordenar">
          <option value="recientes">Más recientes</option>
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

    {#if $cargando}
      <div class="grid-cards">{#each Array(6) as _}<div class="skeleton-card"></div>{/each}</div>
    {:else if $errorCarga}
      <div class="empty-state card">
        <Icono nombre="alert" tam={28} />
        <h3>No se pudo cargar el catálogo</h3>
        <p>{$errorCarga}</p>
        <button class="btn btn-dark" on:click={recargar}>Reintentar</button>
      </div>
    {:else if resultados.length === 0}
      <div class="empty-state card" in:fade>
        <Icono nombre="search" tam={28} />
        <h3>Sin resultados</h3>
        <p>No encontramos maquinaria con esos filtros.</p>
        <button class="btn btn-ghost" on:click={limpiar}>Limpiar filtros</button>
      </div>
    {:else}
      <div class="grid-cards">
        {#each resultados as maquina (maquina.id)}
          <div animate:flip={{ duration: 300 }} in:fade={{ duration: 200 }}>
            <Tarjeta {maquina} />
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>

<Modal open={filtrosMovil} titulo="Filtros" on:close={() => (filtrosMovil = false)}>
  <div class="field">
    <span class="label">Categoría</span>
    <div class="cat-list">
      {#each categorias as c}
        <button class:active={categoria === c} on:click={() => (categoria = c)}>{c}</button>
      {/each}
    </div>
  </div>
  <label class="field">
    <span class="label">Ubicación</span>
    <input class="input" type="text" list="f-ubis" placeholder="Todas las ciudades" bind:value={ubicacion} />
  </label>
  <label class="field">
    <span class="label label-row">Precio máximo <b>${limite.toLocaleString('es-MX')}</b></span>
    <input type="range" min="500" max={tope} step="100" value={limite}
      on:input={(e) => (precioMax = Number(e.currentTarget.value))} />
  </label>
  <label class="switch">
    <input type="checkbox" bind:checked={soloDisponibles} />
    <span class="switch-track"></span>
    Solo disponibles
  </label>
  <svelte:fragment slot="pie">
    <button class="btn btn-ghost" on:click={limpiar}>Limpiar</button>
    <button class="btn btn-primary" on:click={() => (filtrosMovil = false)}>Ver {resultados.length} equipos</button>
  </svelte:fragment>
</Modal>
