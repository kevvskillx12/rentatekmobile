<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { usuario } from '../lib/sesion.js';
  import { api } from '../lib/api.js';
  import { todos } from '../lib/equipos.js';
  import { toast, confirmar } from '../lib/ui.js';
  import Modal from '../lib/Modal.svelte';
  import Icono from '../lib/Icono.svelte';
  import { formatoPrecio, formatoDinero, formatoFecha, ESTADOS_SOLICITUD } from '../lib/datos.js';

  let solicitudes = [];
  let cargando = true;
  let actualizando = false;
  let errorCarga = '';
  let filtro = 'todas';
  let detalle = null;

  async function cargar() {
    errorCarga = '';
    actualizando = true;
    try {
      solicitudes = await api('/cliente/solicitudes');
    } catch (e) {
      errorCarga = e.message;
    } finally {
      cargando = false;
      actualizando = false;
    }
  }

  onMount(() => {
    if ($usuario?.rol !== 'cliente') return;
    cargar();
    const alVolver = () => document.visibilityState === 'visible' && cargar();
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  });

  $: cuenta = (estado) => solicitudes.filter((s) => s.estado === estado).length;
  $: gasto = solicitudes
    .filter((s) => s.estado === 'aceptada')
    .reduce((t, s) => t + Number(s.precio_dia) * s.dias, 0);
  $: filtradas = filtro === 'todas' ? solicitudes : solicitudes.filter((s) => s.estado === filtro);
  $: kpis = [
    { i: 'inbox', t: 'Solicitudes enviadas', v: solicitudes.length },
    { i: 'clock', t: 'En espera', v: cuenta('pendiente'), acento: true },
    { i: 'check', t: 'Aceptadas', v: cuenta('aceptada') },
    { i: 'dollar', t: 'Total en rentas aceptadas', v: formatoDinero(gasto) }
  ];
  $: sugeridas = $todos
    .filter((m) => m.estado === 'disponible' && !solicitudes.some((s) => s.maquina_id === m.id && s.estado === 'pendiente'))
    .slice(0, 4);

  function textoVacio(f) {
    return {
      pendiente: 'No hay solicitudes pendientes',
      aceptada: 'No hay solicitudes aceptadas',
      rechazada: 'No hay solicitudes rechazadas',
      cancelada: 'No hay solicitudes canceladas'
    }[f];
  }

  async function cancelar(s) {
    const ok = await confirmar({
      titulo: 'Cancelar solicitud',
      mensaje: `¿Cancelar tu solicitud de "${s.maquina_nombre}"? El proveedor ya no podrá aceptarla.`,
      accion: 'Cancelar solicitud',
      peligro: true
    });
    if (!ok) return;
    try {
      await api(`/cliente/solicitudes/${s.id}/cancelar`, { method: 'PATCH' });
      toast('Solicitud cancelada');
      detalle = null;
      await cargar();
    } catch (e) {
      toast(e.message, 'error');
    }
  }
</script>

{#if !$usuario}
  <div class="container detail-wrap">
    <div class="empty-state card">
      <Icono nombre="user" tam={28} />
      <h3>Inicia sesión para ver tus rentas</h3>
      <a class="btn btn-dark" href="#/acceso">Iniciar sesión</a>
    </div>
  </div>
{:else if $usuario.rol !== 'cliente'}
  <div class="container detail-wrap">
    <div class="empty-state card">
      <Icono nombre="search" tam={28} />
      <h3>Esta sección es para clientes</h3>
      <p>Tu panel de proveedor está en "Mi panel".</p>
      <a class="btn btn-dark" href="#/panel">Ir a mi panel</a>
    </div>
  </div>
{:else}
  <section class="page-head">
    <div class="container page-head-inner">
      <div>
        <p class="eyebrow">Mis rentas</p>
        <h1>Hola, {$usuario.nombre.split(' ')[0]}</h1>
        <p class="page-sub">Sigue el estado de tus solicitudes de renta.</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" on:click={cargar} disabled={actualizando}>
          <span class:girando={actualizando}><Icono nombre="refresh" tam={16} /></span> Actualizar
        </button>
        <a class="btn btn-primary" href="#/catalogo"><Icono nombre="search" tam={16} /> Buscar maquinaria</a>
      </div>
    </div>
  </section>

  <section class="container dash dash-top">
    {#if cargando}
      <div class="kpi-grid kpi-4">{#each Array(4) as _}<div class="skeleton" style="height: 104px"></div>{/each}</div>
      <div class="skeleton" style="height: 260px"></div>
    {:else if errorCarga}
      <div class="empty-state card">
        <Icono nombre="alert" tam={28} />
        <h3>No se pudieron cargar tus solicitudes</h3>
        <p>{errorCarga}</p>
        <button class="btn btn-dark" on:click={cargar}>Reintentar</button>
      </div>
    {:else}
      <div class="kpi-grid kpi-4">
        {#each kpis as k, i}
          <div class="kpi card" class:kpi-acento={k.acento} in:fly={{ y: 12, duration: 300, delay: i * 50 }}>
            <span class="kpi-ico"><Icono nombre={k.i} tam={18} /></span>
            <div>
              <span class="kpi-label">{k.t}</span>
              <strong class="kpi-valor">{k.v}</strong>
            </div>
          </div>
        {/each}
      </div>

      <div class="dash-cols">
        <div class="card card-pad">
          <div class="card-head"><h3>Mis solicitudes</h3></div>

          {#if solicitudes.length === 0}
            <div class="empty-mini col">
              <Icono nombre="inbox" tam={26} />
              <span>Aún no has enviado solicitudes.</span>
              <a class="btn btn-primary btn-sm" href="#/catalogo">Explorar catálogo</a>
            </div>
          {:else}
            <div class="chips">
              {#each ['todas', 'pendiente', 'aceptada', 'rechazada', 'cancelada'] as e}
                <button class:active={filtro === e} on:click={() => (filtro = e)}>
                  {e === 'todas' ? 'Todas' : ESTADOS_SOLICITUD[e]}
                  <span>{e === 'todas' ? solicitudes.length : cuenta(e)}</span>
                </button>
              {/each}
            </div>

            {#if filtradas.length === 0}
              <div class="empty-mini" in:fade><Icono nombre="inbox" tam={22} /> {textoVacio(filtro)}</div>
            {:else}
              <ul class="rows">
                {#each filtradas as s (s.id)}
                  <li class="row" animate:flip={{ duration: 250 }} in:fade={{ duration: 150 }}>
                    <button class="row-main" on:click={() => (detalle = s)}>
                      <span class="dot-lg sol-{s.estado}"></span>
                      <span>
                        <strong>{s.maquina_nombre}</strong>
                        <span class="muted small">
                          {s.proveedor_empresa || s.proveedor_nombre} · {s.dias} día(s) · {formatoDinero(s.precio_dia * s.dias)} · {formatoFecha(s.created_at)}
                        </span>
                      </span>
                    </button>
                    <span class="badge sol-{s.estado}">{ESTADOS_SOLICITUD[s.estado] || s.estado}</span>
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
        </div>

        {#if sugeridas.length}
          <div class="card card-pad">
            <div class="card-head">
              <h3>Disponibles ahora</h3>
              <a class="link-arrow" href="#/catalogo">Ver más <Icono nombre="arrowRight" tam={15} /></a>
            </div>
            <ul class="mini-list">
              {#each sugeridas as m (m.id)}
                <li>
                  <a href={`#/maquina/${m.id}`}>
                    <img src={m.imagen} alt={m.nombre} loading="lazy" />
                    <span>
                      <strong>{m.nombre}</strong>
                      <span class="muted small">{m.ubicacion} · {formatoPrecio(m.precio)}</span>
                    </span>
                    <Icono nombre="arrowRight" tam={16} />
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/if}
  </section>

  <Modal open={!!detalle} titulo="Mi solicitud" subtitulo={detalle?.maquina_nombre || ''} on:close={() => (detalle = null)}>
    {#if detalle}
      <div class="detalle-sol">
        <span class="badge sol-{detalle.estado}">{ESTADOS_SOLICITUD[detalle.estado] || detalle.estado}</span>
        <dl class="dl-grid">
          <div><dt>Proveedor</dt><dd>{detalle.proveedor_empresa || detalle.proveedor_nombre}</dd></div>
          <div><dt>Ubicación</dt><dd>{detalle.ciudad}</dd></div>
          <div><dt>Días</dt><dd>{detalle.dias} × {formatoPrecio(detalle.precio_dia)}</dd></div>
          <div><dt>Total estimado</dt><dd><strong>{formatoDinero(detalle.precio_dia * detalle.dias)}</strong></dd></div>
          <div><dt>Contacto</dt><dd>{detalle.nombre_contacto} · {detalle.telefono}</dd></div>
          <div><dt>Enviada</dt><dd>{formatoFecha(detalle.created_at)}</dd></div>
        </dl>
        {#if detalle.mensaje}<blockquote class="quote">{detalle.mensaje}</blockquote>{/if}
        {#if detalle.estado === 'aceptada'}
          <div class="notice notice-ok">
            <Icono nombre="check" tam={16} />
            <span>¡Aceptada! Contacta al proveedor en <a href={`mailto:${detalle.proveedor_email}`}>{detalle.proveedor_email}</a></span>
          </div>
        {/if}
      </div>
    {/if}
    <svelte:fragment slot="pie">
      {#if detalle}
        <a class="btn btn-ghost" href={`#/maquina/${detalle.maquina_id}`}>Ver equipo</a>
        {#if detalle.estado === 'pendiente'}
          <button class="btn btn-danger-ghost" on:click={() => cancelar(detalle)}>Cancelar solicitud</button>
        {/if}
      {/if}
    </svelte:fragment>
  </Modal>
{/if}
