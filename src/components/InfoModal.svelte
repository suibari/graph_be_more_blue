<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let showModal: boolean;

  function closeModal() {
    dispatch('close');
  }
</script>

{#if showModal}
  <div class="modal-overlay" on:click={closeModal}>
    <div class="modal-content" on:click|stopPropagation>
      <button class="close-button" on:click={closeModal}>&times;</button>
      <h2>GraphBeMoreBlue</h2>
      <p>GraphBeMoreBlueは<a href="https://www.skybemoreblue.com/" target="_blank">SkyBeMoreBlue</a>のネットワークグラフビューアです。</p>
      <p><b>アバタータップ</b>で、選択アカウントが切り替わります。</p>
      <p><b>グラフの末端のアバタータップ</b>で、グラフがひろがります。</p>
      <p>アバター間の線は、太線が相互紹介をあらわします。</p>
      <p>PC版の場合、マウスオーバーで紹介文が見れます。</p>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    padding: 30px;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    position: relative;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    color: #333; /* Darker text for readability */
  }

  .close-button {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
  }

  .modal-content h2 {
    margin-top: 0;
    color: #007bff; /* A nice blue for the heading */
  }

  .modal-content p {
    margin-bottom: 10px;
    line-height: 1.6;
  }
</style>
