<script>
  import { sesion } from '../lib/sesion.js';
  import { api } from '../lib/api.js';
  import { toast } from '../lib/ui.js';
  import Icono from '../lib/Icono.svelte';

  export let token = '';

  let clave = '';
  let confirmar = '';
  let error = '';
  let enviando = false;

  async function enviar() {
    error = '';
    if (clave.length < 6) return (error = 'La contraseña debe tener al menos 6 caracteres.');
    if (clave !== confirmar) return (error = 'Las contraseñas no coinciden.');
    enviando = true;
    try {
      const datos = await api('/auth/restablecer', { method: 'POST', body: { token, password: clave } });
      sesion.set(datos);
      toast('Contraseña actualizada. ¡Bienvenido de nuevo!');
      window.location.hash = datos.usuario.rol === 'proveedor' ? '#/panel' : datos.usuario.rol === 'admin' ? '#/admin' : '#/mis-rentas';
    } catch (e) {
      error = e.message;
    } finally {
      enviando = false;
    }
  }
</script>

<section class="container auth-wrap">
  <div class="card restablecer">
    <span class="step-ico"><Icono nombre="lock" tam={22} /></span>
    <h1>Crea una nueva contraseña</h1>
    <p class="muted">Elige una contraseña que no uses en otros sitios.</p>
    {#if !token}
      <p class="form-error">El enlace no es válido. Pide uno nuevo desde "¿Olvidaste tu contraseña?".</p>
      <a class="btn btn-dark" href="#/acceso">Ir a iniciar sesión</a>
    {:else}
      <form class="stack" on:submit|preventDefault={enviar}>
        <label class="field">
          <span class="label">Nueva contraseña</span>
          <input class="input" type="password" bind:value={clave} placeholder="Mínimo 6 caracteres" autocomplete="new-password" />
        </label>
        <label class="field">
          <span class="label">Repite la contraseña</span>
          <input class="input" type="password" bind:value={confirmar} autocomplete="new-password" />
        </label>
        {#if error}<p class="form-error">{error}</p>{/if}
        <button class="btn btn-primary btn-lg btn-block" type="submit" disabled={enviando}>
          {#if enviando}<span class="spinner"></span>{/if} Guardar y entrar
        </button>
      </form>
    {/if}
  </div>
</section>

<style>
  .restablecer { max-width: 460px; margin-inline: auto; padding: 36px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--sh-lg); }
  .restablecer h1 { font-size: 24px; }
</style>
