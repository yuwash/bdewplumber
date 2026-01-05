<script lang="ts">
  import { onMount } from 'svelte'
  import puter from '@heyputer/puter.js'
  import { handleWordFile, type EbdTitle, type CheckStep } from '../lib/bdewEBD';

  type TabId = 'bdew'

  let activeTab: TabId = 'bdew'

  const tabs = [
    { id: 'bdew', label: 'Parse BDEW EBD', description: 'Parse BDEW EBD files' }
  ]

  const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))
  const formatJSON = (data: Record<string, unknown> | any[] | string) => {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2)
  };
  const extractText = (response: unknown): string => {
    if (!response || typeof response !== 'object') return 'No response received.'
    const maybe = response as { message?: { content?: unknown } }
    const content = maybe.message?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      const first = content.find(part => typeof part === 'string')
      if (typeof first === 'string') return first
    }
    return JSON.stringify(content ?? response, null, 2)
  }

  // BDEW
  let bdewStatus = 'Idle'
  let ebdTitles: EbdTitle[] = []
  let allCheckSteps: Record<string, CheckStep[]> = {};
  let selectedEbdParaId: string = '';
  let selectedCheckSteps: CheckStep[] = [];
  let uploadedFileName: string = ''; // To store the uploaded file name

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) {
      bdewStatus = 'No file selected'
      return
    }

    uploadedFileName = file.name; // Store the file name

    bdewStatus = 'Reading file...'
    const result = await handleWordFile(file);
    if (typeof result === 'string') {
      bdewStatus = result;
      ebdTitles = [];
      allCheckSteps = {};
      selectedEbdParaId = '';
      selectedCheckSteps = [];
    } else {
      ebdTitles = result.ebdTitles;
      allCheckSteps = result.checkSteps;
      bdewStatus = `Successfully parsed ${ebdTitles.length} EBD titles.`;
      if (ebdTitles.length > 0) {
        selectedEbdParaId = ebdTitles[0].paraId;
      }
    }
  };

  const downloadAllCheckSteps = () => {
    if (Object.keys(allCheckSteps).length === 0) {
      alert('No check steps to download.');
      return;
    }

    const jsonContent = JSON.stringify(allCheckSteps, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    // Derive filename from uploaded file, replace .docx with .json
    const baseName = uploadedFileName.replace(/\.docx$/i, '');
    link.download = `${baseName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reactive statement to update selectedCheckSteps when selectedEbdParaId changes
  $: {
    if (selectedEbdParaId && allCheckSteps[selectedEbdParaId]) {
      selectedCheckSteps = allCheckSteps[selectedEbdParaId];
    } else {
      selectedCheckSteps = [];
    }
  }
</script>

<div class="page-wrap">
  <header class="hero">
    <div class="logo-row">
      <a href="https://puter.com" target="_blank" rel="noreferrer">
        <img src="https://puter.com/images/logo.png" class="logo" alt="Puter logo" />
      </a>
    </div>
    <h1>Puter.js Examples</h1>
    <p class="hero-subtitle">Quick, runnable snippets for the most common Puter.js APIs.</p>
  </header>

  <nav class="tab-list" aria-label="Puter.js example tabs">
    {#each tabs as tab}
      <button class={`tab ${tab.id === activeTab ? 'active' : ''}`} type="button" on:click={() => (activeTab = tab.id)}>
        <span class="tab-title">{tab.label}</span>
        <span class="tab-desc">{tab.description}</span>
      </button>
    {/each}
  </nav>

  <main class="tab-panel">
    {#if activeTab === 'bdew'}
      <section class="card stack">
        <div class="stack">
          <h2>Parse BDEW EBD</h2>
          <p>Parse BDEW EBD files.</p>
          <p>
            Get the Word file of Entscheidungsbaumdiagramme from
            <a href="https://bdew-mako.de">BDEW-Mako</a>.
          </p>
        </div>
        <div class="actions">
          <input type="file" accept=".docx" on:change={handleFileUpload} />
        </div>
        <p class="status">Status: {bdewStatus}</p>
        {#if ebdTitles.length > 0}
          <div class="stack">
            <div class="actions">
              <button on:click={downloadAllCheckSteps}>Download all</button>
            </div>
            <label for="ebd-select">Select EBD Title:</label>
            <select id="ebd-select" bind:value={selectedEbdParaId}>
              {#each ebdTitles as title}
                <option value={title.paraId}>{title.title}</option>
              {/each}
            </select>
          </div>
        {/if}
        {#if selectedCheckSteps.length > 0}
          <div class="callout">
            <strong>Check Steps for selected EBD Title:</strong>
            <pre>{formatJSON(selectedCheckSteps)}</pre>
          </div>
        {:else if selectedEbdParaId}
          <div class="callout">
            <strong>No Check Steps found for selected EBD Title.</strong>
          </div>
        {/if}
      </section>
    {/if}
  </main>
</div>

<style>
  :global(body) {
    background: var(--background, #0a0a0a);
    color: var(--foreground, #ededed);
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    min-height: 100vh;
  }

  :root {
    --panel-bg: rgba(255, 255, 255, 0.04);
    --panel-border: rgba(255, 255, 255, 0.12);
    --callout-bg: rgba(100, 108, 255, 0.08);
    --callout-border: rgba(100, 108, 255, 0.35);
  }

  :global(a) {
    font-weight: 600;
    color: #646cff;
    text-decoration: none;
  }

  :global(a:hover) {
    color: #535bf2;
  }

  :global(button) {
    border-radius: 8px;
    border: 1px solid transparent;
    padding: 0.6em 1.2em;
    font-size: 1em;
    font-weight: 600;
    font-family: inherit;
    background-color: #1a1a1a;
    color: #f9f9f9;
    cursor: pointer;
    transition: border-color 0.25s, transform 0.05s ease;
  }

  :global(button:hover) {
    border-color: #646cff;
    transform: translateY(-1px);
  }

  :global(button:focus),
  :global(button:focus-visible) {
    outline: 4px auto -webkit-focus-ring-color;
  }

  .page-wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1.5rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    text-align: center;
  }

  .logo {
    height: 5em;
    padding: 1em;
  }

  .logo-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 0.25rem;
  }

  .hero-subtitle {
    margin: 0;
    color: #9ca3af;
  }

  .tab-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 0.75rem;
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
    border: 1px solid var(--panel-border);
    background: var(--panel-bg);
    border-radius: 12px;
    padding: 0.85rem 1rem;
    text-align: left;
    color: inherit;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
  }

  .tab:hover {
    border-color: #646cff;
    transform: translateY(-1px);
  }

  .tab.active {
    border-color: #646cff;
    box-shadow: 0 0 0 1px #646cff55;
  }

  .tab-title {
    font-weight: 700;
    font-size: 1rem;
    line-height: 1.2;
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }

  .tab-desc {
    font-size: 0.9rem;
    color: #9ca3af;
    line-height: 1.35;
  }

  .tab-panel {
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    padding: 1.25rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  }

  .card {
    padding: 1.25rem;
    border-radius: 12px;
    background: transparent;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    align-items: flex-start;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
  }

  .counter-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .counter-value {
    font-size: 1.5rem;
    font-weight: 700;
    min-width: 70px;
    text-align: center;
  }

  .status {
    margin: 0;
    color: #9ca3af;
  }

  .callout {
    width: 100%;
    background: var(--callout-bg);
    border: 1px solid var(--callout-border);
    border-radius: 10px;
    padding: 0.75rem 0.9rem;
  }

  .callout pre {
    margin: 0.35rem 0 0;
    font-size: 0.9rem;
    overflow-x: auto;
  }

  .callout p {
    margin: 0.25rem 0 0;
  }

  pre {
    width: 100%;
    background: rgba(0, 0, 0, 0.35);
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    margin: 0;
    color: inherit;
  }

  .chat-box {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .chat-box textarea {
    width: 100%;
    border-radius: 10px;
    border: 1px solid var(--panel-border);
    background: rgba(255, 255, 255, 0.03);
    color: inherit;
    padding: 0.75rem;
    font-size: 1rem;
    resize: vertical;
  }

  .chat-history {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .chat-turn {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 0.25rem 0.75rem;
    align-items: start;
  }

  .chat-label {
    font-weight: 600;
    color: #9ca3af;
  }

  .chat-bubble {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--panel-border);
    border-radius: 10px;
    padding: 0.65rem 0.75rem;
    line-height: 1.4;
  }

  .chat-bubble.alt {
    background: var(--callout-bg);
    border-color: var(--callout-border);
  }

  @media (prefers-color-scheme: light) {
    :root {
      --panel-bg: #f7f9ff;
      --panel-border: #e2e8f0;
      --callout-bg: #eef2ff;
      --callout-border: #c7d2fe;
    }

    :global(button) {
      background-color: #f9f9f9;
      color: #111827;
    }

    .hero-subtitle,
    .tab-desc,
    .status {
      color: #4b5563;
    }

    pre {
      background: #e5e7eb;
    }

    .tab-panel {
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }
  }
</style>
