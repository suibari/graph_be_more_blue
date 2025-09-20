<script lang="ts">
  import { snackbar, hideSnackbar } from '$lib/stores/snackbar';
  import { quintOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';

  $: if ($snackbar.show) {
    setTimeout(() => {
      hideSnackbar();
    }, 3000); // 3秒後に自動的に非表示
  }
</script>

{#if $snackbar.show}
  <div
    class="snackbar-container"
    class:snackbar-success={$snackbar.type === 'success'}
    class:snackbar-error={$snackbar.type === 'error'}
    class:snackbar-info={$snackbar.type === 'info'}
    transition:fly={{ y: 50, duration: 300, easing: quintOut }}
  >
    <p>{$snackbar.message}</p>
    {#if $snackbar.link}
      <a href={$snackbar.link.href} target="_blank" rel="noopener noreferrer">
        {$snackbar.link.text}
      </a>
    {/if}
    <button on:click={hideSnackbar}>&times;</button>
  </div>
{/if}

<style>
  .snackbar-container {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    border-radius: 5px;
    color: white;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }

  .snackbar-success {
    background-color: #4CAF50; /* Green */
  }

  .snackbar-error {
    background-color: #f44336; /* Red */
  }

  .snackbar-info {
    background-color: #2196F3; /* Blue */
  }

  .snackbar-container p {
    margin: 0;
    font-size: 16px;
  }

  .snackbar-container a {
    color: white;
    text-decoration: underline;
    font-weight: bold;
  }

  .snackbar-container button {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    margin-left: auto;
  }
</style>
