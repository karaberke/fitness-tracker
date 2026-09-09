/**
 * Production entry point (`pnpm start` and the Docker image).
 *
 * The app is reached at several addresses: the machine's LAN IP, its Tailscale
 * IP or MagicDNS name, or an HTTPS reverse proxy such as `tailscale serve`.
 * SvelteKit checks form posts against the origin it thinks it is served from, so
 * that origin has to follow the address the browser actually used. The Node
 * adapter derives it from the `x-forwarded-*` headers a proxy sets; for direct
 * requests we fill those in from the request itself. Set `ORIGIN` to pin one
 * public URL instead (the adapter then ignores these headers).
 */
import http from 'node:http';
import process from 'node:process';

process.env.PROTOCOL_HEADER ||= 'x-forwarded-proto';
process.env.HOST_HEADER ||= 'x-forwarded-host';

// Imported after the env is set: the adapter reads it at import time.
const { handler } = await import('./build/handler.js');

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
	req.headers['x-forwarded-proto'] ||= 'http';
	req.headers['x-forwarded-host'] ||= req.headers.host;
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
});

server.listen(port, host, () => {
	console.log(`Fitness Tracker listening on http://${host}:${port}`);
});

const shutdown = (signal) => {
	console.log(`${signal} received, shutting down`);
	server.close(() => process.exit(0));
	setTimeout(() => process.exit(0), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
