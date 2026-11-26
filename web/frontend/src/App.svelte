<script>
  import { fly, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Inicio from './pages/Inicio.svelte';
  import Catalogo from './pages/Catalogo.svelte';
  import Detalle from './pages/Detalle.svelte';
  import Acceso from './pages/Acceso.svelte';
  import Panel from './pages/Panel.svelte';
  import MisRentas from './pages/MisRentas.svelte';
  import Avisos from './lib/Avisos.svelte';
  import Icono from './lib/Icono.svelte';
  import { usuario, sesion } from './lib/sesion.js';
  import { toast } from './lib/ui.js';

  let ruta = window.location.hash || '#/';
  let menuMovil = false;
  let menuCuenta = false;
  let scrolled = false;

  function actualizar() {
    ruta = window.location.hash || '#/';
    menuMovil = false;
    menuCuenta = false;
    window.scrollTo({ top: 0 });
  }

  function cerrarSesion() {
    sesion.set(null);
    menuCuenta = false;
    menuMovil = false;
    toast('Sesión cerrada');
    window.location.hash = '#/';
  }

  function clicFuera(e) {
    if (menuCuenta && !e.target.closest('.cuenta')) menuCuenta = false;
  }

  $: partes = ruta.replace('#/', '').split('/');
  $: pagina = partes[0];
  $: parametro = decodeURIComponent(partes[1] || '');
  $: parametro2 = decodeURIComponent(partes[2] || '');
  $: iniciales = ($usuario?.nombre || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
  $: enlacePanel = $usuario?.rol === 'proveedor'
    ? { href: '#/panel', texto: 'Mi panel', pag: 'panel' }
    : $usuario?.rol === 'cliente'
      ? { href: '#/mis-rentas', texto: 'Mis rentas', pag: 'mis-rentas' }
      : null;
</script>

<svelte:window
  on:hashchange={actualizar}
  on:click={clicFuera}
  on:scroll={() => (scrolled = window.scrollY > 8)}
/>

<header class="navbar" class:scrolled>
  <div class="container nav-inner">
    <a class="logo" href="#/">RENTA<span>TEK</span></a>

    <nav class="nav-links" aria-label="Principal">
      <a href="#/" class:active={pagina === ''}>Inicio</a>
      <a href="#/catalogo" class:active={pagina === 'catalogo' || pagina === 'maquina'}>Catálogo</a>
      {#if enlacePanel}
        <a href={enlacePanel.href} class:active={pagina === enlacePanel.pag}>{enlacePanel.texto}</a>
      {/if}
    </nav>

    <div class="nav-right">
      {#if $usuario}
        <div class="cuenta">
          <button class="cuenta-btn" on:click={() => (menuCuenta = !menuCuenta)} aria-expanded={menuCuenta}>
            <span class="avatar">{iniciales}</span>
            <span class="cuenta-nombre">{$usuario.nombre.split(' ')[0]}</span>
            <span class="chev" class:girado={menuCuenta}><Icono nombre="chevron" tam={16} /></span>
          </button>

          {#if menuCuenta}
            <div class="dropdown" transition:fly={{ y: -8, duration: 160 }}>
              <div class="dropdown-head">
                <strong>{$usuario.nombre}</strong>
                <span>{$usuario.email}</span>
                <span class="rol-chip">{$usuario.rol === 'proveedor' ? 'Proveedor' : 'Cliente'}</span>
              </div>
              {#if enlacePanel}
                <a href={enlacePanel.href}><Icono nombre="grid" tam={16} /> {enlacePanel.texto}</a>
              {/if}
              <a href="#/catalogo"><Icono nombre="search" tam={16} /> Explorar catálogo</a>
              <button on:click={cerrarSesion}><Icono nombre="logout" tam={16} /> Cerrar sesión</button>
            </div>
          {/if}
        </div>
      {:else}
        <a class="btn btn-dark btn-sm nav-login" href="#/acceso">Iniciar sesión</a>
      {/if}

      <button class="icon-btn menu-toggle" on:click={() => (menuMovil = !menuMovil)} aria-label="Menú">
        <Icono nombre={menuMovil ? 'x' : 'menu'} tam={22} />
      </button>
    </div>
  </div>

  {#if menuMovil}
    <nav class="menu-movil" transition:slide={{ duration: 220 }} aria-label="Menú móvil">
      <a href="#/" class:active={pagina === ''}>Inicio</a>
      <a href="#/catalogo" class:active={pagina === 'catalogo'}>Catálogo</a>
      {#if enlacePanel}
        <a href={enlacePanel.href} class:active={pagina === enlacePanel.pag}>{enlacePanel.texto}</a>
        <button on:click={cerrarSesion}>Cerrar sesión</button>
      {:else}
        <a href="#/acceso" class="btn btn-dark">Iniciar sesión</a>
      {/if}
    </nav>
  {/if}
</header>

<main>
  {#key ruta}
    <div class="page" in:fly={{ y: 14, duration: 320, easing: cubicOut }}>
      {#if pagina === 'catalogo'}
        <Catalogo busquedaInicial={parametro} ubicacionInicial={parametro2} />
      {:else if pagina === 'maquina'}
        <Detalle id={parametro} />
      {:else if pagina === 'acceso'}
        <Acceso />
      {:else if pagina === 'panel'}
        <Panel />
      {:else if pagina === 'mis-rentas'}
        <MisRentas />
      {:else}
        <Inicio />
      {/if}
    </div>
  {/key}
</main>

<footer class="footer">
  <div class="container footer-grid">
    <div>
      <div class="logo logo-light">RENTA<span>TEK</span></div>
      <p>Conectamos a quienes necesitan maquinaria con proveedores que la tienen disponible.</p>
    </div>
    <div>
      <h4>Explorar</h4>
      <a href="#/">Inicio</a>
      <a href="#/catalogo">Catálogo</a>
    </div>
    <div>
      <h4>Cuenta</h4>
      {#if enlacePanel}
        <a href={enlacePanel.href}>{enlacePanel.texto}</a>
      {:else}
        <a href="#/acceso">Iniciar sesión</a>
        <a href="#/acceso">Publicar maquinaria</a>
      {/if}
    </div>
  </div>
  <div class="container footer-bottom">© 2026 Rentatek</div>
</footer>

<Avisos />
