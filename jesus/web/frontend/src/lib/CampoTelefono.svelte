<script>
  // Campo de celular de México: solo dígitos y máximo 10. Si pegan "+52 999 123 4567" se queda con los 10 dígitos.
  import { limpiarTelefono } from './datos.js';

  export let value = '';
  export let placeholder = '9991234567';

  // Limpia también el valor inicial (p. ej. un teléfono guardado con +52)
  $: if (value && value !== limpiarTelefono(value)) value = limpiarTelefono(value);

  function alEscribir(e) {
    value = limpiarTelefono(e.currentTarget.value);
    e.currentTarget.value = value;
  }
</script>

<input class="input" type="tel" inputmode="numeric" autocomplete="tel" {placeholder} {value} on:input={alEscribir} />
<span class="muted small contador-tel" class:completo={value.length === 10}>{value.length}/10 dígitos</span>

<style>
  .contador-tel { align-self: flex-end; margin-top: -2px; }
  .completo { color: var(--ok); }
</style>
