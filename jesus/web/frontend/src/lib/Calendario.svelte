<script>
  import { aISO, deISO, hoyISO } from './datos.js';
  import Icono from './Icono.svelte';

  // Selector de rango. `ocupadas`: [{ inicio, fin }] en formato YYYY-MM-DD.
  export let ocupadas = [];
  export let inicio = '';
  export let fin = '';

  const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const hoy = hoyISO();
  let mes = (() => { const d = deISO(inicio || hoy); return new Date(d.getFullYear(), d.getMonth(), 1); })();

  $: bloqueadas = (() => {
    const s = new Set();
    for (const r of ocupadas) {
      for (let d = deISO(r.inicio); d <= deISO(r.fin); d.setDate(d.getDate() + 1)) s.add(aISO(d));
    }
    return s;
  })();

  $: celdas = (() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const offset = (primero.getDay() + 6) % 7; // lunes primero
    const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const out = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) out.push(aISO(new Date(mes.getFullYear(), mes.getMonth(), d)));
    return out;
  })();

  $: titulo = (() => { const t = mes.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); return t[0].toUpperCase() + t.slice(1); })();
  $: puedeAtras = mes > deISO(hoy.slice(0, 8) + '01');

  function mover(n) {
    mes = new Date(mes.getFullYear(), mes.getMonth() + n, 1);
  }

  const deshabilitado = (iso) => iso < hoy || bloqueadas.has(iso);

  function cruzaOcupado(a, b) {
    for (let d = deISO(a); d <= deISO(b); d.setDate(d.getDate() + 1)) if (bloqueadas.has(aISO(d))) return true;
    return false;
  }

  function elegir(iso) {
    if (deshabilitado(iso)) return;
    if (!inicio || fin || iso < inicio) {
      inicio = iso;
      fin = '';
    } else if (cruzaOcupado(inicio, iso)) {
      inicio = iso;
      fin = '';
    } else {
      fin = iso;
    }
  }

  const enRango = (iso, a, b) => a && b && iso > a && iso < b;
</script>

<div class="cal">
  <div class="cal-head">
    <button type="button" class="icon-btn" on:click={() => mover(-1)} disabled={!puedeAtras} aria-label="Mes anterior">
      <Icono nombre="chevronLeft" tam={18} />
    </button>
    <strong>{titulo}</strong>
    <button type="button" class="icon-btn" on:click={() => mover(1)} aria-label="Mes siguiente">
      <Icono nombre="chevronRight" tam={18} />
    </button>
  </div>
  <div class="cal-grid">
    {#each DIAS as d}<span class="cal-dow">{d}</span>{/each}
    {#each celdas as iso}
      {#if iso}
        <button type="button" class="cal-dia"
          class:hoy={iso === hoy}
          class:ocupado={bloqueadas.has(iso)}
          class:sel={iso === inicio || iso === fin}
          class:rango={enRango(iso, inicio, fin)}
          disabled={deshabilitado(iso)}
          on:click={() => elegir(iso)}
          aria-label={iso}>{Number(iso.slice(8))}</button>
      {:else}<span></span>{/if}
    {/each}
  </div>
  <div class="cal-leyenda">
    <span><i class="l-sel"></i> Tu selección</span>
    <span><i class="l-ocu"></i> Ocupado</span>
  </div>
</div>

<style>
  .cal { border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: var(--surface); max-width: 440px; width: 100%; }
  .cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .cal-head strong { font-size: 15px; color: var(--ink); }
  .cal-head .icon-btn:disabled { opacity: 0.3; cursor: default; }
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
  .cal-dow { text-align: center; font-size: 11px; font-weight: 700; color: var(--muted-2); padding: 4px 0; }
  .cal-dia {
    height: 40px;
    border-radius: 8px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    transition: background 0.12s, color 0.12s;
  }
  .cal-dia:hover:not(:disabled) { background: var(--line-2); }
  .cal-dia:disabled { color: var(--muted-2); cursor: not-allowed; opacity: 0.55; }
  .cal-dia.hoy { box-shadow: inset 0 0 0 1px var(--brand); }
  .cal-dia.ocupado { background: repeating-linear-gradient(135deg, var(--bad-soft) 0 4px, transparent 4px 8px); color: var(--bad); text-decoration: line-through; opacity: 1; }
  .cal-dia.rango { background: var(--brand-soft); border-radius: 0; }
  .cal-dia.sel { background: var(--brand); color: #172033; font-weight: 700; }
  .cal-leyenda { display: flex; gap: 16px; margin-top: 10px; font-size: 12px; color: var(--muted); }
  .cal-leyenda span { display: inline-flex; align-items: center; gap: 6px; }
  .cal-leyenda i { width: 12px; height: 12px; border-radius: 3px; }
  .l-sel { background: var(--brand); }
  .l-ocu { background: repeating-linear-gradient(135deg, var(--bad-soft) 0 3px, var(--bad) 3px 4px); }
</style>
