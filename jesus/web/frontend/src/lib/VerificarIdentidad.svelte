<script>
  // Verificación automática del proveedor: foto de la INE -> OCR en el dispositivo -> el backend
  // valida la CURP, que coincida con el nombre, la mayoría de edad y calcula el RFC.
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import Modal from './Modal.svelte';
  import Icono from './Icono.svelte';
  import { api } from './api.js';
  import { sesion } from './sesion.js';
  import { toast } from './ui.js';

  export let open = false;
  const dispatch = createEventDispatcher();

  let paso = 'foto'; // foto | leyendo | revisar | listo
  let progreso = 0;
  let datos = { paterno: '', materno: '', nombres: '', curp: '' };
  let error = '';
  let enviando = false;
  let rfc = '';

  $: if (open) reiniciar();
  function reiniciar() {
    if (paso === 'listo' || paso === 'foto') {
      paso = 'foto';
      error = '';
      progreso = 0;
    }
  }

  function cerrar() {
    if (paso === 'leyendo') return;
    paso = 'foto';
    dispatch('close');
  }

  async function elegir(e) {
    const archivo = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!archivo) return;
    paso = 'leyendo';
    progreso = 0;
    error = '';
    try {
      const { leerIne } = await import('./ine.js');
      datos = await leerIne(archivo, (p) => (progreso = p));
    } catch {
      paso = 'foto';
      error = 'No se pudo leer la foto. Revisa tu conexión a internet e inténtalo de nuevo.';
      return;
    }
    if (!datos.curp) {
      paso = 'foto';
      error = 'No encontramos la CURP en la foto. Toma la foto de frente, con buena luz y que se vea toda la credencial.';
      return;
    }
    await verificar();
  }

  async function verificar() {
    enviando = true;
    error = '';
    try {
      const u = await api('/proveedor/verificacion', { method: 'POST', body: datos });
      sesion.update((s) => ({ ...s, usuario: u }));
      rfc = u.rfc;
      paso = 'listo';
      toast('¡Cuenta verificada!');
    } catch (e) {
      error = e.message;
      paso = 'revisar'; // el OCR pudo leer mal alguna letra: se muestran los datos para corregir
    } finally {
      enviando = false;
    }
  }
</script>

<Modal {open} titulo="Verificar mi cuenta" subtitulo="Automático, en menos de un minuto" on:close={cerrar}>
  {#if paso === 'foto'}
    <div class="verif-paso" in:fly={{ y: 6 }}>
      <p>Toma una foto del <strong>frente de tu INE</strong>. Leemos tu nombre y tu CURP, calculamos tu RFC y verificamos tu cuenta al instante.</p>
      <ul class="verif-tips muted small">
        <li>De frente, con buena luz y sin reflejos.</li>
        <li>Que se vea toda la credencial y el texto esté enfocado.</li>
        <li>La foto se procesa en tu dispositivo y no se guarda.</li>
      </ul>
      {#if error}<p class="form-error" in:fly={{ y: -4 }}>{error}</p>{/if}
      <label class="btn btn-primary btn-block verif-boton">
        <Icono nombre="shield" tam={16} /> Tomar o subir foto de mi INE
        <input type="file" accept="image/*" hidden on:change={elegir} />
      </label>
    </div>
  {:else if paso === 'leyendo'}
    <div class="verif-paso verif-centro" in:fly={{ y: 6 }}>
      <span class="spinner"></span>
      <p>{enviando ? 'Verificando tus datos…' : 'Leyendo tu INE…'}</p>
      <div class="barra"><span style="width: {Math.round(progreso * 100)}%; background: var(--brand)"></span></div>
      <p class="muted small">La primera vez tarda un poco más mientras se descarga el lector.</p>
    </div>
  {:else if paso === 'revisar'}
    <form class="form-grid" in:fly={{ y: 6 }} on:submit|preventDefault={verificar}>
      <p class="span-2">Leímos esto de tu INE, pero algo no cuadró. Corrige la letra que se haya leído mal y vuelve a intentar.</p>
      <label class="field"><span class="label">Apellido paterno</span><input class="input" bind:value={datos.paterno} /></label>
      <label class="field"><span class="label">Apellido materno</span><input class="input" bind:value={datos.materno} /></label>
      <label class="field span-2"><span class="label">Nombre(s)</span><input class="input" bind:value={datos.nombres} /></label>
      <label class="field span-2"><span class="label">CURP</span><input class="input mono" maxlength="18" bind:value={datos.curp} /></label>
      {#if error}<p class="form-error span-2" in:fly={{ y: -4 }}>{error}</p>{/if}
      <div class="span-2 verif-acciones">
        <label class="btn btn-ghost">Usar otra foto<input type="file" accept="image/*" hidden on:change={elegir} /></label>
        <button class="btn btn-primary" type="submit" disabled={enviando}>
          {#if enviando}<span class="spinner"></span>{/if} Verificar
        </button>
      </div>
    </form>
  {:else}
    <div class="verif-paso verif-centro" in:fly={{ y: 6 }}>
      <span class="verif-ok"><Icono nombre="check" tam={28} /></span>
      <h3>¡Listo, tu cuenta está verificada!</h3>
      <p>Tus equipos ya muestran la insignia de proveedor verificado.</p>
      {#if rfc}<p class="muted">Tu RFC: <strong class="mono">{rfc}</strong></p>{/if}
      <button class="btn btn-primary" on:click={cerrar}>Entendido</button>
    </div>
  {/if}
</Modal>

<style>
  .verif-paso { display: flex; flex-direction: column; gap: 14px; }
  .verif-centro { align-items: center; text-align: center; padding: 10px 0; }
  .verif-centro .barra { width: 100%; }
  .verif-tips { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
  .verif-boton { cursor: pointer; justify-content: center; gap: 8px; }
  .verif-acciones { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .verif-acciones label { cursor: pointer; }
  .verif-ok {
    width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center;
    background: var(--ok-soft); color: var(--ok);
  }
  h3 { margin: 0; }
</style>
