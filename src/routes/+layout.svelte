<script lang="ts">
	import '../app.css';
	import Snackbar from '$components/Snackbar.svelte';
	import InfoModal from '$components/InfoModal.svelte';
	
	let { children } = $props();
  let showInfoModal = $state(false);

  function toggleInfoModal() {
    showInfoModal = !showInfoModal;
  }
</script>

<svelte:head>
</svelte:head>

<div class="layout-container">
  <div class="header">
    <div class="app-title">GraphBeMoreBlue</div>
    <button class="info-button" on:click={toggleInfoModal}>i</button>
  </div>
  {@render children?.()}
  <Snackbar />
  <InfoModal bind:showModal={showInfoModal} on:close={() => showInfoModal = false} />
</div>

<style>
  .layout-container {
    position: relative;
    min-height: 100vh;
  }

  .header {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    z-index: 100;
  }

  .app-title {
    position: fixed;
    bottom: 20px;
    left: 20px;
    color: white;
    font-family: 'Exo 2', sans-serif;
    font-weight: 700;
    z-index: 100;
    user-select: none;
  }

  /* Responsive font sizes */
  @media (max-width: 768px) {
    .app-title {
      font-size: 1.5em; /* スマホ向け */
    }
  }

  @media (min-width: 769px) {
    .app-title {
      font-size: 2.5em; /* PC向け */
    }
  }

  .info-button {
    position: fixed;
    top: 20px;
    right: 20px;
    background: none;
    border: 2px solid white;
    border-radius: 50%;
    color: white;
    font-size: 1.2em;
    font-weight: bold;
    width: 30px;
    height: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    z-index: 100;
  }
</style>
