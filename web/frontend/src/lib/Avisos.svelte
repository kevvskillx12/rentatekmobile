<script>
  // Toasts + diálogo de confirmación globales (se montan una vez en App)
  import { fly, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { toasts, cerrarToast, dialogo } from './ui.js';
  import Modal from './Modal.svelte';
  import Icono from './Icono.svelte';

  // Conserva el contenido mientras el modal se desvanece
  let ultimo = {};
  $: if ($dialogo) ultimo = $dialogo;

  function responder(valor) {
    $dialogo?.resolve(valor);
    dialogo.set(null);
  }
</script>

<div class="toasts" aria-live="polite">
  {#each $toasts as t (t.id)}
    <div class="toast toast-{t.tipo}" animate:flip={{ duration: 200 }}
      in:fly={{ x: 40, duration: 250 }} out:fade={{ duration: 180 }}>
      <span class="toast-ico"><Icono nombre={t.tipo === 'error' ? 'alert' : 'check'} /></span>
      <p>{t.mensaje}</p>
      <button class="icon-btn" on:click={() => cerrarToast(t.id)} aria-label="Cerrar"><Icono nombre="x" tam={16} /></button>
    </div>
  {/each}
</div>

<Modal open={!!$dialogo} titulo={ultimo.titulo || '¿Confirmar?'} ancho="sm" on:close={() => responder(false)}>
  <p class="modal-texto">{ultimo.mensaje || ''}</p>
  <svelte:fragment slot="pie">
    <button class="btn btn-ghost" on:click={() => responder(false)}>Cancelar</button>
    <button class="btn {ultimo.peligro ? 'btn-danger' : 'btn-primary'}" on:click={() => responder(true)}>
      {ultimo.accion || 'Confirmar'}
    </button>
  </svelte:fragment>
</Modal>
