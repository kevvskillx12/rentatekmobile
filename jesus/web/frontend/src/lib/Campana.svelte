<script>
  import { fly } from 'svelte/transition';
  import { notifs, leerNotif, leerTodas, cargarNotifs } from './notificaciones.js';
  import { haceTiempo } from './datos.js';
  import Icono from './Icono.svelte';

  let abierto = false;

  const ICONOS = {
    solicitud: 'inbox', aceptada: 'check', rechazada: 'x', cancelada: 'x', mensaje: 'chat',
    resena: 'star', verificado: 'shield', bienvenida: 'user', moderacion: 'alert', contacto: 'mail'
  };

  function abrir() {
    abierto = !abierto;
    if (abierto) cargarNotifs();
  }

  function ir(n) {
    leerNotif(n);
    abierto = false;
    if (n.enlace) window.location.hash = n.enlace;
  }

  function fuera(e) {
    if (abierto && !e.target.closest('.campana')) abierto = false;
  }
</script>

<svelte:window on:click={fuera} on:hashchange={() => (abierto = false)} />

<div class="campana">
  <button class="icon-btn" on:click={abrir} aria-label={`Notificaciones${$notifs.no_leidas ? `, ${$notifs.no_leidas} sin leer` : ''}`} aria-expanded={abierto}>
    <Icono nombre="bell" tam={20} />
    {#if $notifs.no_leidas}<span class="punto">{$notifs.no_leidas > 9 ? '9+' : $notifs.no_leidas}</span>{/if}
  </button>

  {#if abierto}
    <div class="panel-notif" transition:fly={{ y: -8, duration: 160 }}>
      <div class="pn-head">
        <strong>Notificaciones</strong>
        {#if $notifs.no_leidas}<button class="link-btn" on:click={leerTodas}>Marcar todas como leídas</button>{/if}
      </div>
      {#if $notifs.items.length === 0}
        <div class="pn-vacio"><Icono nombre="bell" tam={22} /> No tienes notificaciones</div>
      {:else}
        <ul>
          {#each $notifs.items as n (n.id)}
            <li>
              <button class:nueva={!n.leida} on:click={() => ir(n)}>
                <span class="pn-ico tipo-{n.tipo}"><Icono nombre={ICONOS[n.tipo] || 'bell'} tam={15} /></span>
                <span class="pn-txt">
                  <strong>{n.titulo}</strong>
                  {#if n.mensaje}<span>{n.mensaje}</span>{/if}
                  <em>{haceTiempo(n.created_at)}</em>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<style>
  .campana { position: relative; }
  .campana > .icon-btn { position: relative; }
  .punto {
    position: absolute; top: 2px; right: 1px; min-width: 17px; height: 17px; padding: 0 4px;
    border-radius: 999px; background: var(--bad); color: #fff; font-size: 10px; font-weight: 700;
    display: grid; place-items: center; border: 2px solid var(--surface);
  }
  .panel-notif {
    position: absolute; right: -50px; top: calc(100% + 10px); width: min(380px, calc(100vw - 24px));
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); box-shadow: var(--sh-lg); overflow: hidden; z-index: 50;
  }
  .pn-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line-2); }
  .pn-head strong { color: var(--ink); }
  ul { max-height: 420px; overflow-y: auto; }
  li button { display: flex; gap: 12px; width: 100%; padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--line-2); transition: background 0.15s; }
  li button:hover { background: var(--line-2); }
  li button.nueva { background: var(--brand-soft); }
  .pn-ico { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--line-2); color: var(--muted); flex-shrink: 0; }
  .tipo-aceptada, .tipo-verificado { background: var(--ok-soft); color: var(--ok); }
  .tipo-rechazada, .tipo-cancelada, .tipo-moderacion { background: var(--bad-soft); color: var(--bad); }
  .tipo-solicitud, .tipo-resena, .tipo-mensaje { background: var(--warn-soft); color: var(--warn); }
  .pn-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .pn-txt strong { font-size: 14px; color: var(--ink); }
  .pn-txt span { font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
  .pn-txt em { font-style: normal; font-size: 12px; color: var(--muted-2); }
  .pn-vacio { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 36px 16px; color: var(--muted); font-size: 14px; }
  @media (max-width: 600px) { .panel-notif { position: fixed; left: 12px; right: 12px; top: 72px; width: auto; } }
</style>
