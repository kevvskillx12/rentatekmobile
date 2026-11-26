<script>
  import { fly } from 'svelte/transition';
  import { api } from '../lib/api.js';
  import { usuario } from '../lib/sesion.js';
  import { favoritos, alternarFavorito } from '../lib/favoritos.js';
  import {
    normalizar, formatoDinero, formatoFecha, formatoRango, diasEntre, ESTADOS_MAQUINA, iniciales
  } from '../lib/datos.js';
  import { toast } from '../lib/ui.js';
  import Modal from '../lib/Modal.svelte';
  import Tarjeta from '../lib/Tarjeta.svelte';
  import Icono from '../lib/Icono.svelte';
  import Estrellas from '../lib/Estrellas.svelte';
  import Calendario from '../lib/Calendario.svelte';

  export let id;

  let maquina = null;
  let crudo = null;
  let cargando = true;
  let errorCarga = '';
  let ocupadas = [];
  let resenas = [];
  let relacionadas = [];

  let modal = false;
  let nombre = $usuario?.nombre || '';
  let telefono = $usuario?.telefono || '';
  let inicio = '';
  let fin = '';
  let mensaje = '';
  let error = '';
  let enviando = false;

  async function cargar() {
    cargando = true;
    errorCarga = '';
    try {
      crudo = await api(`/maquinaria/${encodeURIComponent(id)}`);
      maquina = normalizar(crudo);
      const [o, r, rel] = await Promise.all([
        api(`/maquinaria/${maquina.id}/ocupadas`),
        api(`/maquinaria/${maquina.id}/resenas`),
        api(`/maquinaria?categoria=${encodeURIComponent(maquina.categoria)}&excluir=${maquina.id}&orden=destacadas&limite=3`)
      ]);
      ocupadas = o;
      resenas = r;
      relacionadas = rel.items.map(normalizar);
    } catch (e) {
      maquina = null;
      errorCarga = e.message;
    } finally {
      cargando = false;
    }
  }

  $: id, cargar();
  $: dias = inicio && fin ? diasEntre(inicio, fin) : inicio ? 1 : 0;
  $: total = maquina ? maquina.precio * dias : 0;
  $: specs = maquina ? Object.entries(maquina.specsObj) : [];
  $: fav = maquina && $favoritos.has(maquina.id);
  $: distribucion = [5, 4, 3, 2, 1].map((n) => ({ n, c: resenas.filter((r) => r.calificacion === n).length }));

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
    if (!inicio) {
      error = 'Elige en el calendario el día de inicio (y de fin si es más de un día).';
      return;
    }
    enviando = true;
    try {
      await api('/cliente/solicitudes', {
        method: 'POST',
        body: { maquina_id: maquina.id, nombre_contacto: nombre, telefono, fecha_inicio: inicio, fecha_fin: fin || inicio, mensaje }
      });
      modal = false;
      mensaje = '';
      inicio = fin = '';
      toast('Solicitud enviada. Te avisaremos cuando el proveedor responda.');
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
      <span>/</span><a href={`#/catalogo///${encodeURIComponent(maquina.categoria)}`}>{maquina.categoria}</a>
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

        <div class="card detail-section">
          <h3>Disponibilidad</h3>
          {#if ocupadas.length}
            <p class="muted small">Fechas ya rentadas (no se pueden solicitar):</p>
            <ul class="ocupadas">
              {#each ocupadas as o}<li><Icono nombre="calendar" tam={14} /> {formatoRango(o.inicio, o.fin)}</li>{/each}
            </ul>
          {:else}
            <p class="muted">Sin rentas programadas: puedes solicitar cualquier fecha a partir de hoy.</p>
          {/if}
        </div>

        <div class="card detail-section" id="resenas">
          <h3>Reseñas</h3>
          {#if resenas.length === 0}
            <p class="muted">Este equipo aún no tiene reseñas. Las dejan los clientes que ya lo rentaron.</p>
          {:else}
            <div class="res-resumen">
              <div class="res-nota">
                <strong>{maquina.promedio?.toFixed(1)}</strong>
                <Estrellas valor={maquina.promedio} tam={18} />
                <span class="muted small">{resenas.length} reseña{resenas.length === 1 ? '' : 's'}</span>
              </div>
              <ul class="res-barras">
                {#each distribucion as d}
                  <li>
                    <span>{d.n} ★</span>
                    <span class="rb"><i style="width: {(d.c / resenas.length) * 100}%"></i></span>
                    <span class="muted">{d.c}</span>
                  </li>
                {/each}
              </ul>
            </div>
            <ul class="res-lista">
              {#each resenas as r (r.id)}
                <li>
                  <span class="avatar">{iniciales(r.cliente_nombre)}</span>
                  <div>
                    <div class="res-top">
                      <strong>{r.cliente_nombre.split(' ').slice(0, 2).join(' ')}</strong>
                      <span class="muted small">{formatoFecha(r.created_at)}</span>
                    </div>
                    <Estrellas valor={r.calificacion} tam={14} />
                    {#if r.comentario}<p>{r.comentario}</p>{/if}
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>

      <aside class="detail-side" in:fly={{ x: 20, duration: 400, delay: 100 }}>
        <div class="card summary">
          <div class="summary-top">
            <p class="eyebrow">{maquina.categoria}</p>
            <div class="summary-acciones">
              <span class="badge estado-{maquina.estado}">{ESTADOS_MAQUINA[maquina.estado]}</span>
              <button class="icon-btn fav-inline" class:on={fav} on:click={() => alternarFavorito(maquina.id)}
                aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'} aria-pressed={fav}>
                <Icono nombre="heart" tam={20} relleno={fav} />
              </button>
            </div>
          </div>
          <h1>{maquina.nombre}</h1>
          <p class="meta"><Icono nombre="pin" tam={15} /> {maquina.ubicacion}</p>
          {#if maquina.resenas}
            <a class="rating-link" href="#/maquina/{maquina.id}" on:click|preventDefault={() => document.getElementById('resenas')?.scrollIntoView({ behavior: 'smooth' })}>
              <Estrellas valor={maquina.promedio} tam={15} /> <b>{maquina.promedio.toFixed(1)}</b> · {maquina.resenas} reseña{maquina.resenas === 1 ? '' : 's'}
            </a>
          {/if}

          <div class="summary-price">
            <strong>{formatoDinero(maquina.precio)}</strong><span>/ día</span>
          </div>

          <div class="provider-card">
            <div class="provider-row">
              <span class="avatar avatar-lg">{maquina.proveedor.slice(0, 1).toUpperCase()}</span>
              <div>
                <span class="muted small">Proveedor</span>
                <strong>{maquina.proveedor}</strong>
              </div>
              {#if maquina.verificado}
                <span class="verif verif-lg" title="Identidad y documentos revisados por Rentatek"><Icono nombre="shield" tam={14} /> Verificado</span>
              {/if}
            </div>
            <ul class="provider-stats">
              <li><b>{crudo.proveedor_promedio ? `${crudo.proveedor_promedio} ★` : '—'}</b><span>{crudo.proveedor_resenas} reseñas</span></li>
              <li><b>{crudo.proveedor_rentas}</b><span>rentas</span></li>
              <li><b>{new Date(crudo.proveedor_desde).getFullYear()}</b><span>en Rentatek</span></li>
            </ul>
          </div>

          {#if maquina.estado === 'rentada'}
            <div class="notice"><Icono nombre="clock" tam={16} /> Está rentado en este momento, pero puedes solicitarlo para fechas libres.</div>
          {/if}
          {#if !$usuario}
            <a class="btn btn-primary btn-lg btn-block" href="#/acceso">Inicia sesión para rentar</a>
          {:else if $usuario.rol !== 'cliente'}
            <div class="notice"><Icono nombre="alert" tam={16} /> Las solicitudes se envían desde una cuenta de cliente.</div>
          {:else}
            <button class="btn btn-primary btn-lg btn-block" on:click={abrir}><Icono nombre="calendar" tam={17} /> Elegir fechas y solicitar</button>
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

  <Modal open={modal} ancho="lg" titulo="Solicitar renta" subtitulo={maquina.nombre} on:close={() => (modal = false)}>
    <form class="form-grid" on:submit|preventDefault={solicitar} id="form-solicitud">
      <div class="field span-2">
        <span class="label">Fechas de renta <em>toca el día de inicio y luego el de fin</em></span>
        <Calendario {ocupadas} bind:inicio bind:fin />
      </div>
      <label class="field">
        <span class="label">Nombre de contacto</span>
        <input class="input" type="text" bind:value={nombre} />
      </label>
      <label class="field">
        <span class="label">Teléfono / WhatsApp</span>
        <input class="input" type="tel" bind:value={telefono} placeholder="9991234567" />
      </label>
      <div class="field span-2 total-box total-row">
        <div>
          <span class="label">Periodo</span>
          <span>{inicio ? formatoRango(inicio, fin || inicio) : 'Elige las fechas en el calendario'}</span>
        </div>
        <div class="total-der">
          <span class="label">Total estimado</span>
          <strong>{formatoDinero(total)}</strong>
          <span class="muted small">{dias} día(s) × {formatoDinero(maquina.precio)}</span>
        </div>
      </div>
      <label class="field span-2">
        <span class="label">Mensaje (opcional)</span>
        <textarea class="input" rows="3" bind:value={mensaje} placeholder="Lugar de la obra, horario de entrega, dudas…"></textarea>
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

<style>
  .ocupadas { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .ocupadas li { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 8px; background: var(--bad-soft); color: var(--bad); font-size: 13px; font-weight: 600; }
  .res-resumen { display: grid; grid-template-columns: auto 1fr; gap: 28px; align-items: center; padding-bottom: 18px; border-bottom: 1px solid var(--line-2); }
  .res-nota { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .res-nota strong { font-size: 40px; font-weight: 800; color: var(--ink); line-height: 1; }
  .res-barras { display: flex; flex-direction: column; gap: 5px; }
  .res-barras li { display: grid; grid-template-columns: 34px 1fr 24px; align-items: center; gap: 8px; font-size: 13px; }
  .rb { height: 8px; border-radius: 999px; background: var(--line-2); overflow: hidden; }
  .rb i { display: block; height: 100%; background: var(--star); border-radius: 999px; }
  .res-lista { display: flex; flex-direction: column; }
  .res-lista li { display: flex; gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--line-2); }
  .res-lista li > div { flex: 1; min-width: 0; }
  .res-lista li:last-child { border-bottom: 0; padding-bottom: 0; }
  .res-lista p { margin-top: 4px; font-size: 14px; color: var(--text); }
  .res-top { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .res-top strong { font-size: 14px; color: var(--ink); }
  .summary-acciones { display: flex; align-items: center; gap: 4px; }
  .rating-link { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--muted); text-decoration: none; }
  .rating-link b { color: var(--ink); }
  .provider-card { display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: 12px; background: var(--bg); border: 1px solid var(--line-2); }
  .provider-row .verif-lg { margin-left: auto; }
  .provider-stats { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; }
  .provider-stats li { display: flex; flex-direction: column; }
  .provider-stats li + li { border-left: 1px solid var(--line); }
  .provider-stats b { color: var(--ink); font-size: 15px; }
  .provider-stats span { font-size: 12px; color: var(--muted); }
  .total-row { flex-direction: row; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
  .total-row > div { display: flex; flex-direction: column; gap: 2px; }
  .total-der { text-align: right; align-items: flex-end; }
  @media (max-width: 600px) { .res-resumen { grid-template-columns: 1fr; gap: 14px; } }
</style>
