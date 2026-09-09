/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

/**
 * Caches the app shell (hashed JS/CSS chunks, fonts, icons) so repeat visits
 * and tab switches load code instantly, also when added to the iPhone home
 * screen. Pages and data are private and always come from the network.
 */
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `fitness-tracker-${version}`;
const ASSETS = new Set([...build, ...files]);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll([...ASSETS]))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	// Drop caches from previous deployments.
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== sw.location.origin || !ASSETS.has(url.pathname)) return;
	event.respondWith(
		caches
			.open(CACHE)
			.then((cache) => cache.match(url.pathname))
			.then((cached) => cached ?? fetch(event.request))
	);
});
