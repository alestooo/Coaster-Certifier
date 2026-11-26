<script lang="ts">
  import type { AreaInsight } from "../../lib/audit";

  let { insight }: { insight: AreaInsight | null | undefined } = $props();
</script>

{#if insight}
  <p class="status {insight.tone}"><i aria-hidden="true"></i>{insight.text}</p>
{/if}

<style>
  .status {
    display: flex;
    gap: 8px;
    margin: 0 0 6px;
    padding: 9px 11px;
    border-radius: 10px;
    background: var(--surface-soft);
    color: var(--text-soft);
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.45;
  }

  i {
    flex: none;
    width: 8px;
    height: 8px;
    margin-top: 5px;
    border-radius: 50%;
    background: var(--muted);
  }

  .ok {
    background: var(--success-soft);
    color: #1f6b4e;
  }

  .ok i {
    background: var(--success);
  }

  .warn {
    background: var(--accent-soft);
    color: #8a5a12;
  }

  .warn i {
    background: var(--accent);
  }

  .bad {
    background: var(--danger-soft);
    color: #9d2a39;
  }

  .bad i {
    background: var(--danger);
  }
</style>
