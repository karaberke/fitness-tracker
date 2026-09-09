import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { db } from '../db';
import { createAuth } from './create';

// Same build-time exception as db/index.ts: no env exists while SvelteKit builds.
if (!env.BETTER_AUTH_SECRET && !building) {
	throw new Error('BETTER_AUTH_SECRET is not set. Generate one with `openssl rand -base64 32`.');
}
const secret = env.BETTER_AUTH_SECRET || 'build-placeholder';

// The app is reached from several addresses (LAN IP, Tailscale, a proxy), so
// there is no single public URL. Better Auth only uses this for cookie flags and
// links; an http:// value keeps the session cookie usable from every address.
const baseURL = env.ORIGIN || env.BETTER_AUTH_URL || `http://localhost:${env.PORT || 5173}`;

export const auth = createAuth({
	db,
	secret,
	baseURL,
	// Lets form actions that call `auth.api.*` set cookies on the SvelteKit response.
	plugins: [sveltekitCookies(getRequestEvent)]
});

/**
 * Same configuration with sign-up enabled and no cookie plugin: used only by
 * the admin page to create accounts. It never touches the caller's session.
 */
export const provisioning = createAuth({
	db,
	secret,
	baseURL,
	allowSignUp: true
});

export type SessionUser = typeof auth.$Infer.Session.user;
export type Session = typeof auth.$Infer.Session.session;
