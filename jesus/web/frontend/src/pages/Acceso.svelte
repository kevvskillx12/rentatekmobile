<script>
  import { fly, slide } from 'svelte/transition';
  import { sesion } from '../lib/sesion.js';
  import { api } from '../lib/api.js';
  import { toast } from '../lib/ui.js';
  import Icono from '../lib/Icono.svelte';

  let modo = 'login'; // 'login' | 'registro' | 'olvide'
  let rol = 'cliente'; // 'cliente' | 'proveedor'
  let nombre = '';
  let empresa = '';
  let telefono = '';
  let avisoOlvide = '';
  let correo = '';
  let clave = '';
  let verClave = false;
  let error = '';
  let enviando = false;

  function cambiarModo(nuevo) {
    modo = nuevo;
    error = '';
    avisoOlvide = '';
  }

  async function olvide() {
    error = '';
    const email = correo.trim().toLowerCase();
    if (!email) return (error = 'Escribe el correo de tu cuenta.');
    enviando = true;
    try {
      avisoOlvide = (await api('/auth/olvide', { method: 'POST', body: { email } })).mensaje;
    } catch (e) {
      error = e.message;
    } finally {
      enviando = false;
    }
  }

  async function enviar() {
    if (enviando) return;
    if (modo === 'olvide') return olvide();
    error = '';
    const email = correo.trim().toLowerCase();

    if (!email || !clave) {
      error = 'Completa todos los campos.';
      return;
    }
    if (modo === 'registro') {
      if (!nombre.trim()) {
        error = 'Escribe tu nombre.';
        return;
      }
      if (clave.length < 6) {
        error = 'La contraseña debe tener al menos 6 caracteres.';
        return;
      }
    }

    enviando = true;
    try {
      const datos =
        modo === 'registro'
          ? await api('/auth/registro', {
              method: 'POST',
              body: { nombre: nombre.trim(), empresa: empresa.trim(), telefono: telefono.trim(), email, password: clave, rol }
            })
          : await api('/auth/login', { method: 'POST', body: { email, password: clave } });

      sesion.set(datos);
      toast(`Bienvenido, ${datos.usuario.nombre.split(' ')[0]}`);
      const r = datos.usuario.rol;
      window.location.hash = r === 'proveedor' ? '#/panel' : r === 'admin' ? '#/admin' : '#/mis-rentas';
    } catch (e) {
      error = e.message;
    } finally {
      enviando = false;
    }
  }
</script>

<section class="container auth-wrap">
  <div class="auth-split card">
    <div class="auth-brand">
      <div class="logo logo-light">RENTA<span>TEK</span></div>
      <h2>Renta y publica maquinaria en un solo lugar</h2>
      <ul>
        <li><Icono nombre="search" /> Encuentra equipos por ciudad y precio</li>
        <li><Icono nombre="chat" /> Envía solicitudes y recibe respuesta del proveedor</li>
        <li><Icono nombre="trend" /> Si eres proveedor, gestiona tus equipos y rentas</li>
      </ul>
    </div>

    <div class="auth-form">
      <div class="segmented">
        <button class:active={modo === 'login'} on:click={() => cambiarModo('login')}>Iniciar sesión</button>
        <button class:active={modo === 'registro'} on:click={() => cambiarModo('registro')}>Crear cuenta</button>
        <span class="segmented-bg" class:derecha={modo === 'registro'}></span>
      </div>

      {#key modo}
        <div in:fly={{ y: 8, duration: 220 }}>
          <h1>{modo === 'login' ? 'Bienvenido de nuevo' : modo === 'olvide' ? 'Recupera tu contraseña' : 'Crea tu cuenta'}</h1>
          <p class="muted">
            {modo === 'login' ? 'Ingresa con tu correo y contraseña.'
              : modo === 'olvide' ? 'Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.'
              : 'Elige cómo usarás Rentatek.'}
          </p>
        </div>
      {/key}

      {#if modo === 'olvide'}
        <form on:submit|preventDefault={enviar} class="stack">
          <label class="field">
            <span class="label">Correo</span>
            <input class="input" type="email" bind:value={correo} placeholder="correo@ejemplo.com" autocomplete="email" />
          </label>
          {#if error}<p class="form-error">{error}</p>{/if}
          {#if avisoOlvide}<div class="notice notice-ok"><Icono nombre="mail" tam={16} /> {avisoOlvide}</div>{/if}
          <button class="btn btn-primary btn-lg btn-block" type="submit" disabled={enviando}>
            {#if enviando}<span class="spinner"></span>{/if} Enviar enlace
          </button>
          <button type="button" class="link-btn center" on:click={() => cambiarModo('login')}>← Volver a iniciar sesión</button>
        </form>
      {:else}

      <form on:submit|preventDefault={enviar} class="stack">
        {#if modo === 'registro'}
          <div class="role-cards" transition:slide={{ duration: 200 }}>
            <button type="button" class:active={rol === 'cliente'} on:click={() => (rol = 'cliente')}>
              <Icono nombre="search" tam={20} />
              <strong>Busco maquinaria</strong>
              <span>Quiero rentar equipos</span>
            </button>
            <button type="button" class:active={rol === 'proveedor'} on:click={() => (rol = 'proveedor')}>
              <Icono nombre="briefcase" tam={20} />
              <strong>Ofrezco maquinaria</strong>
              <span>Quiero publicar mis equipos</span>
            </button>
          </div>

          <label class="field" transition:slide={{ duration: 200 }}>
            <span class="label">Nombre</span>
            <input class="input" type="text" bind:value={nombre} placeholder="Tu nombre" autocomplete="name" />
          </label>

          {#if rol === 'proveedor'}
            <label class="field" transition:slide={{ duration: 200 }}>
              <span class="label">Empresa (opcional)</span>
              <input class="input" type="text" bind:value={empresa} placeholder="Nombre comercial" />
            </label>
          {/if}

          <label class="field" transition:slide={{ duration: 200 }}>
            <span class="label">Teléfono / WhatsApp (opcional)</span>
            <input class="input" type="tel" bind:value={telefono} placeholder="9991234567" autocomplete="tel" />
          </label>
        {/if}

        <label class="field">
          <span class="label">Correo</span>
          <input class="input" type="email" bind:value={correo} placeholder="correo@ejemplo.com" autocomplete="email" />
        </label>

        <label class="field">
          <span class="label">Contraseña</span>
          <div class="input-icon">
            {#if verClave}
              <input class="input" type="text" bind:value={clave} placeholder="Mínimo 6 caracteres" />
            {:else}
              <input class="input" type="password" bind:value={clave} placeholder="Mínimo 6 caracteres"
                autocomplete={modo === 'login' ? 'current-password' : 'new-password'} />
            {/if}
            <button type="button" class="icon-btn" on:click={() => (verClave = !verClave)}
              aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              <Icono nombre="eye" tam={17} />
            </button>
          </div>
        </label>

        {#if error}<p class="form-error" in:fly={{ y: -4, duration: 150 }}>{error}</p>{/if}

        {#if modo === 'login'}
          <button type="button" class="link-btn olvide" on:click={() => cambiarModo('olvide')}>¿Olvidaste tu contraseña?</button>
        {/if}

        <button class="btn btn-primary btn-lg btn-block" type="submit" disabled={enviando}>
          {#if enviando}<span class="spinner"></span>{/if}
          {modo === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
      {/if}
    </div>
  </div>
</section>
