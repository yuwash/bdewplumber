<script lang="ts">
  import { onMount } from 'svelte'
  import puter from '@heyputer/puter.js'
  import { handleWordFile } from '../lib/bdewEBD';

  type TabId = 'kv' | 'fs' | 'os' | 'ai' | 'ui' | 'bdew'

  let activeTab: TabId = 'kv'

  const tabs = [
    { id: 'kv', label: 'KV store', description: 'Get/set and increment counters' },
    { id: 'fs', label: 'File system', description: 'Read and write a demo file' },
    { id: 'os', label: 'OS', description: 'User profile + version info' },
    { id: 'ai', label: 'AI chat', description: 'Prompt Puter AI and see replies' },
    { id: 'ui', label: 'UI helpers', description: 'File picker example' },
    { id: 'bdew', label: 'Parse BDEW EBD', description: 'Parse BDEW EBD files' }
  ]

  const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))
  const formatJSON = (data: Record<string, unknown>) => JSON.stringify(data, null, 2)
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

  const getDemoPath = () => {
    if (puter.appDataPath && puter.path?.join) {
      return puter.path.join(puter.appDataPath, 'puterjs-demo.txt')
    }
    return 'puterjs-demo.txt'
  }

  // KV
  let kvCount: number | undefined = undefined
  onMount(async () => {
    try {
      const counter = await puter.kv.get<number>('testCounter')
      kvCount = counter || 0
    } catch {
      kvCount = 0
    }
  })

  const incrementKv = async () => {
    kvCount = (kvCount || 0) + 1
    await puter.kv.incr('testCounter', 1)
  }

  const decrementKv = async () => {
    kvCount = (kvCount || 0) - 1
    await puter.kv.decr('testCounter', 1)
  }

  // FS
  const demoPath = getDemoPath()
  let fsStatus = 'Idle'
  let fsContents = ''

  const writeFile = async () => {
    fsStatus = 'Writing sample file...'
    try {
      await puter.fs.write(demoPath, `Hello from Puter.js at ${new Date().toISOString()}`)
      fsStatus = `Wrote sample text to ${demoPath}`
    } catch (error) {
      fsStatus = `Write failed: ${getErrorMessage(error)}`
    }
  }

  const readFile = async () => {
    fsStatus = 'Reading file...'
    try {
      const blob = await puter.fs.read(demoPath)
      fsContents = await blob.text()
      fsStatus = 'Read succeeded'
    } catch (error) {
      fsStatus = `Read failed: ${getErrorMessage(error)}`
    }
  }

  // OS
  let osStatus = 'Idle'
  let userInfo: Record<string, unknown> | null = null
  let versionInfo: Record<string, unknown> | null = null

  const fetchUser = async () => {
    osStatus = 'Fetching user...'
    try {
      const user = await puter.os.user()
      userInfo = user
      osStatus = 'User info loaded'
    } catch (error) {
      osStatus = `User lookup failed: ${getErrorMessage(error)}`
    }
  }

  const fetchVersion = async () => {
    osStatus = 'Fetching version...'
    try {
      const version = await puter.os.version()
      versionInfo = version
      osStatus = 'Version loaded'
    } catch (error) {
      osStatus = `Version lookup failed: ${getErrorMessage(error)}`
    }
  }

  // UI picker
  let uiResult = 'No UI actions yet'
  const openFile = async () => {
    try {
      const result = await puter.ui.showOpenFilePicker({ multiple: false })
      const file = Array.isArray(result) ? result[0] : result
      uiResult = file ? `Selected file: ${file.name || file.path || 'unknown'}` : 'No file selected'
    } catch (error) {
      uiResult = `File picker failed: ${getErrorMessage(error)}`
    }
  }

  // AI chat
  let aiInput = 'What can you do?'
  let aiStatus = 'Idle'
  let aiHistory: { user: string; ai: string }[] = []
  let aiLoading = false

  const sendChat = async () => {
    if (!aiInput.trim() || aiLoading) return
    aiLoading = true
    aiStatus = 'Sending to Puter AI...'
    try {
      const response = await puter.ai.chat(aiInput)
      const text = extractText(response)
      aiHistory = [...aiHistory, { user: aiInput.trim(), ai: text }]
      aiInput = ''
      aiStatus = 'Reply received'
    } catch (error) {
      aiStatus = `Error: ${getErrorMessage(error)}`
    } finally {
      aiLoading = false
    }
  }

  // BDEW
  let bdewStatus = 'Idle'
  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) {
      bdewStatus = 'No file selected'
      return
    }

    bdewStatus = 'Reading file...'
    bdewStatus = await handleWordFile(file)
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
    {#if activeTab === 'kv'}
      <section class="card stack">
        <div class="stack">
          <h2>Puter KV Store</h2>
          <a href="https://docs.puter.com/KV/" target="_blank" rel="noreferrer">KV documentation</a>
        </div>
        <div class="counter-row">
          <button disabled={kvCount === undefined} on:click={decrementKv}>-</button>
          <span class="counter-value">{kvCount !== undefined ? kvCount : 'loading...'}</span>
          <button disabled={kvCount === undefined} on:click={incrementKv}>+</button>
        </div>
        <p class="status">
          This counter is stored in Puter KV as <code>testCounter</code>.
        </p>
      </section>
    {:else if activeTab === 'fs'}
      <section class="card stack">
        <div class="stack">
          <h2>Puter File System</h2>
          <p>
            Creates and reads a sample file at <code>{demoPath}</code>. Uses your app data folder when available.
          </p>
        </div>

        <div class="actions">
          <button on:click={writeFile}>Write file</button>
          <button on:click={readFile}>Read file</button>
        </div>

        <p class="status">Status: {fsStatus}</p>

        {#if fsContents}
          <div class="callout">
            <strong>File contents</strong>
            <pre>{fsContents}</pre>
          </div>
        {/if}
      </section>
    {:else if activeTab === 'os'}
      <section class="card stack">
        <div class="stack">
          <h2>Puter OS</h2>
          <p>Fetches the current user and OS version metadata from Puter.</p>
        </div>

        <div class="actions">
          <button on:click={fetchUser}>Get current user</button>
          <button on:click={fetchVersion}>Get OS version</button>
        </div>

        <p class="status">Status: {osStatus}</p>

        {#if userInfo}
          <div class="callout">
            <strong>User info</strong>
            <pre>{formatJSON(userInfo)}</pre>
          </div>
        {/if}

        {#if versionInfo}
          <div class="callout">
            <strong>Version info</strong>
            <pre>{formatJSON(versionInfo)}</pre>
          </div>
        {/if}
      </section>
    {:else if activeTab === 'ai'}
      <section class="card stack">
        <div class="stack">
          <h2>Puter AI Chat</h2>
          <p>
            Send a short prompt to <code>puter.ai.chat</code> and see the reply.
          </p>
        </div>

        <div class="chat-box">
          <textarea rows="3" bind:value={aiInput} placeholder="Ask Puter AI anything..."></textarea>
          <div class="actions">
            <button disabled={aiLoading || !aiInput.trim()} on:click={sendChat}>
              {aiLoading ? 'Sending...' : 'Send message'}
            </button>
            <span class="status">Status: {aiStatus}</span>
          </div>
        </div>

        {#if aiHistory.length > 0}
          <div class="callout">
            <strong>Conversation</strong>
            <div class="chat-history">
              {#each aiHistory as turn, idx}
                <div class="chat-turn" data-key={idx}>
                  <div class="chat-label">You</div>
                  <div class="chat-bubble">{turn.user}</div>
                  <div class="chat-label">Puter AI</div>
                  <div class="chat-bubble alt">{turn.ai}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </section>
    {:else if activeTab === 'ui'}
      <section class="card stack">
        <div class="stack">
          <h2>Puter UI</h2>
          <p>
            Single-file picker example using <code>puter.ui.showOpenFilePicker</code>.
          </p>
        </div>

        <div class="actions">
          <button on:click={openFile}>Open file picker</button>
        </div>

        <div class="callout">
          <strong>Last UI result</strong>
          <p>{uiResult}</p>
        </div>
      </section>
    {:else if activeTab === 'bdew'}
      <section class="card stack">
        <div class="stack">
          <h2>Parse BDEW EBD</h2>
          <p>Parse BDEW EBD files.</p>
        </div>
        <div class="actions">
          <input type="file" accept=".docx" on:change={handleFileUpload} />
        </div>
        <p class="status">Status: {bdewStatus}</p>
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