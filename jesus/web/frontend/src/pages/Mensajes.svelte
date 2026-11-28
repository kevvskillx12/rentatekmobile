<script>
  // Apartado "Mensajes": todas las conversaciones del usuario (una por renta), estilo WhatsApp.
  // En computadora: lista a la izquierda y chat a la derecha. En celular: lista o chat.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { usuario } from '../lib/sesion.js';
  import { BASE } from '../lib/api.js';
  import { conversaciones, cargarConversaciones } from '../lib/mensajes.js';
  import { imagenPara, haceTiempo, formatoRango, ESTADOS_SOLICITUD } from '../lib/datos.js';
  import Chat from '../lib/Chat.svelte';
  import Icono from '../lib/Icono.svelte';

  export let solicitudId = '';

  let cargando = true;
  let buscar = '';

  onMount(() => {
    cargarConversaciones().finally(() => (cargando = false));
  });

  const imagen = (c) =>
    c.tiene_foto ? `${BASE}/maquinaria/${c.maquina_id}/foto?v=${c.foto_v}` : c.categoria_imagen || imagenPara(c.categoria);
  const enlaceRenta = (c) => (c.soy_cliente ? `#/mis-rentas/${c.id}` : `#/panel/solicitud/${c.id}`);
  const sinAcentos = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  $: lista = buscar.trim()
    ? $conversaciones.filter((c) => sinAcentos(`${c.otro_nombre} ${c.maquina_nombre}`).includes(sinAcentos(buscar.trim())))
    : $conversaciones;
  $: activa = $conversaciones.find((c) => String(c.id) === String(solicitudId)) || null;
</script>

{#if !$usuario || ($usuario.rol !== 'cliente' && $usuario.rol !== 'proveedor')}
  <div class="container detail-wrap">
    <div class="empty-state card">
      <Icono nombre="chat" tam={28} />
      <h3>Inicia sesión para ver tus mensajes</h3>
      <a class="btn btn-dark" href="#/acceso">Iniciar sesión</a>
    </div>
  </div>
{:else}
  <section class="container bandeja" class:con-chat={!!activa}>
    <aside class="card bandeja-lista">
      <div class="bandeja-head">
        <h2>Mensajes</h2>
        <label class="search-inline bandeja-buscar">
          <Icono nombre="search" tam={16} />
          <input type="text" placeholder="Buscar por nombre o equipo…" bind:value={buscar} />
        </label>
      </div>

      {#if cargando && !$conversaciones.length}
        <div class="bandeja-vacia muted">Cargando conversaciones…</div>
      {:else if !$conversaciones.length}
        <div class="bandeja-vacia">
          <Icono nombre="chat" tam={26} />
          <p>Aún no tienes conversaciones.</p>
          <p class="muted small">
            {$usuario.rol === 'cliente'
              ? 'Cuando solicites una renta podrás platicar aquí con el proveedor.'
              : 'Cuando un cliente te pida una renta podrás platicar aquí con él.'}
          </p>
          {#if $usuario.rol === 'cliente'}<a class="btn btn-primary btn-sm" href="#/catalogo">Ver catálogo</a>{/if}
        </div>
      {:else if !lista.length}
        <div class="bandeja-vacia muted">Sin resultados para “{buscar}”.</div>
      {:else}
        <ul class="conv-lista">
          {#each lista as c (c.id)}
            <li>
              <a class="conv" class:activa={activa?.id === c.id} class:sin-leer={c.no_leidos} href={`#/mensajes/${c.id}`}>
                <img src={imagen(c)} alt="" loading="lazy" />
                <span class="conv-texto">
                  <span class="conv-fila">
                    <strong>{c.otro_nombre}</strong>
                    {#if c.ultimo_en}<span class="conv-hora">{haceTiempo(c.ultimo_en)}</span>{/if}
                  </span>
                  <span class="conv-maquina">{c.maquina_nombre} · <span class="sol-txt-{c.estado}">{ESTADOS_SOLICITUD[c.estado] || c.estado}</span></span>
                  <span class="conv-fila">
                    <span class="conv-ultimo">
                      {#if c.ultimo_texto}{c.ultimo_mio ? 'Tú: ' : ''}{c.ultimo_texto}{:else}<em>Sin mensajes todavía</em>{/if}
                    </span>
                    {#if c.no_leidos}<span class="count">{c.no_leidos}</span>{/if}
                  </span>
                </span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </aside>

    <div class="card bandeja-chat">
      {#if activa}
        <div class="chat-head" in:fade={{ duration: 150 }}>
          <a class="icon-btn solo-movil" href="#/mensajes" aria-label="Volver a la lista"><Icono nombre="chevronLeft" tam={18} /></a>
          <img src={imagen(activa)} alt="" />
          <span class="chat-head-texto">
            <strong>{activa.otro_nombre}</strong>
            <span class="muted small">{activa.maquina_nombre}{#if activa.fecha_inicio} · {formatoRango(activa.fecha_inicio, activa.fecha_fin)}{/if}</span>
          </span>
          <a class="btn btn-ghost btn-sm" href={enlaceRenta(activa)}>Ver renta</a>
        </div>
        {#key activa.id}
          <Chat solicitudId={activa.id} otro={activa.otro_nombre} alto="min(60vh, 520px)" />
        {/key}
      {:else}
        <div class="bandeja-vacia">
          <Icono nombre="chat" tam={30} />
          <p>Elige una conversación para ver los mensajes.</p>
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  .bandeja {
    display: grid; grid-template-columns: minmax(260px, 340px) 1fr; gap: 16px;
    padding-top: 24px; padding-bottom: 32px; align-items: start;
  }
  .bandeja-lista { display: flex; flex-direction: column; overflow: hidden; max-height: calc(100vh - 140px); }
  .bandeja-head { padding: 16px 16px 10px; display: grid; gap: 10px; border-bottom: 1px solid var(--line); }
  .bandeja-head h2 { margin: 0; font-size: 20px; }
  .bandeja-buscar { width: 100%; }
  .conv-lista { list-style: none; margin: 0; padding: 0; overflow-y: auto; }
  .conv {
    display: flex; gap: 10px; padding: 12px 14px; text-decoration: none; color: inherit;
    border-bottom: 1px solid var(--line-2);
  }
  .conv:hover { background: var(--line-2); }
  .conv.activa { background: var(--brand-soft); }
  .conv img { width: 46px; height: 46px; border-radius: 10px; object-fit: cover; flex-shrink: 0; background: var(--line-2); }
  .conv-texto { display: grid; gap: 2px; min-width: 0; flex: 1; }
  .conv-fila { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
  .conv-fila strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
  .conv-hora { font-size: 11px; color: var(--muted); flex-shrink: 0; }
  .conv-maquina { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .conv-ultimo { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .conv.sin-leer .conv-ultimo { color: var(--text); font-weight: 600; }
  .sol-txt-aceptada { color: var(--ok); }
  .sol-txt-pendiente { color: var(--warn); }
  .sol-txt-rechazada, .sol-txt-cancelada { color: var(--bad); }

  .bandeja-chat { padding: 14px; display: flex; flex-direction: column; gap: 12px; min-height: 360px; }
  .chat-head { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
  .chat-head img { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
  .chat-head-texto { display: grid; min-width: 0; flex: 1; }
  .chat-head-texto strong, .chat-head-texto span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bandeja-vacia {
    margin: auto; padding: 32px 16px; display: flex; flex-direction: column; align-items: center; gap: 8px;
    text-align: center; color: var(--muted);
  }
  .bandeja-vacia p { margin: 0; }
  .solo-movil { display: none; }

  /* Celular: se ve la lista o el chat, no los dos */
  @media (max-width: 820px) {
    .bandeja { grid-template-columns: 1fr; padding-top: 12px; }
    .bandeja-lista { max-height: none; }
    .bandeja.con-chat .bandeja-lista { display: none; }
    .bandeja:not(.con-chat) .bandeja-chat { display: none; }
    .solo-movil { display: grid; }
  }
</style>
