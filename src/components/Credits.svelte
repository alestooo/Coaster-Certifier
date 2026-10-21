<script lang="ts">
  let {
    open = false,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  } = $props();

  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });
</script>

<dialog
  class="credits-dialog"
  bind:this={dialog}
  aria-labelledby="credits-title"
  onclose={onClose}
>
  <h2 id="credits-title">Créditos</h2>

  <p><strong>Coaster-Certifier</strong></p>
  <p>Proyecto 1: Certificador de montaña rusa</p>

  <h3>Grupo A</h3>

  <ul>
    <li>Alejandro Soto Víquez</li>
    <li>Dylan Josué Chaves Hernández</li>
    <li>Minor Andrés Mora Vargas</li>
  </ul>

  <p>Universidad CENFOTEC · Escuela de Fundamentos</p>
  <p>Física I · FUN-18 · FCV1 · 2026-C3</p>
  <p>Docente: Andrés Castro Núñez</p>

  <form method="dialog">
    <button class="game-button secondary" type="submit">
      Cerrar
    </button>
  </form>
</dialog>