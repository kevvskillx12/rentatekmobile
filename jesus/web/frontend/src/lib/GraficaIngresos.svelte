<script>
  import { formatoDinero } from './datos.js';
  import Icono from './Icono.svelte';

  // Serie única: [{ mes: 'YYYY-MM', ingresos, rentas }]
  export let datos = [];

  let activo = null; // índice con hover
  let verTabla = false;

  // Se dibuja al ancho real del contenedor para que el texto no se escale
  let W = 640;
  const H = 240, M = { t: 12, r: 8, b: 26, l: 52 };
  $: ancho = Math.max(100, W - M.l - M.r);
  const alto = H - M.t - M.b;

  const nombreMes = (m, largo = false) => {
    const [y, mm] = m.split('-').map(Number);
    const t = new Date(y, mm - 1, 1).toLocaleDateString('es-MX', largo ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '');
    return largo ? t[0].toUpperCase() + t.slice(1) : t;
  };
  const corto = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}k` : `$${n}`);

  $: maxV = Math.max(1, ...datos.map((d) => d.ingresos));
  // Escala "bonita": 4 divisiones
  $: paso = (() => {
    const crudo = maxV / 4;
    const mag = 10 ** Math.floor(Math.log10(crudo));
    return [1, 2, 2.5, 5, 10].map((f) => f * mag).find((p) => p >= crudo);
  })();
  $: tope = paso * 4;
  $: lineas = [0, 1, 2, 3, 4].map((i) => i * paso);
  $: banda = ancho / Math.max(1, datos.length);
  $: barW = Math.min(36, banda * 0.62);
  $: y = (v) => M.t + alto - (v / tope) * alto;
  $: total = datos.reduce((t, d) => t + d.ingresos, 0);
  $: rentas = datos.reduce((t, d) => t + d.rentas, 0);

  // Barra con esquinas superiores redondeadas (4px) anclada a la base
  function barra(x, v) {
    const top = y(v), base = M.t + alto, h = base - top;
    if (h <= 0) return '';
    const r = Math.min(4, h, barW / 2);
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`;
  }
</script>

<div class="gi">
  <div class="gi-head">
    <div>
      <h3>Ingresos por mes</h3>
      <p class="muted small">Rentas aceptadas en los últimos 12 meses, según la fecha de inicio</p>
    </div>
    <button class="btn btn-ghost btn-sm" on:click={() => (verTabla = !verTabla)} aria-pressed={verTabla}>
      <Icono nombre={verTabla ? 'chart' : 'table'} tam={15} /> {verTabla ? 'Ver gráfica' : 'Ver tabla'}
    </button>
  </div>

  <div class="gi-hero">
    <strong>{formatoDinero(total)}</strong>
    <span>{rentas} renta{rentas === 1 ? '' : 's'} en 12 meses</span>
  </div>

  {#if verTabla}
    <div class="gi-tabla">
      <table class="table">
        <thead><tr><th>Mes</th><th>Rentas</th><th>Ingresos</th></tr></thead>
        <tbody>
          {#each [...datos].reverse() as d}
            <tr><td data-label="Mes">{nombreMes(d.mes, true)}</td><td data-label="Rentas">{d.rentas}</td><td data-label="Ingresos"><strong>{formatoDinero(d.ingresos)}</strong></td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="gi-svg" bind:clientWidth={W}>
      <svg width={W} height={H} viewBox="0 0 {W} {H}" role="img" aria-label={`Ingresos por mes. Total ${formatoDinero(total)}`} on:mouseleave={() => (activo = null)}>
        {#each lineas as v}
          <line class="grid" x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} />
          <text class="eje" x={M.l - 8} y={y(v) + 4} text-anchor="end">{corto(v)}</text>
        {/each}
        {#each datos as d, i}
          {@const x = M.l + i * banda + (banda - barW) / 2}
          <!-- zona de hover más grande que la barra -->
          <rect class="hit" x={M.l + i * banda} y={M.t} width={banda} height={alto} on:mouseenter={() => (activo = i)} role="presentation" />
          {#if activo === i}<rect class="hover-bg" x={M.l + i * banda + 2} y={M.t} width={banda - 4} height={alto} rx="4" />{/if}
          <path class="bar" class:dim={activo !== null && activo !== i} d={barra(x, d.ingresos)} />
          <text class="eje" x={M.l + i * banda + banda / 2} y={H - 8} text-anchor="middle">{nombreMes(d.mes)}</text>
        {/each}
        <line class="base" x1={M.l} x2={W - M.r} y1={M.t + alto} y2={M.t + alto} />
      </svg>
      {#if activo !== null && datos[activo]}
        <div class="gi-tip" style="left: {((M.l + activo * banda + banda / 2) / W) * 100}%; top: {(y(datos[activo].ingresos) / H) * 100}%">
          <span>{nombreMes(datos[activo].mes, true)}</span>
          <strong>{formatoDinero(datos[activo].ingresos)}</strong>
          <span>{datos[activo].rentas} renta{datos[activo].rentas === 1 ? '' : 's'}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .gi-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .gi-head h3 { font-size: 16px; }
  .gi-hero { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 14px 0 8px; }
  .gi-hero strong { font-size: 28px; font-weight: 800; color: var(--ink); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .gi-hero span { color: var(--muted); font-size: 14px; }
  .gi-svg { position: relative; }
  svg { display: block; overflow: visible; }
  .grid { stroke: var(--line-2); stroke-width: 1; }
  .base { stroke: var(--line); stroke-width: 1; }
  .eje { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .bar { fill: var(--chart); transition: opacity 0.15s; }
  .bar.dim { opacity: 0.45; }
  .hit { fill: transparent; cursor: default; }
  .hover-bg { fill: var(--line-2); opacity: 0.6; pointer-events: none; }
  .gi-tip {
    position: absolute; transform: translate(-50%, calc(-100% - 10px)); pointer-events: none;
    display: flex; flex-direction: column; gap: 1px; padding: 8px 12px; white-space: nowrap;
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--sh-lg); font-size: 12px; color: var(--muted);
  }
  .gi-tip strong { font-size: 15px; color: var(--ink); font-variant-numeric: tabular-nums; }
  .gi-tabla { max-height: 260px; overflow-y: auto; border: 1px solid var(--line); border-radius: 10px; }
  .gi-tabla tbody tr { cursor: default; }
</style>
