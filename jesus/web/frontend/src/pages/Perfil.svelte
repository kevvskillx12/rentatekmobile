<script>
  import { fly } from 'svelte/transition';
  import { usuario, sesion } from '../lib/sesion.js';
  import { api } from '../lib/api.js';
  import { toast } from '../lib/ui.js';
  import { formatoFecha, iniciales } from '../lib/datos.js';
  import Icono from '../lib/Icono.svelte';

  let nombre = $usuario?.nombre || '';
  let empresa = $usuario?.empresa || '';
  let telefono = $usuario?.telefono || '';
  let error = '';
  let guardando = false;

  let actual = '';
  let nueva = '';
  let confirmar = '';
  let errorClave = '';
  let cambiando = false;

  const ROLES = { cliente: 'Cliente', proveedor: 'Proveedor', admin: 'Administrador' };

  async function guardar() {
    error = '';
    if (!nombre.trim()) return (error = 'El nombre no puede quedar vacío.');
    guardando = true;
    try {
      const u = await api('/auth/perfil', { method: 'PUT', body: { nombre, empresa, telefono } });
      sesion.update((s) => ({ ...s, usuario: u }));
      toast('Perfil actualizado');
    } catch (e) {
      error = e.message;
    } finally {
      guardando = false;
    }
  }

  async function cambiarClave() {
    errorClave = '';
    if (nueva.length < 6) return (errorClave = 'La nueva contraseña debe tener al menos 6 caracteres.');
    if (nueva !== confirmar) return (errorClave = 'Las contraseñas nuevas no coinciden.');
    cambiando = true;
    try {
      await api('/auth/password', { method: 'PUT', body: { actual, nueva } });
      actual = nueva = confirmar = '';
      toast('Contraseña actualizada');
    } catch (e) {
      errorClave = e.message;
    } finally {
      cambiando = false;
    }
  }
</script>

{#if !$usuario}
  <div class="container detail-wrap">
    <div class="empty-state card">
      <Icono nombre="user" tam={28} />
      <h3>Inicia sesión para ver tu perfil</h3>
      <a class="btn btn-dark" href="#/acceso">Iniciar sesión</a>
    </div>
  </div>
{:else}
  <section class="page-head">
    <div class="container page-head-inner">
      <div class="perfil-head">
        <span class="avatar avatar-xl">{iniciales($usuario.nombre)}</span>
        <div>
          <p class="eyebrow">Mi perfil</p>
          <h1>{$usuario.nombre}</h1>
          <p class="page-sub">
            {ROLES[$usuario.rol]}
            {#if $usuario.verificado}· <span class="verif"><Icono nombre="shield" tam={12} /> Verificado</span>{/if}
            {#if $usuario.created_at}· Miembro desde {formatoFecha($usuario.created_at)}{/if}
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="container dash perfil-grid">
    <form class="card card-pad stack" on:submit|preventDefault={guardar} in:fly={{ y: 10, duration: 250 }}>
      <div class="card-head"><h3><Icono nombre="user" tam={17} /> Datos personales</h3></div>
      <label class="field">
        <span class="label">Nombre completo</span>
        <input class="input" type="text" bind:value={nombre} autocomplete="name" />
      </label>
      {#if $usuario.rol !== 'cliente'}
        <label class="field">
          <span class="label">Empresa / nombre comercial</span>
          <input class="input" type="text" bind:value={empresa} />
        </label>
      {/if}
      <label class="field">
        <span class="label">Teléfono / WhatsApp</span>
        <input class="input" type="tel" bind:value={telefono} placeholder="9991234567" autocomplete="tel" />
        <span class="muted small">Se usa para llenar tus solicitudes y para que te contacten cuando acepten una renta.</span>
      </label>
      <label class="field">
        <span class="label">Correo</span>
        <input class="input" type="email" value={$usuario.email} disabled />
      </label>
      {#if error}<p class="form-error">{error}</p>{/if}
      <button class="btn btn-primary" type="submit" disabled={guardando}>
        {#if guardando}<span class="spinner"></span>{/if} Guardar cambios
      </button>
    </form>

    <form class="card card-pad stack" on:submit|preventDefault={cambiarClave} in:fly={{ y: 10, duration: 250, delay: 60 }}>
      <div class="card-head"><h3><Icono nombre="lock" tam={17} /> Cambiar contraseña</h3></div>
      <label class="field">
        <span class="label">Contraseña actual</span>
        <input class="input" type="password" bind:value={actual} autocomplete="current-password" />
      </label>
      <label class="field">
        <span class="label">Nueva contraseña</span>
        <input class="input" type="password" bind:value={nueva} placeholder="Mínimo 6 caracteres" autocomplete="new-password" />
      </label>
      <label class="field">
        <span class="label">Repite la nueva contraseña</span>
        <input class="input" type="password" bind:value={confirmar} autocomplete="new-password" />
      </label>
      {#if errorClave}<p class="form-error">{errorClave}</p>{/if}
      <button class="btn btn-dark" type="submit" disabled={cambiando || !actual || !nueva}>
        {#if cambiando}<span class="spinner"></span>{/if} Actualizar contraseña
      </button>
    </form>
  </section>
{/if}

<style>
  .perfil-head { display: flex; align-items: center; gap: 18px; }
  .perfil-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px; align-items: start; }
  .card-head h3 { display: flex; align-items: center; gap: 8px; }
  @media (max-width: 900px) { .perfil-grid { grid-template-columns: 1fr; } }
</style>
