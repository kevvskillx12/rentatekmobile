<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { usuario } from '../lib/sesion.js';
  import { api } from '../lib/api.js';
  import { recargar as recargarCatalogo, categorias } from '../lib/equipos.js';
  import { toast, confirmar } from '../lib/ui.js';
  import Modal from '../lib/Modal.svelte';
  import Icono from '../lib/Icono.svelte';
  import Chat from '../lib/Chat.svelte';
  import Estrellas from '../lib/Estrellas.svelte';
  import GraficaIngresos from '../lib/GraficaIngresos.svelte';
  import {
    normalizar, formatoPrecio, formatoDinero, formatoCompacto, formatoFecha, formatoRango, whatsapp,
    ESTADOS_MAQUINA, ESTADOS_SOLICITUD
  } from '../lib/datos.js';

  export let solicitudId = '';

  let pestana = 'resumen'; // resumen | solicitudes | equipos
  let resumen = null;
  let equipos = [];
  let solicitudes = [];
  let cargando = true;
  let actualizando = false;
  let errorCarga = '';
  let filtroSol = 'pendiente';

  // Modales
  let formAbierto = false;
  let detalle = null; // solicitud seleccionada
  let vista = 'info'; // info | chat (dentro del detalle)
  let ingresos = [];

  // Formulario de equipo
  let editandoId = null;
  let f = vacio();
  let error = '';
  let guardando = false;
  let foto = null; // archivo elegido para subir
  let fotoVista = ''; // vista previa (foto nueva o la actual)
  let quitarFoto = false;

  function vacio() {
    return { nombre: '', categoria: $categorias[0]?.nombre || '', ciudad: '', precio_dia: '', descripcion: '', specs: '', estado: 'disponible', destacado: false };
  }

  async function cargarTodo() {
    errorCarga = '';
    actualizando = true;
    try {
      const [r, e, s, g] = await Promise.all([
        api('/proveedor/resumen'),
        api('/proveedor/maquinaria'),
        api('/proveedor/solicitudes'),
        api('/proveedor/ingresos')
      ]);
      resumen = r;
      equipos = e.map(normalizar);
      solicitudes = s;
      ingresos = g;
      if (detalle) detalle = s.find((x) => x.id === detalle.id) || detalle;
    } catch (err) {
      errorCarga = err.message;
    } finally {
      cargando = false;
      actualizando = false;
    }
  }

  onMount(() => {
    if ($usuario?.rol !== 'proveedor') return;
    cargarTodo().then(() => {
      const s = solicitudes.find((x) => String(x.id) === String(solicitudId));
      if (s) abrirDetalle(s);
    });
    // Al volver a la pestaña del navegador se traen las solicitudes nuevas
    const alVolver = () => document.visibilityState === 'visible' && cargarTodo();
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  });

  $: pendientes = solicitudes.filter((s) => s.estado === 'pendiente');
  $: recientes = solicitudes.filter((s) => s.estado !== 'pendiente').slice(0, 5);
  $: solFiltradas = filtroSol === 'todas' ? solicitudes : solicitudes.filter((s) => s.estado === filtroSol);
  $: conteo = (e) => solicitudes.filter((s) => s.estado === e).length;
  $: m = resumen?.maquinaria;
  $: kpis = resumen
    ? [
        { i: 'box', t: 'Equipos publicados', v: m.total },
        { i: 'check', t: 'Disponibles', v: m.disponibles },
        { i: 'inbox', t: 'Solicitudes pendientes', v: resumen.solicitudes.pendientes, acento: true },
        { i: 'trend', t: 'Rentas aceptadas', v: resumen.solicitudes.aceptadas },
        { i: 'dollar', t: 'Ingresos estimados', v: formatoCompacto(resumen.solicitudes.ingresos) },
        { i: 'star', t: `Calificación (${resumen.resenas.total} reseñas)`, v: resumen.resenas.promedio ? `${resumen.resenas.promedio} ★` : '—' }
      ]
    : [];
  $: pct = (n) => (m && m.total ? (n / m.total) * 100 : 0);

  function textoFiltroVacio(f) {
    return {
      pendiente: 'No hay solicitudes pendientes',
      aceptada: 'No hay solicitudes aceptadas',
      rechazada: 'No hay solicitudes rechazadas',
      cancelada: 'No hay solicitudes canceladas',
      todas: 'Aún no has recibido solicitudes'
    }[f];
  }

  function abrirDetalle(s, v = 'info') {
    detalle = s;
    vista = v;
  }

  // ---------- Equipos ----------
  function specsATexto(obj) {
    return Object.entries(obj || {}).map(([k, v]) => (v ? `${k}: ${v}` : k)).join('\n');
  }

  function textoASpecs(texto) {
    const out = {};
    for (const linea of texto.split('\n')) {
      const l = linea.trim();
      if (!l) continue;
      const i = l.indexOf(':');
      if (i === -1) out[l] = '';
      else out[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    }
    return out;
  }

  function nuevo() {
    editandoId = null;
    f = vacio();
    error = '';
    limpiarFoto();
    formAbierto = true;
  }

  function editar(eq) {
    editandoId = eq.id;
    f = {
      nombre: eq.nombre,
      categoria: eq.categoria,
      ciudad: eq.ubicacion,
      precio_dia: eq.precio,
      descripcion: eq.descripcion,
      specs: specsATexto(eq.specsObj),
      estado: eq.estado,
      destacado: eq.destacado
    };
    error = '';
    limpiarFoto();
    fotoVista = eq.tieneFoto ? eq.imagen : '';
    formAbierto = true;
  }

  function limpiarFoto() {
    if (foto && fotoVista) URL.revokeObjectURL(fotoVista);
    foto = null;
    fotoVista = '';
    quitarFoto = false;
  }

  function elegirFoto(e) {
    const archivo = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!archivo) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      error = 'La foto debe ser JPG, PNG o WEBP.';
      return;
    }
    if (archivo.size > 4 * 1024 * 1024) {
      error = 'La foto no debe pasar de 4 MB.';
      return;
    }
    limpiarFoto();
    error = '';
    foto = archivo;
    fotoVista = URL.createObjectURL(archivo);
  }

  function borrarFoto() {
    limpiarFoto();
    quitarFoto = true;
  }

  async function guardar() {
    error = '';
    if (!f.nombre.trim() || !f.ciudad.trim() || !f.precio_dia) {
      error = 'Completa nombre, ciudad y precio.';
      return;
    }
    if (Number(f.precio_dia) <= 0) {
      error = 'El precio debe ser mayor a 0.';
      return;
    }
    guardando = true;
    const body = { ...f, precio_dia: Number(f.precio_dia), specs: textoASpecs(f.specs) };
    try {
      const nuevo = !editandoId;
      if (nuevo) editandoId = (await api("/proveedor/maquinaria", { method: "POST", body })).id; // si la foto falla, reintentar no duplica el equipo
      else await api(`/proveedor/maquinaria/${editandoId}`, { method: "PUT", body });
      if (foto) await api(`/proveedor/maquinaria/${editandoId}/foto`, { method: "PUT", body: foto });
      else if (quitarFoto) await api(`/proveedor/maquinaria/${editandoId}/foto`, { method: "DELETE" });
      if (nuevo) {
        toast("Equipo publicado. Ya aparece en el catálogo.");
        pestana = "equipos";
      } else toast("Cambios guardados");
      formAbierto = false;
      limpiarFoto();
      await Promise.all([cargarTodo(), recargarCatalogo()]);
    } catch (e) {
      error = e.message;
    } finally {
      guardando = false;
    }
  }

  async function cambiarEstado(eq, estado) {
    try {
      await api(`/proveedor/maquinaria/${eq.id}/estado`, { method: 'PATCH', body: { estado } });
      toast(`${eq.nombre}: ${ESTADOS_MAQUINA[estado]}`);
      await Promise.all([cargarTodo(), recargarCatalogo()]);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function eliminar(eq) {
    const ok = await confirmar({
      titulo: 'Eliminar equipo',
      mensaje: `¿Eliminar "${eq.nombre}"? También se borrarán sus solicitudes. Esta acción no se puede deshacer.`,
      accion: 'Eliminar',
      peligro: true
    });
    if (!ok) return;
    try {
      await api(`/proveedor/maquinaria/${eq.id}`, { method: 'DELETE' });
      toast('Equipo eliminado');
      await Promise.all([cargarTodo(), recargarCatalogo()]);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ---------- Solicitudes ----------
  async function responder(s, estado) {
    const ok = await confirmar(
      estado === 'aceptada'
        ? { titulo: 'Aceptar solicitud', mensaje: `Aceptarás la renta de "${s.maquina_nombre}" para ${s.nombre_contacto}. El equipo quedará como "Rentada".`, accion: 'Aceptar' }
        : { titulo: 'Rechazar solicitud', mensaje: `¿Rechazar la solicitud de ${s.nombre_contacto} para "${s.maquina_nombre}"?`, accion: 'Rechazar', peligro: true }
    );
    if (!ok) return;
    try {
      await api(`/proveedor/solicitudes/${s.id}`, { method: 'PATCH', body: { estado } });
      toast(estado === 'aceptada' ? 'Solicitud aceptada' : 'Solicitud rechazada');
      detalle = null;
      await Promise.all([cargarTodo(), recargarCatalogo()]);
    } catch (e) {
      toast(e.message, 'error');
    }
  }
</script>

{#if !$usuario}
  <div class="container detail-wrap">
    <div class="empty-state card">
      <Icono nombre="user" tam={28} />
      <h3>Inicia sesión para entrar a tu panel</h3>
      <a class="btn btn-dark" href="#/acceso">Iniciar sesión</a>
    </div>
  </div>
{:else if $usuario.rol !== 'proveedor'}
  <div class="container detail-wrap">
    <div class="empty-state card">
      <Icono nombre="briefcase" tam={28} />
      <h3>Esta sección es para proveedores</h3>
      <p>Tu panel de cliente está en "Mis rentas".</p>
      <a class="btn btn-dark" href="#/mis-rentas">Ir a mis rentas</a>
    </div>
  </div>
{:else}
  <section class="page-head">
    <div class="container page-head-inner">
      <div>
        <p class="eyebrow">Panel del proveedor</p>
        <h1>Hola, {$usuario.empresa || $usuario.nombre}</h1>
        <p class="page-sub">Gestiona tus equipos y responde las solicitudes de renta.</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" on:click={cargarTodo} disabled={actualizando}>
          <span class:girando={actualizando}><Icono nombre="refresh" tam={16} /></span> Actualizar
        </button>
        <button class="btn btn-primary" on:click={nuevo}><Icono nombre="plus" tam={16} /> Publicar equipo</button>
      </div>
    </div>
    <div class="container">
      <div class="tabs">
        <button class:active={pestana === 'resumen'} on:click={() => (pestana = 'resumen')}>Resumen</button>
        <button class:active={pestana === 'solicitudes'} on:click={() => (pestana = 'solicitudes')}>
          Solicitudes {#if pendientes.length}<span class="count">{pendientes.length}</span>{/if}
        </button>
        <button class:active={pestana === 'equipos'} on:click={() => (pestana = 'equipos')}>
          Mis equipos <span class="count count-muted">{equipos.length}</span>
        </button>
      </div>
    </div>
  </section>

  <section class="container dash">
    {#if !$usuario.verificado}
      <div class="notice notice-warn aviso-verif">
        <Icono nombre="shield" tam={16} />
        <span>Tu cuenta aún no está verificada. Los proveedores verificados muestran una insignia que da más confianza a los clientes.
          Envíanos tu RFC o identificación desde <a href="#/contacto">contacto</a> para verificarte.</span>
      </div>
    {/if}
    {#if cargando}
      <div class="kpi-grid">{#each Array(6) as _}<div class="skeleton" style="height: 104px"></div>{/each}</div>
      <div class="skeleton" style="height: 260px"></div>
    {:else if errorCarga}
      <div class="empty-state card">
        <Icono nombre="alert" tam={28} />
        <h3>No se pudo cargar tu panel</h3>
        <p>{errorCarga}</p>
        <button class="btn btn-dark" on:click={cargarTodo}>Reintentar</button>
      </div>
    {:else}
      {#key pestana}
        <div in:fly={{ y: 10, duration: 250 }}>
          {#if pestana === 'resumen'}
            <div class="kpi-grid">
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

            <div class="card card-pad grafica-card">
              <GraficaIngresos datos={ingresos} />
            </div>

            <div class="dash-cols">
              <div class="card card-pad">
                <div class="card-head">
                  <h3>Solicitudes por responder</h3>
                  {#if pendientes.length}
                    <button class="link-arrow" on:click={() => (pestana = 'solicitudes')}>Ver todas <Icono nombre="arrowRight" tam={15} /></button>
                  {/if}
                </div>
                {#if pendientes.length === 0}
                  <div class="empty-mini"><Icono nombre="inbox" tam={22} /> No hay solicitudes pendientes</div>
                {:else}
                  <ul class="rows">
                    {#each pendientes.slice(0, 5) as s (s.id)}
                      <li class="row" animate:flip={{ duration: 250 }} out:fade={{ duration: 150 }}>
                        <button class="row-main" on:click={() => abrirDetalle(s)}>
                          <span class="avatar">{s.nombre_contacto.slice(0, 1).toUpperCase()}</span>
                          <span>
                            <strong>{s.maquina_nombre}</strong>
                            <span class="muted small">{s.nombre_contacto} · {formatoRango(s.fecha_inicio, s.fecha_fin)} · {formatoDinero(s.precio_dia * s.dias)}</span>
                          </span>
                        </button>
                        <div class="row-actions">
                          <button class="btn btn-sm btn-primary" on:click={() => responder(s, 'aceptada')}>Aceptar</button>
                          <button class="btn btn-sm btn-ghost" on:click={() => responder(s, 'rechazada')}>Rechazar</button>
                        </div>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>

              <div class="side-stack">
                <div class="card card-pad">
                  <div class="card-head"><h3>Estado de tus equipos</h3></div>
                  {#if m.total === 0}
                    <div class="empty-mini"><Icono nombre="box" tam={22} /> Aún no publicas equipos</div>
                  {:else}
                    <div class="barra">
                      <span class="b-disp" style="width: {pct(m.disponibles)}%"></span>
                      <span class="b-lib" style="width: {pct(m.por_liberar)}%"></span>
                      <span class="b-rent" style="width: {pct(m.rentadas)}%"></span>
                    </div>
                    <ul class="leyenda">
                      <li><i class="b-disp"></i> Disponibles <b>{m.disponibles}</b></li>
                      <li><i class="b-lib"></i> Por liberar <b>{m.por_liberar}</b></li>
                      <li><i class="b-rent"></i> Rentados <b>{m.rentadas}</b></li>
                    </ul>
                  {/if}
                </div>

                {#if recientes.length}
                  <div class="card card-pad">
                    <div class="card-head"><h3>Actividad reciente</h3></div>
                    <ul class="timeline">
                      {#each recientes as s (s.id)}
                        <li>
                          <span class="dot sol-{s.estado}"></span>
                          <div>
                            <strong>{s.maquina_nombre}</strong>
                            <span class="muted small">{s.nombre_contacto} · {formatoFecha(s.created_at)}</span>
                          </div>
                          <span class="badge sol-{s.estado}">{ESTADOS_SOLICITUD[s.estado] || s.estado}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>
            </div>

          {:else if pestana === 'solicitudes'}
            <div class="chips">
              {#each ['pendiente', 'aceptada', 'rechazada', 'cancelada', 'todas'] as e}
                <button class:active={filtroSol === e} on:click={() => (filtroSol = e)}>
                  {e === 'todas' ? 'Todas' : ESTADOS_SOLICITUD[e]}
                  <span>{e === 'todas' ? solicitudes.length : conteo(e)}</span>
                </button>
              {/each}
            </div>

            {#if solFiltradas.length === 0}
              <div class="empty-state card" in:fade>
                <Icono nombre="inbox" tam={28} />
                <h3>{textoFiltroVacio(filtroSol)}</h3>
              </div>
            {:else}
              <div class="card table-card">
                <table class="table">
                  <thead>
                    <tr><th>Equipo</th><th>Cliente</th><th>Fechas</th><th>Total</th><th>Enviada</th><th>Estado</th><th></th></tr>
                  </thead>
                  <tbody>
                    {#each solFiltradas as s (s.id)}
                      <tr on:click={() => abrirDetalle(s)} animate:flip={{ duration: 250 }}>
                        <td data-label="Equipo"><strong>{s.maquina_nombre}</strong></td>
                        <td data-label="Cliente"><span>{s.nombre_contacto}<span class="muted small block">{s.telefono}</span></span></td>
                        <td data-label="Fechas">{formatoRango(s.fecha_inicio, s.fecha_fin)}<span class="muted small block">{s.dias} día(s)</span></td>
                        <td data-label="Total"><strong>{formatoDinero(s.precio_dia * s.dias)}</strong></td>
                        <td data-label="Fecha">{formatoFecha(s.created_at)}</td>
                        <td data-label="Estado">
                          <span class="badge sol-{s.estado}">{ESTADOS_SOLICITUD[s.estado] || s.estado}</span>
                          {#if s.no_leidos}<button class="msg-pill" on:click|stopPropagation={() => abrirDetalle(s, 'chat')}><Icono nombre="chat" tam={12} /> {s.no_leidos}</button>{/if}
                        </td>
                        <td class="td-actions" on:click|stopPropagation>
                          {#if s.estado === 'pendiente'}
                            <button class="btn btn-sm btn-primary" on:click={() => responder(s, 'aceptada')}>Aceptar</button>
                            <button class="btn btn-sm btn-ghost" on:click={() => responder(s, 'rechazada')}>Rechazar</button>
                          {:else}
                            <button class="btn btn-sm btn-ghost" on:click={() => abrirDetalle(s)}>Ver</button>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}

          {:else}
            {#if equipos.length === 0}
              <div class="empty-state card">
                <Icono nombre="box" tam={28} />
                <h3>Aún no has publicado equipos</h3>
                <p>Publica tu primer equipo para empezar a recibir solicitudes.</p>
                <button class="btn btn-primary" on:click={nuevo}><Icono nombre="plus" tam={16} /> Publicar equipo</button>
              </div>
            {:else}
              <div class="grid-cards">
                {#each equipos as eq (eq.id)}
                  <article class="card eq-card" animate:flip={{ duration: 250 }} out:fade={{ duration: 150 }}>
                    <div class="eq-img">
                      <img src={eq.imagen} alt={eq.nombre} loading="lazy" />
                      {#if eq.pendientes}
                        <span class="badge badge-float sol-pendiente">{eq.pendientes} pendiente{eq.pendientes === 1 ? '' : 's'}</span>
                      {/if}
                    </div>
                    <div class="eq-body">
                      <p class="eyebrow">{eq.categoria}</p>
                      <h3>{eq.nombre}</h3>
                      <p class="meta"><Icono nombre="pin" tam={14} /> {eq.ubicacion} · {formatoPrecio(eq.precio)}</p>
                      {#if eq.resenas}<p class="meta"><Estrellas valor={eq.promedio} tam={13} /> {eq.promedio.toFixed(1)} ({eq.resenas})</p>{/if}
                      <label class="eq-estado">
                        <span class="label">Estado</span>
                        <select class="input input-sm estado-{eq.estado}" value={eq.estado}
                          on:change={(e) => cambiarEstado(eq, e.currentTarget.value)}>
                          {#each Object.entries(ESTADOS_MAQUINA) as [valor, texto]}
                            <option value={valor}>{texto}</option>
                          {/each}
                        </select>
                      </label>
                    </div>
                    <div class="eq-actions">
                      <a class="icon-btn" href={`#/maquina/${eq.id}`} title="Ver en catálogo"><Icono nombre="eye" tam={17} /></a>
                      <button class="icon-btn" on:click={() => editar(eq)} title="Editar"><Icono nombre="edit" tam={17} /></button>
                      <button class="icon-btn icon-danger" on:click={() => eliminar(eq)} title="Eliminar"><Icono nombre="trash" tam={17} /></button>
                    </div>
                  </article>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      {/key}
    {/if}
  </section>

  <!-- Modal: publicar / editar equipo -->
  <Modal open={formAbierto} ancho="lg"
    titulo={editandoId ? 'Editar equipo' : 'Publicar un equipo'}
    subtitulo={editandoId ? f.nombre : 'Los datos aparecerán en el catálogo público.'}
    on:close={() => (formAbierto = false)}>
    <form id="form-equipo" class="form-grid" on:submit|preventDefault={guardar}>
      <label class="field span-2">
        <span class="label">Nombre del equipo</span>
        <input class="input" type="text" bind:value={f.nombre} placeholder="Ej. Excavadora CAT 320" />
      </label>
      <label class="field">
        <span class="label">Categoría</span>
        <select class="input" bind:value={f.categoria}>
          {#each $categorias as c}<option>{c.nombre}</option>{/each}
          {#if f.categoria && !$categorias.some((c) => c.nombre === f.categoria)}<option>{f.categoria}</option>{/if}
        </select>
      </label>
      <label class="field">
        <span class="label">Ciudad</span>
        <input class="input" type="text" bind:value={f.ciudad} placeholder="Ej. Mérida, Yuc." />
      </label>
      <label class="field">
        <span class="label">Precio por día (MXN)</span>
        <div class="input-prefix">
          <span>$</span>
          <input class="input" type="number" min="1" bind:value={f.precio_dia} placeholder="2500" />
        </div>
      </label>
      <label class="field">
        <span class="label">Estado</span>
        <select class="input" bind:value={f.estado}>
          {#each Object.entries(ESTADOS_MAQUINA) as [valor, texto]}<option value={valor}>{texto}</option>{/each}
        </select>
      </label>
      <label class="field span-2">
        <span class="label">Descripción</span>
        <textarea class="input" rows="3" bind:value={f.descripcion} placeholder="Estado del equipo, si incluye operador, traslado…"></textarea>
      </label>
      <div class="field span-2">
        <span class="label">Foto del equipo <em>JPG, PNG o WEBP, máx. 4 MB</em></span>
        <div class="foto-equipo">
          {#if fotoVista}
            <img src={fotoVista} alt="Foto del equipo" />
          {:else}
            <div class="foto-vacia muted small">Sin foto: se muestra la imagen de la categoría</div>
          {/if}
          <div class="foto-botones">
            <label class="btn btn-ghost">
              {fotoVista ? "Cambiar foto" : "Subir foto"}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden on:change={elegirFoto} />
            </label>
            {#if fotoVista}<button type="button" class="btn btn-ghost" on:click={borrarFoto}>Quitar</button>{/if}
          </div>
        </div>
      </div>
      <label class="field span-2 check-destacado">
        <input type="checkbox" bind:checked={f.destacado} />
        <span>Destacar este equipo (aparece primero en el catálogo)</span>
      </label>
      <label class="field span-2">
        <span class="label">Especificaciones <em>una por línea, formato "Clave: valor"</em></span>
        <textarea class="input mono" rows="4" bind:value={f.specs} placeholder={'Peso: 20 ton\nOperador incluido: Sí'}></textarea>
      </label>
      {#if error}<p class="form-error span-2" in:fly={{ y: -4 }}>{error}</p>{/if}
    </form>
    <svelte:fragment slot="pie">
      <button class="btn btn-ghost" on:click={() => (formAbierto = false)}>Cancelar</button>
      <button class="btn btn-primary" type="submit" form="form-equipo" disabled={guardando}>
        {#if guardando}<span class="spinner"></span>{/if}
        {editandoId ? 'Guardar cambios' : 'Publicar equipo'}
      </button>
    </svelte:fragment>
  </Modal>

  <!-- Modal: detalle de solicitud -->
  <Modal open={!!detalle} ancho="lg" titulo="Solicitud de renta" subtitulo={detalle?.maquina_nombre || ''} on:close={() => (detalle = null)}>
    {#if detalle}
      <div class="segmented seg-modal">
        <button class:active={vista === 'info'} on:click={() => (vista = 'info')}>Detalles</button>
        <button class:active={vista === 'chat'} on:click={() => (vista = 'chat')}>
          Mensajes {#if detalle.no_leidos}<span class="count">{detalle.no_leidos}</span>{/if}
        </button>
        <span class="segmented-bg" class:derecha={vista === 'chat'}></span>
      </div>

      {#if vista === 'chat'}
        <Chat solicitudId={detalle.id} otro={detalle.nombre_contacto.split(' ')[0]} />
      {:else}
        <div class="detalle-sol">
          <span class="badge sol-{detalle.estado}">{ESTADOS_SOLICITUD[detalle.estado] || detalle.estado}</span>
          <dl class="dl-grid">
            <div><dt>Contacto</dt><dd>{detalle.nombre_contacto}</dd></div>
            <div><dt>Teléfono</dt><dd>{detalle.telefono}</dd></div>
            <div><dt>Correo de la cuenta</dt><dd>{detalle.cliente_email}</dd></div>
            <div><dt>Enviada</dt><dd>{formatoFecha(detalle.created_at)}</dd></div>
            <div><dt>Fechas</dt><dd>{formatoRango(detalle.fecha_inicio, detalle.fecha_fin)}</dd></div>
            <div><dt>Días</dt><dd>{detalle.dias} × {formatoPrecio(detalle.precio_dia)}</dd></div>
            <div><dt>Total estimado</dt><dd><strong>{formatoDinero(detalle.precio_dia * detalle.dias)}</strong></dd></div>
          </dl>
          {#if detalle.mensaje}
            <blockquote class="quote">{detalle.mensaje}</blockquote>
          {/if}
          {#if detalle.resena_calificacion}
            <div class="mi-resena">
              <span class="label">Reseña del cliente</span>
              <Estrellas valor={detalle.resena_calificacion} tam={18} />
              {#if detalle.resena_comentario}<p>{detalle.resena_comentario}</p>{/if}
            </div>
          {/if}
        </div>
      {/if}
    {/if}
    <svelte:fragment slot="pie">
      {#if detalle}
        <a class="btn btn-ghost" target="_blank" rel="noreferrer" href={whatsapp(detalle.telefono)}>
          <Icono nombre="phone" tam={16} /> WhatsApp
        </a>
        {#if detalle.estado === 'pendiente'}
          <button class="btn btn-danger-ghost" on:click={() => responder(detalle, 'rechazada')}>Rechazar</button>
          <button class="btn btn-primary" on:click={() => responder(detalle, 'aceptada')}>Aceptar</button>
        {/if}
      {/if}
    </svelte:fragment>
  </Modal>
{/if}
