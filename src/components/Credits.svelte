<script lang="ts">
  import Dialog from "./ui/Dialog.svelte";

  let {
    open = false,
    onClose
  }: {
    open: boolean;
    onClose: () => void;
  } = $props();

  let dialog = $state<ReturnType<typeof Dialog>>();

  $effect(() => {
    if (!dialog) return;

    if (open && !dialog.isOpen()) dialog.showModal();
    else if (!open && dialog.isOpen()) dialog.close();
  });
</script>

<Dialog bind:this={dialog} class="credits-dialog" tone="night" title="Créditos" {onClose}>
  <div class="credits-body">
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
  </div>
</Dialog>
