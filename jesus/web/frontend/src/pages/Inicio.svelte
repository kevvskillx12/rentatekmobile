<script>
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { categorias as catsBD } from '../lib/equipos.js';
  import { usuario } from '../lib/sesion.js';
  import { api } from '../lib/api.js';
  import { normalizar } from '../lib/datos.js';
  import Tarjeta from '../lib/Tarjeta.svelte';
  import Icono from '../lib/Icono.svelte';

  let busqueda = '';
  let lugar = '';
  let destacadas = [];
  let est = null;
  let cargando = true;

  onMount(async () => {
    try {
      const [d, e] = await Promise.all([api('/maquinaria?orden=destacadas&limite=6'), api('/estadisticas')]);
      destacadas = d.items.map(normalizar);
      est = e;
    } catch {
      /* se muestran los bloques vacíos */
    } finally {
      cargando = false;
    }
  });

  $: stats = [
    { n: est?.equipos, t: 'Equipos publicados' },
    { n: est?.disponibles, t: 'Disponibles hoy' },
    { n: est?.ciudades, t: 'Ciudades' },
    { n: est?.proveedores, t: 'Proveedores' }
  ];
  $: tarjetasCat = $catsBD.filter((c) => c.total > 0);
  $: categorias = [...tarjetasCat].sort((a, b) => b.total - a.total).map((c) => c.nombre);

  function buscar() {
    window.location.hash =
      '#/catalogo/' + encodeURIComponent(busqueda.trim()) + '/' + encodeURIComponent(lugar.trim());
  }

  function porCategoria(c) {
    window.location.hash = '#/catalogo///' + encodeURIComponent(c);
  }

  const pasos = [
    { i: 'search', t: 'Busca', d: 'Filtra por tipo de equipo, ciudad y precio por día.' },
    { i: 'calendar', t: 'Elige fechas', d: 'Marca en el calendario los días que necesitas; las fechas ocupadas ya aparecen bloqueadas.' },
    { i: 'check', t: 'Confirma', d: 'El proveedor acepta y coordinan la entrega por el chat.' }
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
        <strong>{cargando || s.n == null ? '—' : s.n}</strong>
        <span>{s.t}</span>
      </div>
    {/each}
  </div>
</section>

<section class="section section-white">
  <div class="container">
    <div class="section-head">
      <div>
        <p class="eyebrow">Categorías</p>
        <h2>Maquinaria pesada para cada etapa de tu obra</h2>
      </div>
      <a class="link-arrow" href="#/catalogo">Ver catálogo <Icono nombre="arrowRight" tam={16} /></a>
    </div>

    <div class="cat-grid">
      {#if cargando}
        {#each Array(8) as _}<div class="cat-card skeleton"></div>{/each}
      {:else}
        {#each tarjetasCat as c, i (c.id)}
          <button type="button" class="cat-card" on:click={() => porCategoria(c.nombre)}
            in:fly={{ y: 16, duration: 350, delay: i * 40 }}>
            <img src={c.imagen || '/img/Excavadora.jpg'} alt="" loading="lazy" />
            <div class="cat-body">
              <h3>{c.nombre}</h3>
              <p>{c.descripcion}</p>
              <span class="cat-count">{c.total} {c.total === 1 ? 'equipo' : 'equipos'} · {c.disponibles} disponibles</span>
            </div>
          </button>
        {/each}
      {/if}
    </div>
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
      {#if cargando}
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

<style>
  .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; }
  .cat-card {
    display: flex; flex-direction: column; text-align: left; overflow: hidden;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg);
    box-shadow: var(--sh-sm); transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease), border-color 0.25s;
  }
  .cat-card:hover { transform: translateY(-3px); box-shadow: var(--sh); border-color: var(--brand); }
  .cat-card img { width: 100%; height: 120px; object-fit: cover; }
  .cat-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .cat-body h3 { font-size: 17px; }
  .cat-body p { color: var(--muted); font-size: 13.5px; line-height: 1.45; flex: 1; }
  .cat-count { color: var(--brand-ink); font-size: 12.5px; font-weight: 600; }
  .cat-card.skeleton { height: 250px; background: var(--line-2); animation: pulso 1.2s ease-in-out infinite; }
  @keyframes pulso { 50% { opacity: 0.55; } }
</style>
