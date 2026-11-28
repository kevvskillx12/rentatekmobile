<script>
  import { onMount } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Inicio from './pages/Inicio.svelte';
  import Catalogo from './pages/Catalogo.svelte';
  import Detalle from './pages/Detalle.svelte';
  import Acceso from './pages/Acceso.svelte';
  import Panel from './pages/Panel.svelte';
  import MisRentas from './pages/MisRentas.svelte';
  import Perfil from './pages/Perfil.svelte';
  import Favoritos from './pages/Favoritos.svelte';
  import Restablecer from './pages/Restablecer.svelte';
  import Admin from './pages/Admin.svelte';
  import Info from './pages/Info.svelte';
  import Contacto from './pages/Contacto.svelte';
  import Mensajes from './pages/Mensajes.svelte';
  import { noLeidosChat } from './lib/mensajes.js';
  import Avisos from './lib/Avisos.svelte';
  import Icono from './lib/Icono.svelte';
  import Campana from './lib/Campana.svelte';
  import { usuario, sesion } from './lib/sesion.js';
  import { api } from './lib/api.js';
  import { tema, alternarTema } from './lib/tema.js';
  import { iniciales } from './lib/datos.js';
  import { toast } from './lib/ui.js';

  let ruta = window.location.hash || '#/';
  let menuMovil = false;
  let menuCuenta = false;
  let scrolled = false;

  // Refresca los datos del usuario guardado (verificación, teléfono…) al abrir la app
  onMount(async () => {
    if (!$sesion?.token) return;
    try {
      const u = await api('/auth/yo');
      sesion.update((s) => (s ? { ...s, usuario: u } : s));
    } catch {}
  });

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
  $: parametro3 = decodeURIComponent(partes[3] || '');
  $: rol = $usuario?.rol;
  $: enlacePanel = rol === 'proveedor'
    ? { href: '#/panel', texto: 'Mi panel', pag: 'panel', i: 'grid' }
    : rol === 'cliente'
      ? { href: '#/mis-rentas', texto: 'Mis rentas', pag: 'mis-rentas', i: 'grid' }
      : rol === 'admin'
        ? { href: '#/admin', texto: 'Administración', pag: 'admin', i: 'settings' }
        : null;
  const ROLES = { cliente: 'Cliente', proveedor: 'Proveedor', admin: 'Administrador' };

  // Favoritos solo existe para clientes: si un proveedor o admin entra por enlace, se le manda al catálogo
  $: if (pagina === 'favoritos' && rol && rol !== 'cliente') window.location.hash = '#/catalogo';
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
      {#if rol === 'cliente' || rol === 'proveedor'}
        <a href="#/mensajes" class:active={pagina === 'mensajes'}>Mensajes{#if $noLeidosChat} <span class="count">{$noLeidosChat}</span>{/if}</a>
      {/if}
      {#if rol === 'cliente'}
        <a href="#/favoritos" class:active={pagina === 'favoritos'}>Favoritos</a>
      {/if}
    </nav>

    <div class="nav-right">
      <button class="icon-btn" on:click={alternarTema} aria-label={$tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={$tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
        <Icono nombre={$tema === 'dark' ? 'sun' : 'moon'} tam={19} />
      </button>

      {#if $usuario}
        <Campana />
        <div class="cuenta">
          <button class="cuenta-btn" on:click={() => (menuCuenta = !menuCuenta)} aria-expanded={menuCuenta}>
            <span class="avatar">{iniciales($usuario.nombre)}</span>
            <span class="cuenta-nombre">{$usuario.nombre.split(' ')[0]}</span>
            <span class="chev" class:girado={menuCuenta}><Icono nombre="chevron" tam={16} /></span>
          </button>

          {#if menuCuenta}
            <div class="dropdown" transition:fly={{ y: -8, duration: 160 }}>
              <div class="dropdown-head">
                <strong>{$usuario.nombre}</strong>
                <span>{$usuario.email}</span>
                <span class="rol-chip">{ROLES[rol]}{#if $usuario.verificado && rol === 'proveedor'} · Verificado{/if}</span>
              </div>
              {#if enlacePanel}
                <a href={enlacePanel.href}><Icono nombre={enlacePanel.i} tam={16} /> {enlacePanel.texto}</a>
              {/if}
              {#if rol === 'cliente' || rol === 'proveedor'}<a href="#/mensajes"><Icono nombre="chat" tam={16} /> Mensajes{#if $noLeidosChat} <span class="count">{$noLeidosChat}</span>{/if}</a>{/if}
              <a href="#/perfil"><Icono nombre="user" tam={16} /> Mi perfil</a>
              {#if rol === 'cliente'}<a href="#/favoritos"><Icono nombre="heart" tam={16} /> Favoritos</a>{/if}
              <a href="#/ayuda"><Icono nombre="help" tam={16} /> Ayuda</a>
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
      {#if $usuario}
        {#if enlacePanel}<a href={enlacePanel.href} class:active={pagina === enlacePanel.pag}>{enlacePanel.texto}</a>{/if}
        {#if rol === 'cliente' || rol === 'proveedor'}<a href="#/mensajes" class:active={pagina === 'mensajes'}>Mensajes{#if $noLeidosChat} <span class="count">{$noLeidosChat}</span>{/if}</a>{/if}
        {#if rol === 'cliente'}<a href="#/favoritos" class:active={pagina === 'favoritos'}>Favoritos</a>{/if}
        <a href="#/perfil" class:active={pagina === 'perfil'}>Mi perfil</a>
        <a href="#/ayuda" class:active={pagina === 'ayuda'}>Ayuda</a>
        <button on:click={cerrarSesion}>Cerrar sesión</button>
      {:else}
        <a href="#/ayuda" class:active={pagina === 'ayuda'}>Ayuda</a>
        <a href="#/acceso" class="btn btn-dark">Iniciar sesión</a>
      {/if}
    </nav>
  {/if}
</header>

<main>
  {#key ruta}
    <div class="page" in:fly={{ y: 14, duration: 320, easing: cubicOut }}>
      {#if pagina === 'catalogo'}
        <Catalogo busquedaInicial={parametro} ubicacionInicial={parametro2} categoriaInicial={parametro3} />
      {:else if pagina === 'maquina'}
        <Detalle id={parametro} />
      {:else if pagina === 'acceso'}
        <Acceso />
      {:else if pagina === 'panel'}
        <Panel solicitudId={parametro === 'solicitud' ? parametro2 : ''} editarId={parametro === 'editar' ? parametro2 : ''} />
      {:else if pagina === 'mis-rentas'}
        <MisRentas solicitudId={parametro} />
      {:else if pagina === 'perfil'}
        <Perfil />
      {:else if pagina === 'favoritos'}
        <Favoritos />
      {:else if pagina === 'restablecer'}
        <Restablecer token={parametro} />
      {:else if pagina === 'admin'}
        <Admin seccion={parametro || 'resumen'} />
      {:else if pagina === 'ayuda' || pagina === 'terminos' || pagina === 'privacidad'}
        <Info {pagina} />
      {:else if pagina === 'contacto'}
        <Contacto />
      {:else if pagina === 'mensajes'}
        <Mensajes solicitudId={parametro} />
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
      {#if rol === 'cliente'}<a href="#/favoritos">Favoritos</a>{/if}
    </div>
    <div>
      <h4>Cuenta</h4>
      {#if enlacePanel}
        <a href={enlacePanel.href}>{enlacePanel.texto}</a>
        <a href="#/perfil">Mi perfil</a>
      {:else}
        <a href="#/acceso">Iniciar sesión</a>
        <a href="#/acceso">Publicar maquinaria</a>
      {/if}
    </div>
    <div>
      <h4>Ayuda</h4>
      <a href="#/ayuda">Preguntas frecuentes</a>
      <a href="#/contacto">Contacto</a>
      <a href="#/terminos">Términos y condiciones</a>
      <a href="#/privacidad">Aviso de privacidad</a>
    </div>
  </div>
  <div class="container footer-bottom">© 2026 Rentatek</div>
</footer>

<Avisos />
