<script>
  import { fly } from 'svelte/transition';
  import { api } from '../lib/api.js';
  import { usuario } from '../lib/sesion.js';
  import { todos } from '../lib/equipos.js';
  import { normalizar, formatoDinero, ESTADOS_MAQUINA } from '../lib/datos.js';
  import { toast } from '../lib/ui.js';
  import Modal from '../lib/Modal.svelte';
  import Tarjeta from '../lib/Tarjeta.svelte';
  import Icono from '../lib/Icono.svelte';

  export let id;

  let maquina = null;
  let cargando = true;
  let errorCarga = '';

  let modal = false;
  let nombre = $usuario?.nombre || '';
  let telefono = '';
  let dias = 1;
  let mensaje = '';
  let error = '';
  let enviando = false;

  async function cargar() {
    cargando = true;
    errorCarga = '';
    try {
      maquina = normalizar(await api(`/maquinaria/${encodeURIComponent(id)}`));
    } catch (e) {
      maquina = null;
      errorCarga = e.message;
    } finally {
      cargando = false;
    }
  }

  $: id, cargar();
  $: total = maquina ? maquina.precio * (Number(dias) || 0) : 0;
  $: specs = maquina ? Object.entries(maquina.specsObj) : [];
  $: relacionadas = maquina
    ? $todos.filter((m) => m.id !== maquina.id && m.categoria === maquina.categoria).slice(0, 3)
    : [];

  function abrir() {
    error = '';
    modal = true;
  }

  async function solicitar() {
    error = '';
    if (!nombre.trim() || !telefono.trim()) {
      error = 'Escribe tu nombre y teléfono.';
      return;
    }
    if (!(Number(dias) >= 1)) {
      error = 'Indica al menos 1 día.';
      return;
    }
    enviando = true;
    try {
      await api('/cliente/solicitudes', {
        method: 'POST',
        body: { maquina_id: maquina.id, nombre_contacto: nombre, telefono, dias: Number(dias), mensaje }
      });
      modal = false;
      mensaje = '';
      toast('Solicitud enviada. El proveedor la verá en su panel.');
    } catch (e) {
      error = e.message;
    } finally {
      enviando = false;
    }
  }
</script>

{#if cargando}
  <div class="container detail-wrap">
    <div class="detail-grid">
      <div class="skeleton" style="height: 440px"></div>
      <div class="skeleton" style="height: 360px"></div>
    </div>
  </div>
{:else if maquina}
  <div class="container detail-wrap">
    <nav class="breadcrumb">
      <a href="#/catalogo"><Icono nombre="arrowLeft" tam={15} /> Catálogo</a>
      <span>/</span><span>{maquina.categoria}</span>
    </nav>

    <div class="detail-grid">
      <div class="detail-main">
        <div class="detail-img">
          <img src={maquina.imagen} alt={maquina.nombre} />
        </div>

        <div class="card detail-section">
          <h3>Descripción</h3>
          <p class="detail-desc">{maquina.descripcion || 'El proveedor no agregó una descripción.'}</p>
        </div>

        {#if specs.length}
          <div class="card detail-section">
            <h3>Especificaciones</h3>
            <dl class="spec-table">
              {#each specs as [k, v]}
                <div><dt>{k}</dt>{#if v}<dd>{v}</dd>{/if}</div>
              {/each}
            </dl>
          </div>
        {/if}
      </div>

      <aside class="detail-side" in:fly={{ x: 20, duration: 400, delay: 100 }}>
        <div class="card summary">
          <div class="summary-top">
            <p class="eyebrow">{maquina.categoria}</p>
            <span class="badge estado-{maquina.estado}">{ESTADOS_MAQUINA[maquina.estado]}</span>
          </div>
          <h1>{maquina.nombre}</h1>
          <p class="meta"><Icono nombre="pin" tam={15} /> {maquina.ubicacion}</p>

          <div class="summary-price">
            <strong>{formatoDinero(maquina.precio)}</strong><span>/ día</span>
          </div>

          <div class="provider-row">
            <span class="avatar avatar-lg">{maquina.proveedor.slice(0, 1).toUpperCase()}</span>
            <div>
              <span class="muted small">Proveedor</span>
              <strong>{maquina.proveedor}</strong>
            </div>
          </div>

          {#if maquina.estado === 'rentada'}
            <div class="notice"><Icono nombre="clock" tam={16} /> Este equipo está rentado en este momento.</div>
          {:else if !$usuario}
            <a class="btn btn-primary btn-lg btn-block" href="#/acceso">Inicia sesión para rentar</a>
          {:else if $usuario.rol !== 'cliente'}
            <div class="notice"><Icono nombre="alert" tam={16} /> Las solicitudes se envían desde una cuenta de cliente.</div>
          {:else}
            <button class="btn btn-primary btn-lg btn-block" on:click={abrir}>Solicitar renta</button>
            <p class="muted small center">No se cobra nada al enviar la solicitud.</p>
          {/if}
        </div>
      </aside>
    </div>

    {#if relacionadas.length}
      <section class="related">
        <div class="section-head"><h2>Más en {maquina.categoria}</h2></div>
        <div class="grid-cards">
          {#each relacionadas as m (m.id)}<Tarjeta maquina={m} />{/each}
        </div>
      </section>
    {/if}
  </div>

  <Modal open={modal} titulo="Solicitar renta" subtitulo={maquina.nombre} on:close={() => (modal = false)}>
    <form class="form-grid" on:submit|preventDefault={solicitar} id="form-solicitud">
      <label class="field">
        <span class="label">Nombre de contacto</span>
        <input class="input" type="text" bind:value={nombre} />
      </label>
      <label class="field">
        <span class="label">Teléfono / WhatsApp</span>
        <input class="input" type="tel" bind:value={telefono} placeholder="9991234567" />
      </label>
      <label class="field">
        <span class="label">Días de renta</span>
        <div class="stepper">
          <button type="button" on:click={() => (dias = Math.max(1, Number(dias) - 1))} aria-label="Menos">−</button>
          <input class="input" type="number" min="1" max="365" bind:value={dias} />
          <button type="button" on:click={() => (dias = Math.min(365, Number(dias) + 1))} aria-label="Más">+</button>
        </div>
      </label>
      <div class="field total-box">
        <span class="label">Total estimado</span>
        <strong>{formatoDinero(total)}</strong>
        <span class="muted small">{dias || 0} día(s) × {formatoDinero(maquina.precio)}</span>
      </div>
      <label class="field span-2">
        <span class="label">Mensaje (opcional)</span>
        <textarea class="input" rows="3" bind:value={mensaje} placeholder="Fechas, lugar de la obra, dudas…"></textarea>
      </label>
      {#if error}<p class="form-error span-2" in:fly={{ y: -4 }}>{error}</p>{/if}
    </form>
    <svelte:fragment slot="pie">
      <button class="btn btn-ghost" on:click={() => (modal = false)}>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="form-solicitud" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </svelte:fragment>
  </Modal>
{:else}
  <div class="container detail-wrap">
    <div class="empty-state card">
      <Icono nombre="alert" tam={28} />
      <h3>No encontramos esa maquinaria</h3>
      <p>{errorCarga}</p>
      <a class="btn btn-dark" href="#/catalogo">Volver al catálogo</a>
    </div>
  </div>
{/if}
