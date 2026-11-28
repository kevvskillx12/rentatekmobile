<script>
  import { slide } from 'svelte/transition';
  import Icono from '../lib/Icono.svelte';

  export let pagina = 'ayuda'; // ayuda | terminos | privacidad

  const FAQ = [
    { g: 'Para clientes', items: [
      ['¿Cuánto cuesta usar Rentatek?', 'Buscar equipos, enviar solicitudes y usar el chat es gratis. Solo pagas la renta acordada directamente al proveedor.'],
      ['¿Cómo elijo las fechas de renta?', 'En la ficha del equipo toca "Elegir fechas y solicitar". En el calendario marca el día de inicio y luego el de fin. Los días ya rentados aparecen tachados y no se pueden elegir.'],
      ['¿Se cobra algo al enviar la solicitud?', 'No. La solicitud solo avisa al proveedor; él la acepta o la rechaza y te llega una notificación.'],
      ['¿Cómo me pongo de acuerdo con el proveedor?', 'Cada solicitud tiene su propio chat. Ábrela desde "Mis rentas" y entra a la pestaña "Mensajes". Cuando la aceptan, también ves su WhatsApp y correo.'],
      ['¿Puedo cancelar?', 'Sí, mientras la solicitud esté pendiente puedes cancelarla desde "Mis rentas". Si ya fue aceptada, platícalo con el proveedor por el chat.'],
      ['¿Cómo dejo una reseña?', 'Cuando tu renta aceptada ya empezó, abre la solicitud en "Mis rentas" y califica de 1 a 5 estrellas. Tu opinión ayuda a otros clientes.']
    ] },
    { g: 'Para proveedores', items: [
      ['¿Cómo publico mi maquinaria?', 'Crea una cuenta eligiendo "Ofrezco maquinaria" y en tu panel toca "Publicar equipo". Llena nombre, categoría, ciudad, precio por día y especificaciones.'],
      ['¿Qué significa "Proveedor verificado"?', 'Que validamos tu identidad con tu INE: tu CURP, que coincida con tu nombre y tu RFC. Tus equipos muestran una insignia que da más confianza. Hazlo desde tu panel con una foto de tu INE; es automático e inmediato.'],
      ['¿Qué pasa cuando acepto una solicitud?', 'El cliente recibe un aviso y esas fechas quedan bloqueadas en el calendario del equipo para que nadie más las pida.'],
      ['¿Dónde veo cuánto he ganado?', 'En la pestaña "Resumen" de tu panel está la gráfica de ingresos por mes; también puedes verla como tabla.']
    ] },
    { g: 'Cuenta y seguridad', items: [
      ['Olvidé mi contraseña', 'En "Iniciar sesión" toca "¿Olvidaste tu contraseña?" y escribe tu correo. Te llegará un enlace válido por 1 hora.'],
      ['¿Cómo cambio mis datos?', 'Desde el menú de tu cuenta entra a "Mi perfil". Ahí cambias tu nombre, teléfono, empresa y contraseña.'],
      ['¿Puedo usar Rentatek en el celular?', 'Sí. Ábrelo en el navegador del celular y elige "Instalar app" o "Agregar a pantalla de inicio".']
    ] }
  ];

  let abierta = '0-0';
</script>

<section class="page-head">
  <div class="container page-head-inner">
    <div>
      <p class="eyebrow">{pagina === 'ayuda' ? 'Ayuda' : 'Legal'}</p>
      <h1>{pagina === 'ayuda' ? 'Preguntas frecuentes' : pagina === 'terminos' ? 'Términos y condiciones' : 'Aviso de privacidad'}</h1>
      {#if pagina !== 'ayuda'}<p class="page-sub">Última actualización: 26 de noviembre de 2026</p>{/if}
    </div>
  </div>
  <div class="container">
    <div class="tabs">
      <a class="tab-link" class:active={pagina === 'ayuda'} href="#/ayuda">Preguntas frecuentes</a>
      <a class="tab-link" class:active={pagina === 'terminos'} href="#/terminos">Términos</a>
      <a class="tab-link" class:active={pagina === 'privacidad'} href="#/privacidad">Privacidad</a>
    </div>
  </div>
</section>

<section class="container dash info-wrap">
  {#if pagina === 'ayuda'}
    {#each FAQ as grupo, gi}
      <h2 class="faq-grupo">{grupo.g}</h2>
      <div class="card faq">
        {#each grupo.items as [p, r], i}
          {@const k = `${gi}-${i}`}
          <div class="faq-item">
            <button on:click={() => (abierta = abierta === k ? '' : k)} aria-expanded={abierta === k}>
              <span>{p}</span>
              <span class="chev" class:girado={abierta === k}><Icono nombre="chevron" tam={18} /></span>
            </button>
            {#if abierta === k}<p transition:slide={{ duration: 180 }}>{r}</p>{/if}
          </div>
        {/each}
      </div>
    {/each}
    <div class="card card-pad faq-cta">
      <div><h3>¿No encontraste tu respuesta?</h3><p class="muted">Escríbenos y te ayudamos.</p></div>
      <a class="btn btn-primary" href="#/contacto"><Icono nombre="mail" tam={16} /> Contactar</a>
    </div>
  {:else if pagina === 'terminos'}
    <article class="card legal">
      <h3>1. Qué es Rentatek</h3>
      <p>Rentatek es una plataforma que conecta a personas y empresas que necesitan maquinaria pesada ("Clientes") con quienes la ofrecen en renta ("Proveedores"). Rentatek no es dueño de los equipos ni parte del contrato de renta que celebran Cliente y Proveedor.</p>
      <h3>2. Cuentas</h3>
      <p>Para solicitar o publicar equipos necesitas una cuenta con datos verdaderos. Eres responsable de mantener tu contraseña en secreto y de la actividad que ocurra en tu cuenta. Podemos suspender cuentas que incumplan estos términos.</p>
      <h3>3. Publicaciones</h3>
      <p>El Proveedor garantiza que tiene derecho a rentar los equipos que publica, que la información (precio, estado, especificaciones) es correcta y que el equipo cuenta con el mantenimiento y los permisos necesarios para operar.</p>
      <h3>4. Solicitudes y rentas</h3>
      <p>Una solicitud no es un contrato ni genera cobro. La renta se formaliza cuando el Proveedor la acepta y ambas partes acuerdan entrega, pago, depósito, seguro y condiciones de uso. Los precios mostrados son estimados por día.</p>
      <h3>5. Reseñas</h3>
      <p>Las reseñas deben basarse en una renta real y ser respetuosas. Podemos retirar contenido ofensivo, falso o que incluya datos personales de terceros.</p>
      <h3>6. Responsabilidad</h3>
      <p>Rentatek no responde por daños derivados del uso de los equipos, incumplimientos entre Cliente y Proveedor, ni por la exactitud de la información que publican los usuarios. Recomendamos revisar el equipo al recibirlo y documentar su estado.</p>
      <h3>7. Cambios</h3>
      <p>Podemos actualizar estos términos; avisaremos dentro de la plataforma cuando haya cambios importantes. Si sigues usando Rentatek después de un cambio, aceptas la nueva versión.</p>
      <p class="muted small nota-legal">Este texto es un modelo general. Antes de operar comercialmente, haz que lo revise un abogado.</p>
    </article>
  {:else}
    <article class="card legal">
      <h3>Responsable</h3>
      <p>Rentatek es responsable del tratamiento de los datos personales que nos proporcionas, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.</p>
      <h3>Datos que recabamos</h3>
      <p>Nombre, correo electrónico, teléfono, empresa, ciudad de los equipos, mensajes del chat, solicitudes y reseñas. No recabamos datos sensibles ni datos de tarjetas bancarias.</p>
      <h3>Para qué los usamos</h3>
      <p>Para crear y administrar tu cuenta, mostrar tus equipos, enviar tus solicitudes al proveedor, permitir el chat entre las partes, mandarte notificaciones y mejorar el servicio. Tu teléfono y correo solo se comparten con la otra parte de una renta.</p>
      <h3>Tus derechos ARCO</h3>
      <p>Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos escribiendo desde la página de <a href="#/contacto">contacto</a>. Tus datos de perfil los puedes cambiar en cualquier momento desde "Mi perfil".</p>
      <h3>Seguridad</h3>
      <p>Las contraseñas se guardan cifradas (bcrypt) y nunca en texto plano. Los enlaces para restablecer la contraseña caducan en una hora.</p>
      <p class="muted small nota-legal">Este texto es un modelo general. Antes de operar comercialmente, haz que lo revise un abogado.</p>
    </article>
  {/if}
</section>

<style>
  .info-wrap { max-width: 860px; }
  .tab-link { position: relative; padding: 12px 14px 14px; font-size: 14px; font-weight: 600; color: var(--muted); text-decoration: none; white-space: nowrap; }
  .tab-link:hover, .tab-link.active { color: var(--ink); }
  .tab-link.active::after { content: ''; position: absolute; left: 10px; right: 10px; bottom: 0; height: 2px; border-radius: 2px; background: var(--brand); }
  .faq-grupo { font-size: 18px; margin: 28px 0 12px; }
  .faq-grupo:first-child { margin-top: 0; }
  .faq { overflow: hidden; }
  .faq-item + .faq-item { border-top: 1px solid var(--line-2); }
  .faq-item button { display: flex; justify-content: space-between; align-items: center; gap: 16px; width: 100%; padding: 16px 20px; text-align: left; font-weight: 600; color: var(--ink); }
  .faq-item button:hover { background: var(--line-2); }
  .faq-item p { padding: 0 20px 18px; color: var(--muted); }
  .faq-cta { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 28px; }
  .legal { padding: 28px 32px; }
  .legal h3 { font-size: 17px; margin: 22px 0 6px; }
  .legal h3:first-child { margin-top: 0; }
  .legal p { color: var(--text); }
  .legal a { color: var(--brand-ink); font-weight: 600; }
  .nota-legal { margin-top: 24px; padding-top: 14px; border-top: 1px solid var(--line-2); }
  @media (max-width: 600px) { .legal { padding: 22px 20px; } }
</style>
