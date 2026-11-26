<script>
  import { usuario } from '../lib/sesion.js';
  import { api } from '../lib/api.js';
  import Icono from '../lib/Icono.svelte';

  let nombre = $usuario?.nombre || '';
  let email = $usuario?.email || '';
  let asunto = '';
  let mensaje = '';
  let error = '';
  let enviando = false;
  let enviado = false;

  const ASUNTOS = ['Duda sobre una renta', 'Quiero verificar mi cuenta de proveedor', 'Reportar un problema', 'Facturación', 'Otro'];

  async function enviar() {
    error = '';
    if (!nombre.trim() || !email.trim() || !mensaje.trim()) return (error = 'Completa nombre, correo y mensaje.');
    enviando = true;
    try {
      await api('/contacto', { method: 'POST', body: { nombre, email, asunto, mensaje } });
      enviado = true;
    } catch (e) {
      error = e.message;
    } finally {
      enviando = false;
    }
  }
</script>

<section class="page-head">
  <div class="container page-head-inner">
    <div>
      <p class="eyebrow">Contacto</p>
      <h1>¿En qué te ayudamos?</h1>
      <p class="page-sub">Respondemos en menos de 24 horas hábiles.</p>
    </div>
  </div>
</section>

<section class="container dash contacto-grid">
  <div class="card card-pad">
    {#if enviado}
      <div class="empty-state">
        <Icono nombre="check" tam={30} />
        <h3>¡Mensaje enviado!</h3>
        <p>Gracias, {nombre.split(' ')[0]}. Te responderemos a {email}.</p>
        <a class="btn btn-ghost" href="#/">Volver al inicio</a>
      </div>
    {:else}
      <form class="form-grid" on:submit|preventDefault={enviar}>
        <label class="field">
          <span class="label">Nombre</span>
          <input class="input" type="text" bind:value={nombre} autocomplete="name" />
        </label>
        <label class="field">
          <span class="label">Correo</span>
          <input class="input" type="email" bind:value={email} autocomplete="email" />
        </label>
        <label class="field span-2">
          <span class="label">Asunto</span>
          <select class="input" bind:value={asunto}>
            <option value="">Elige un tema</option>
            {#each ASUNTOS as a}<option>{a}</option>{/each}
          </select>
        </label>
        <label class="field span-2">
          <span class="label">Mensaje</span>
          <textarea class="input" rows="6" bind:value={mensaje} maxlength="4000" placeholder="Cuéntanos con detalle; si es sobre una renta, incluye el nombre del equipo y las fechas."></textarea>
        </label>
        {#if error}<p class="form-error span-2">{error}</p>{/if}
        <div class="span-2">
          <button class="btn btn-primary" type="submit" disabled={enviando}>
            {#if enviando}<span class="spinner"></span>{:else}<Icono nombre="send" tam={16} />{/if} Enviar mensaje
          </button>
        </div>
      </form>
    {/if}
  </div>

  <aside class="side-stack">
    <div class="card card-pad info-contacto">
      <h3>Otros medios</h3>
      <p><Icono nombre="mail" tam={16} /> soporte@rentatek.mx</p>
      <p><Icono nombre="phone" tam={16} /> 999 123 4567</p>
      <p><Icono nombre="clock" tam={16} /> Lunes a viernes, 9:00 a 18:00</p>
    </div>
    <div class="card card-pad">
      <h3>¿Tienes una duda rápida?</h3>
      <p class="muted small">Revisa primero las preguntas frecuentes; ahí está la respuesta a lo más común.</p>
      <a class="link-arrow" href="#/ayuda">Ver preguntas frecuentes <Icono nombre="arrowRight" tam={15} /></a>
    </div>
  </aside>
</section>

<style>
  .contacto-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(260px, 1fr); gap: 20px; align-items: start; }
  .side-stack h3 { font-size: 16px; margin-bottom: 10px; }
  .info-contacto p { display: flex; align-items: center; gap: 10px; padding: 6px 0; color: var(--text); font-size: 14px; }
  .info-contacto :global(.icono) { color: var(--brand-ink); }
  @media (max-width: 900px) { .contacto-grid { grid-template-columns: 1fr; } .contacto-grid .side-stack { grid-template-columns: 1fr; } }
</style>
