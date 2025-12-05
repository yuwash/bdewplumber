<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="https://puter.com/images/logo.png" />
</svelte:head>

{@render children()}
