<script>
  import { fly } from 'svelte/transition';
  import { todos, cargando } from '../lib/equipos.js';
  import { usuario } from '../lib/sesion.js';
  import Tarjeta from '../lib/Tarjeta.svelte';
  import Icono from '../lib/Icono.svelte';

  let busqueda = '';
  let lugar = '';

  $: destacadas = [...$todos]
    .sort((a, b) => (a.estado === 'disponible' ? 0 : 1) - (b.estado === 'disponible' ? 0 : 1))
    .slice(0, 6);
  $: stats = [
    { n: $todos.length, t: 'Equipos publicados' },
    { n: $todos.filter((m) => m.estado === 'disponible').length, t: 'Disponibles hoy' },
    { n: new Set($todos.map((m) => m.ubicacion)).size, t: 'Ciudades' },
    { n: new Set($todos.map((m) => m.proveedor)).size, t: 'Proveedores' }
  ];
  $: categorias = [...new Set($todos.map((m) => m.categoria))];

  function buscar() {
    window.location.hash =
      '#/catalogo/' + encodeURIComponent(busqueda.trim()) + '/' + encodeURIComponent(lugar.trim());
  }

  function porCategoria(c) {
    window.location.hash = '#/catalogo/' + encodeURIComponent(c);
  }

  const pasos = [
    { i: 'search', t: 'Busca', d: 'Filtra por tipo de equipo, ciudad y precio por día.' },
    { i: 'chat', t: 'Solicita', d: 'Envía tu solicitud con los días que necesitas y un mensaje.' },
    { i: 'check', t: 'Confirma', d: 'El proveedor acepta y se pone en contacto contigo.' }
  ];
</script>

<section class="hero">
  <div class="container">
    <div class="hero-copy" in:fly={{ y: 20, duration: 500, delay: 80 }}>
      <span class="pill">Plataforma de renta de maquinaria</span>
      <h1>Encuentra la maquinaria <span>que tu obra necesita</span></h1>
      <p class="hero-desc">Compara equipos de proveedores locales, revisa su disponibilidad y solicita la renta en minutos.</p>

      <form class="search" on:submit|preventDefault={buscar}>
        <label class="search-field">
          <span><Icono nombre="search" tam={14} /> Maquinaria</span>
          <input type="text" placeholder="Excavadora, grúa…" bind:value={busqueda} />
        </label>
        <label class="search-field">
          <span><Icono nombre="pin" tam={14} /> Ubicación</span>
          <input type="text" placeholder="Mérida" bind:value={lugar} />
        </label>
        <button class="btn btn-primary btn-lg" type="submit">Buscar</button>
      </form>

      {#if categorias.length}
        <div class="hero-cats">
          <span>Categorías:</span>
          {#each categorias.slice(0, 4) as c}
            <button type="button" on:click={() => porCategoria(c)}>{c}</button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</section>

<section class="stats-strip">
  <div class="container stats-grid">
    {#each stats as s, i}
      <div class="stat" in:fly={{ y: 16, duration: 400, delay: 150 + i * 70 }}>
        <strong>{$cargando ? '—' : s.n}</strong>
        <span>{s.t}</span>
      </div>
    {/each}
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head">
      <div>
        <p class="eyebrow">Explora</p>
        <h2>Maquinaria destacada</h2>
      </div>
      <a class="link-arrow" href="#/catalogo">Ver todo el catálogo <Icono nombre="arrowRight" tam={16} /></a>
    </div>

    <div class="grid-cards">
      {#if $cargando}
        {#each Array(3) as _}<div class="skeleton-card"></div>{/each}
      {:else}
        {#each destacadas as maquina, i (maquina.id)}
          <div in:fly={{ y: 20, duration: 400, delay: i * 60 }}><Tarjeta {maquina} /></div>
        {/each}
      {/if}
    </div>
  </div>
</section>

<section class="section section-white">
  <div class="container">
    <div class="section-head center">
      <div>
        <p class="eyebrow">Así funciona</p>
        <h2>Renta en tres pasos</h2>
      </div>
    </div>
    <div class="steps-grid">
      {#each pasos as p, i}
        <div class="step-card">
          <span class="step-num">0{i + 1}</span>
          <span class="step-ico"><Icono nombre={p.i} tam={22} /></span>
          <h3>{p.t}</h3>
          <p>{p.d}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

{#if !$usuario}
  <section class="section">
    <div class="container">
      <div class="cta-band">
        <div>
          <h2>¿Tienes maquinaria sin usar?</h2>
          <p>Publícala en Rentatek y recibe solicitudes de renta directamente en tu panel.</p>
        </div>
        <a class="btn btn-primary btn-lg" href="#/acceso">Publicar mi maquinaria</a>
      </div>
    </div>
  </section>
{/if}
