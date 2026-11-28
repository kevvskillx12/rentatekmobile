<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { usuario } from '../lib/sesion.js';
  import { api } from '../lib/api.js';
  import { toast, confirmar } from '../lib/ui.js';
  import Modal from '../lib/Modal.svelte';
  import Icono from '../lib/Icono.svelte';
  import Chat from '../lib/Chat.svelte';
  import Estrellas from '../lib/Estrellas.svelte';
  import {
    normalizar, formatoPrecio, formatoDinero, formatoFecha, formatoRango, formatoDia, hoyISO, sumarDias, diasEntre, whatsapp, ESTADOS_SOLICITUD
  } from '../lib/datos.js';

  export let solicitudId = '';

  let solicitudes = [];
  let cargando = true;
  let actualizando = false;
  let errorCarga = '';
  let filtro = 'todas';
  let detalle = null;
  let vista = 'info'; // info | chat
  let sugeridas = [];
  let calif = 0;
  let comentario = '';
  let enviandoRes = false;
  let nuevaFin = ''; // pedir más días
  let enviandoExt = false;

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
    cargar().then(() => {
      const s = solicitudes.find((x) => String(x.id) === String(solicitudId));
      if (s) abrirDetalle(s);
    });
    api('/maquinaria?disponibles=1&orden=destacadas&limite=4').then((r) => (sugeridas = r.items.map(normalizar))).catch(() => {});
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
  // Al recargar la lista, refresca la solicitud abierta con los datos nuevos
  function refrescar(lista) {
    if (detalle) detalle = lista.find((s) => s.id === detalle.id) || detalle;
  }
  $: refrescar(solicitudes);
  $: puedeCalificar = detalle && detalle.estado === 'aceptada' && !detalle.resena_calificacion && detalle.fecha_inicio <= hoyISO();

  // Pedir más días: solo en rentas aceptadas que no han terminado
  $: puedeExtender = detalle && detalle.estado === 'aceptada' && detalle.fecha_fin && detalle.fecha_fin >= hoyISO() && detalle.ext_estado !== 'pendiente';
  $: minFin = detalle?.fecha_fin ? sumarDias(detalle.fecha_fin, 1) : '';
  $: diasExtra = nuevaFin && minFin && nuevaFin >= minFin ? diasEntre(minFin, nuevaFin) : 0;

  async function pedirMasDias() {
    if (!diasExtra) return toast('Elige una fecha posterior al ' + formatoDia(detalle.fecha_fin, true), 'error');
    enviandoExt = true;
    try {
      await api(`/cliente/solicitudes/${detalle.id}/extension`, { method: 'POST', body: { nueva_fin: nuevaFin } });
      toast('Petición enviada. Te avisaremos cuando el proveedor responda.');
      nuevaFin = '';
      await cargar();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      enviandoExt = false;
    }
  }

  async function cancelarExtension() {
    try {
      await api(`/cliente/extensiones/${detalle.ext_id}/cancelar`, { method: 'PATCH' });
      toast('Petición cancelada');
      await cargar();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function abrirDetalle(s, v = 'info') {
    detalle = s;
    vista = v;
    nuevaFin = '';
    calif = 0;
    comentario = '';
  }

  async function calificar() {
    if (!calif) return toast('Elige de 1 a 5 estrellas', 'error');
    enviandoRes = true;
    try {
      await api(`/cliente/solicitudes/${detalle.id}/resena`, { method: 'POST', body: { calificacion: calif, comentario } });
      toast('¡Gracias por tu reseña!');
      await cargar();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      enviandoRes = false;
    }
  }

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
                    <button class="row-main" on:click={() => abrirDetalle(s)}>
                      <span class="dot-lg sol-{s.estado}"></span>
                      <span>
                        <strong>{s.maquina_nombre}</strong>
                        <span class="muted small">
                          {s.proveedor_empresa || s.proveedor_nombre} · {formatoRango(s.fecha_inicio, s.fecha_fin)} · {formatoDinero(s.precio_dia * s.dias)}
                        </span>
                      </span>
                    </button>
                    {#if s.ext_estado === 'pendiente'}<span class="badge sol-pendiente">Pediste +{s.ext_dias} día(s)</span>{/if}
                    <button class="chat-btn" class:nuevo={s.no_leidos} on:click={() => abrirDetalle(s, 'chat')} title="Abrir el chat con el proveedor">
                      <Icono nombre="chat" tam={14} /> Chat{#if s.no_leidos} <span class="count">{s.no_leidos}</span>{/if}
                    </button>
                    {#if s.resena_calificacion}<Estrellas valor={s.resena_calificacion} tam={12} />{/if}
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

  <Modal open={!!detalle} ancho="lg" titulo="Mi solicitud" subtitulo={detalle?.maquina_nombre || ''} on:close={() => (detalle = null)}>
    {#if detalle}
      <div class="segmented seg-modal">
        <button class:active={vista === 'info'} on:click={() => (vista = 'info')}>Detalles</button>
        <button class:active={vista === 'chat'} on:click={() => (vista = 'chat')}>
          Mensajes {#if detalle.no_leidos}<span class="count">{detalle.no_leidos}</span>{/if}
        </button>
        <span class="segmented-bg" class:derecha={vista === 'chat'}></span>
      </div>

      {#if vista === 'chat'}
        <Chat solicitudId={detalle.id} otro={detalle.proveedor_empresa || detalle.proveedor_nombre} />
      {:else}
        <div class="detalle-sol">
          <span class="badge sol-{detalle.estado}">{ESTADOS_SOLICITUD[detalle.estado] || detalle.estado}</span>
          <dl class="dl-grid">
            <div><dt>Proveedor</dt><dd>{detalle.proveedor_empresa || detalle.proveedor_nombre}{#if detalle.proveedor_verificado} <span class="verif"><Icono nombre="shield" tam={12} /> Verificado</span>{/if}</dd></div>
            <div><dt>Ubicación</dt><dd>{detalle.ciudad}</dd></div>
            <div><dt>Fechas</dt><dd>{formatoRango(detalle.fecha_inicio, detalle.fecha_fin)}</dd></div>
            <div><dt>Días</dt><dd>{detalle.dias} × {formatoPrecio(detalle.precio_dia)}</dd></div>
            <div><dt>Total estimado</dt><dd><strong>{formatoDinero(detalle.precio_dia * detalle.dias)}</strong></dd></div>
            <div><dt>Enviada</dt><dd>{formatoFecha(detalle.created_at)}</dd></div>
            <div><dt>Tu contacto</dt><dd>{detalle.nombre_contacto} · {detalle.telefono}</dd></div>
          </dl>
          {#if detalle.mensaje}<blockquote class="quote">{detalle.mensaje}</blockquote>{/if}
          {#if detalle.estado === 'aceptada'}
            <div class="notice notice-ok">
              <Icono nombre="check" tam={16} />
              <span>¡Aceptada! Coordina la entrega por <button class="link-btn" on:click={() => (vista = 'chat')}>el chat</button>{#if detalle.proveedor_telefono}, por <a href={whatsapp(detalle.proveedor_telefono)} target="_blank" rel="noreferrer">WhatsApp</a>{/if} o en <a href={`mailto:${detalle.proveedor_email}`}>{detalle.proveedor_email}</a>.</span>
            </div>
          {/if}

          {#if detalle.ext_estado === 'pendiente'}
            <div class="notice notice-warn ext-aviso">
              <Icono nombre="clock" tam={16} />
              <span>Pediste extender hasta el <strong>{formatoDia(detalle.ext_nueva_fin, true)}</strong> (+{detalle.ext_dias} día(s), {formatoDinero(detalle.precio_dia * detalle.ext_dias)} más). Esperando respuesta del proveedor.</span>
              <button class="btn btn-sm btn-ghost" on:click={cancelarExtension}>Cancelar petición</button>
            </div>
          {:else if detalle.ext_estado === 'rechazada' && detalle.estado === 'aceptada'}
            <div class="notice"><Icono nombre="alert" tam={16} /> El proveedor no aceptó extender hasta el {formatoDia(detalle.ext_nueva_fin, true)}. Puedes platicarlo por <button class="link-btn" on:click={() => (vista = 'chat')}>el chat</button>.</div>
          {/if}

          {#if puedeExtender}
            <form class="ext-form" on:submit|preventDefault={pedirMasDias}>
              <span class="label">¿Necesitas más días?</span>
              <p class="muted small">Tu renta termina el {formatoDia(detalle.fecha_fin, true)}. Elige hasta qué día la quieres y el proveedor te confirma.</p>
              <div class="ext-fila">
                <input class="input" type="date" min={minFin} max={sumarDias(detalle.fecha_fin, 365)} bind:value={nuevaFin} aria-label="Nueva fecha de fin" />
                <button class="btn btn-primary" type="submit" disabled={enviandoExt || !diasExtra}>
                  {#if enviandoExt}<span class="spinner"></span>{/if} Pedir más días
                </button>
              </div>
              {#if diasExtra}<p class="small">+{diasExtra} día(s) × {formatoDinero(detalle.precio_dia)} = <strong>{formatoDinero(detalle.precio_dia * diasExtra)}</strong> más</p>{/if}
            </form>
          {/if}

          {#if detalle.resena_calificacion}
            <div class="mi-resena">
              <span class="label">Tu reseña</span>
              <Estrellas valor={detalle.resena_calificacion} tam={18} />
              {#if detalle.resena_comentario}<p>{detalle.resena_comentario}</p>{/if}
            </div>
          {:else if puedeCalificar}
            <form class="mi-resena" on:submit|preventDefault={calificar}>
              <span class="label">¿Cómo te fue con esta renta?</span>
              <Estrellas editable valor={calif} tam={28} on:change={(e) => (calif = e.detail)} />
              <textarea class="input" rows="2" bind:value={comentario} maxlength="1000" placeholder="Cuéntale a otros clientes cómo estuvo el equipo y el servicio (opcional)"></textarea>
              <button class="btn btn-primary btn-sm" type="submit" disabled={enviandoRes || !calif}>Publicar reseña</button>
            </form>
          {/if}
        </div>
      {/if}
    {/if}
    <svelte:fragment slot="pie">
      {#if detalle}
        <a class="btn btn-ghost" href={`#/maquina/${detalle.maquina_id}`}>Ver equipo</a>
        {#if vista !== 'chat'}<button class="btn btn-ghost" on:click={() => (vista = 'chat')}><Icono nombre="chat" tam={16} /> Abrir chat</button>{/if}
        {#if detalle.estado === 'pendiente'}
          <button class="btn btn-danger-ghost" on:click={() => cancelar(detalle)}>Cancelar solicitud</button>
        {/if}
      {/if}
    </svelte:fragment>
  </Modal>
{/if}
