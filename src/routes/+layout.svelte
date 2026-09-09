<script lang="ts">
	// Self-hosted fonts (bundled and cached by the service worker; no Google request).
	import '@fontsource/instrument-serif/400.css';
	import '@fontsource/instrument-serif/400-italic.css';
	import '@fontsource-variable/jetbrains-mono/index.css';
	import './layout.css';
	import Toaster from '$lib/components/Toaster.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<!-- Icon set lives in static/ (and static/icons/) so the manifest can reference it by path. -->
	<link rel="icon" href="/favicon.ico" sizes="48x48" />
	<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#f2efe8" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="Fitness" />
</svelte:head>

{@render children()}
<Toaster />
