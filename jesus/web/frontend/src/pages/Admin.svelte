<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { usuario } from '../lib/sesion.js';
  import { api } from '../lib/api.js';
  import { toast, confirmar } from '../lib/ui.js';
  import { normalizar, formatoFecha, formatoPrecio, haceTiempo, iniciales, ESTADOS_MAQUINA } from '../lib/datos.js';
  import { recargar as recargarCategorias } from '../lib/equipos.js';
  import Icono from '../lib/Icono.svelte';
  import Estrellas from '../lib/Estrellas.svelte';

  export let seccion = 'resumen'; // resumen | usuarios | maquinaria | contacto

  let resumen = null;
  let usuarios = [];
  let maquinas = [];
  let contactos = [];
  let qUsuarios = '';
  let rol = '';
  let qMaq = '';
  let cargando = false;

  const ROLES = { cliente: 'Cliente', proveedor: 'Proveedor', admin: 'Admin' };

  async function cargarResumen() {
    try { resumen = await api('/admin/resumen'); } catch (e) { toast(e.message, 'error'); }
  }
  async function cargarUsuarios() {
    cargando = true;
    try {
      const p = new URLSearchParams();
      if (qUsuarios.trim()) p.set('q', qUsuarios.trim());
      if (rol) p.set('rol', rol);
      usuarios = await api(`/admin/usuarios?${p}`);
    } catch (e) { toast(e.message, 'error'); } finally { cargando = false; }
  }
  async function cargarMaquinas() {
    cargando = true;
    try { maquinas = (await api(`/admin/maquinaria?q=${encodeURIComponent(qMaq.trim())}`)).map(normalizar); }
    catch (e) { toast(e.message, 'error'); } finally { cargando = false; }
  }
  async function cargarContactos() {
    cargando = true;
    try { contactos = await api('/admin/contactos'); } catch (e) { toast(e.message, 'error'); } finally { cargando = false; }
  }

  onMount(() => {
    if ($usuario?.rol !== 'admin') return;
    cargarResumen();
  });

  let t;
  $: if ($usuario?.rol === 'admin') {
    clearTimeout(t);
    const s = seccion, q1 = qUsuarios, r = rol, q2 = qMaq;
    t = setTimeout(() => {
      if (s === 'usuarios') cargarUsuarios();
      if (s === 'maquinaria') cargarMaquinas();
      if (s === 'contacto') cargarContactos();
    }, q1 || q2 || r ? 250 : 0);
  }

  function ir(s) {
    window.location.hash = s === 'resumen' ? '#/admin' : `#/admin/${s}`;
  }

  async function cambiar(u, campo) {
    const valor = !u[campo];
    if (campo === 'suspendido' && valor) {
      const ok = await confirmar({
        titulo: 'Suspender cuenta',
        mensaje: `${u.nombre} no podrá iniciar sesión y sus equipos dejarán de aparecer en el catálogo.`,
        accion: 'Suspender', peligro: true
      });
      if (!ok) return;
    }
    try {
      await api(`/admin/usuarios/${u.id}`, { method: 'PATCH', body: { [campo]: valor } });
      usuarios = usuarios.map((x) => (x.id === u.id ? { ...x, [campo]: valor } : x));
      toast(campo === 'verificado' ? (valor ? 'Proveedor verificado' : 'Verificación retirada') : valor ? 'Cuenta suspendida' : 'Cuenta reactivada');
      cargarResumen();
      recargarCategorias();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function borrarMaquina(m) {
    const ok = await confirmar({
      titulo: 'Retirar publicación',
      mensaje: `¿Eliminar "${m.nombre}" de ${m.proveedor}? Se borrarán también sus solicitudes y reseñas. Se le avisará al proveedor.`,
      accion: 'Eliminar', peligro: true
    });
    if (!ok) return;
    try {
      await api(`/admin/maquinaria/${m.id}`, { method: 'DELETE' });
      maquinas = maquinas.filter((x) => x.id !== m.id);
      toast('Publicación retirada');
      cargarResumen();
      recargarCategorias();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function atender(c) {
    try {
      await api(`/admin/contactos/${c.id}`, { method: 'PATCH', body: { atendido: !c.atendido } });
      contactos = contactos.map((x) => (x.id === c.id ? { ...x, atendido: !c.atendido } : x));
      cargarResumen();
    } catch (e) { toast(e.message, 'error'); }
  }

  $: kpis = resumen ? [
    { i: 'users', t: 'Clientes', v: resumen.clientes },
    { i: 'briefcase', t: 'Proveedores', v: resumen.proveedores },
    { i: 'shield', t: 'Por verificar', v: resumen.por_verificar, acento: resumen.por_verificar > 0, ir: 'usuarios' },
    { i: 'box', t: 'Equipos publicados', v: resumen.maquinas },
    { i: 'inbox', t: 'Solicitudes (pendientes)', v: `${resumen.solicitudes} (${resumen.pendientes})` },
    { i: 'mail', t: 'Mensajes sin atender', v: resumen.contactos_pendientes, acento: resumen.contactos_pendientes > 0, ir: 'contacto' }
  ] : [];
</script>

{#if $usuario?.rol !== 'admin'}
  <div class="container detail-wrap">
    <div class="empty-state card">
      <Icono nombre="lock" tam={28} />
      <h3>Esta sección es solo para administradores</h3>
      <a class="btn btn-dark" href="#/">Volver al inicio</a>
    </div>
  </div>
{:else}
  <section class="page-head">
    <div class="container page-head-inner">
      <div>
        <p class="eyebrow">Administración</p>
        <h1>Panel de control</h1>
        <p class="page-sub">Verifica proveedores, modera publicaciones y atiende mensajes.</p>
      </div>
    </div>
    <div class="container">
      <div class="tabs">
        <button class:active={seccion === 'resumen'} on:click={() => ir('resumen')}>Resumen</button>
        <button class:active={seccion === 'usuarios'} on:click={() => ir('usuarios')}>
          Usuarios {#if resumen?.por_verificar}<span class="count">{resumen.por_verificar}</span>{/if}
        </button>
        <button class:active={seccion === 'maquinaria'} on:click={() => ir('maquinaria')}>Publicaciones</button>
        <button class:active={seccion === 'contacto'} on:click={() => ir('contacto')}>
          Contacto {#if resumen?.contactos_pendientes}<span class="count">{resumen.contactos_pendientes}</span>{/if}
        </button>
      </div>
    </div>
  </section>

  <section class="container dash">
    {#key seccion}
      <div in:fly={{ y: 10, duration: 250 }}>
        {#if seccion === 'resumen'}
          {#if !resumen}
            <div class="kpi-grid">{#each Array(6) as _}<div class="skeleton" style="height: 104px"></div>{/each}</div>
          {:else}
            <div class="kpi-grid">
              {#each kpis as k}
                <button class="kpi card kpi-btn" class:kpi-acento={k.acento} on:click={() => k.ir && ir(k.ir)} disabled={!k.ir}>
                  <span class="kpi-ico"><Icono nombre={k.i} tam={18} /></span>
                  <div><span class="kpi-label">{k.t}</span><strong class="kpi-valor">{k.v}</strong></div>
                </button>
              {/each}
            </div>
            <div class="card card-pad">
              <p class="muted">Hay <b>{resumen.resenas}</b> reseñas publicadas y <b>{resumen.suspendidos}</b> cuenta(s) suspendida(s).
                Usa la pestaña <button class="link-btn" on:click={() => ir('usuarios')}>Usuarios</button> para verificar proveedores.</p>
            </div>
          {/if}

        {:else if seccion === 'usuarios'}
          <div class="admin-toolbar">
            <label class="search-inline">
              <Icono nombre="search" tam={18} />
              <input type="text" placeholder="Buscar por nombre, correo o empresa…" bind:value={qUsuarios} />
            </label>
            <div class="chips">
              {#each [['', 'Todos'], ['proveedor', 'Proveedores'], ['cliente', 'Clientes'], ['admin', 'Admins']] as [v, t]}
                <button class:active={rol === v} on:click={() => (rol = v)}>{t}</button>
              {/each}
            </div>
          </div>
          <div class="card table-card" class:recargando={cargando}>
            <table class="table">
              <thead><tr><th>Usuario</th><th>Rol</th><th>Actividad</th><th>Alta</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {#each usuarios as u (u.id)}
                  <tr class="no-click">
                    <td data-label="Usuario">
                      <span class="u-cell">
                        <span class="avatar">{iniciales(u.nombre)}</span>
                        <span><strong>{u.nombre}</strong><span class="muted small block">{u.email}{u.empresa ? ` · ${u.empresa}` : ''}</span></span>
                      </span>
                    </td>
                    <td data-label="Rol">{ROLES[u.rol]}</td>
                    <td data-label="Actividad">
                      {#if u.rol === 'proveedor'}{u.maquinas} equipos{#if u.promedio} · {u.promedio} ★{/if}
                      {:else if u.rol === 'cliente'}{u.solicitudes} solicitudes{:else}—{/if}
                    </td>
                    <td data-label="Alta">{formatoFecha(u.created_at)}</td>
                    <td data-label="Estado">
                      {#if u.suspendido}<span class="badge sol-rechazada">Suspendido</span>
                      {:else if u.verificado}<span class="verif"><Icono nombre="shield" tam={12} /> Verificado</span>
                      {:else}<span class="badge">Activo</span>{/if}
                    </td>
                    <td class="td-actions">
                      {#if u.rol === 'proveedor' && !u.suspendido}
                        <button class="btn btn-sm" class:btn-primary={!u.verificado} class:btn-ghost={u.verificado} on:click={() => cambiar(u, 'verificado')}>
                          {u.verificado ? 'Quitar verificación' : 'Verificar'}
                        </button>
                      {/if}
                      {#if u.rol !== 'admin'}
                        <button class="btn btn-sm" class:btn-danger-ghost={!u.suspendido} class:btn-ghost={u.suspendido} on:click={() => cambiar(u, 'suspendido')}>
                          {u.suspendido ? 'Reactivar' : 'Suspender'}
                        </button>
                      {/if}
                    </td>
                  </tr>
                {:else}
                  <tr class="no-click"><td colspan="6"><div class="empty-mini">{cargando ? 'Cargando…' : 'Sin resultados'}</div></td></tr>
                {/each}
              </tbody>
            </table>
          </div>

        {:else if seccion === 'maquinaria'}
          <div class="admin-toolbar">
            <label class="search-inline">
              <Icono nombre="search" tam={18} />
              <input type="text" placeholder="Buscar por equipo, ciudad o proveedor…" bind:value={qMaq} />
            </label>
          </div>
          <div class="card table-card" class:recargando={cargando}>
            <table class="table">
              <thead><tr><th>Equipo</th><th>Proveedor</th><th>Precio</th><th>Reseñas</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {#each maquinas as m (m.id)}
                  <tr class="no-click">
                    <td data-label="Equipo"><a class="u-cell" href={`#/maquina/${m.id}`}><img src={m.imagen} alt="" /><span><strong>{m.nombre}</strong><span class="muted small block">{m.categoria} · {m.ubicacion}</span></span></a></td>
                    <td data-label="Proveedor">{m.proveedor}{#if m.verificado} <Icono nombre="shield" tam={12} />{/if}</td>
                    <td data-label="Precio">{formatoPrecio(m.precio)}</td>
                    <td data-label="Reseñas">{#if m.resenas}<Estrellas valor={m.promedio} tam={12} /> ({m.resenas}){:else}—{/if}</td>
                    <td data-label="Estado"><span class="badge estado-{m.estado}">{ESTADOS_MAQUINA[m.estado]}</span></td>
                    <td class="td-actions"><button class="btn btn-sm btn-danger-ghost" on:click={() => borrarMaquina(m)}><Icono nombre="trash" tam={14} /> Retirar</button></td>
                  </tr>
                {:else}
                  <tr class="no-click"><td colspan="6"><div class="empty-mini">{cargando ? 'Cargando…' : 'Sin resultados'}</div></td></tr>
                {/each}
              </tbody>
            </table>
          </div>

        {:else}
          {#if contactos.length === 0}
            <div class="empty-state card"><Icono nombre="mail" tam={28} /><h3>{cargando ? 'Cargando…' : 'No hay mensajes de contacto'}</h3></div>
          {:else}
            <div class="contactos">
              {#each contactos as c (c.id)}
                <article class="card card-pad contacto" class:atendido={c.atendido} in:fade>
                  <div class="c-head">
                    <div>
                      <strong>{c.asunto || 'Sin asunto'}</strong>
                      <span class="muted small block">{c.nombre} · <a href={`mailto:${c.email}`}>{c.email}</a> · {haceTiempo(c.created_at)}</span>
                    </div>
                    <button class="btn btn-sm" class:btn-primary={!c.atendido} class:btn-ghost={c.atendido} on:click={() => atender(c)}>
                      {#if c.atendido}Marcar pendiente{:else}<Icono nombre="check" tam={14} /> Atendido{/if}
                    </button>
                  </div>
                  <p>{c.mensaje}</p>
                </article>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    {/key}
  </section>
{/if}

<style>
  .kpi-btn { text-align: left; width: 100%; }
  .kpi-btn:disabled { cursor: default; opacity: 1; }
  .admin-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .admin-toolbar .chips { margin-bottom: 0; }
  .u-cell { display: flex; align-items: center; gap: 10px; text-decoration: none; min-width: 0; }
  .u-cell img { width: 48px; height: 36px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
  .u-cell > span:last-child { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
  .table tbody tr.no-click { cursor: default; }
  .recargando { opacity: 0.6; }
  .contactos { display: flex; flex-direction: column; gap: 12px; }
  .contacto.atendido { opacity: 0.6; }
  .c-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
  .c-head strong { color: var(--ink); }
  .c-head a { color: var(--brand-ink); }
  .contacto p { white-space: pre-line; color: var(--text); }
</style>
