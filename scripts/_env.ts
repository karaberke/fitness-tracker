import { createDb } from '../src/lib/server/db/client';

/** Shared bootstrap for CLI scripts: reads env, connects to the database. */
export function connect() {
	const url = process.env.DATABASE_URL;
	if (!url) {
		console.error('DATABASE_URL is not set. Run with `pnpm <script>` so `.env` is loaded.');
		process.exit(1);
	}
	return createDb(url);
}

export function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(`${name} is not set in .env`);
		process.exit(1);
	}
	return value;
}

/** Minimal `--flag value` / `--flag` parser. */
export function parseArgs(argv: string[]): Record<string, string | true> {
	const out: Record<string, string | true> = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith('--')) continue;
		const key = a.slice(2);
		const next = argv[i + 1];
		if (next && !next.startsWith('--')) {
			out[key] = next;
			i++;
		} else {
			out[key] = true;
		}
	}
	return out;
}

const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const BACKSPACE = String.fromCharCode(8);
const DEL = String.fromCharCode(127);

/** Prompts for a password without echoing it to the terminal. */
export async function promptSecret(question: string): Promise<string> {
	const { stdin, stdout } = process;
	if (!stdin.isTTY) {
		console.error(
			'No TTY available: pass the password via the USER_PASSWORD environment variable.'
		);
		process.exit(1);
	}
	stdout.write(question);
	return new Promise((resolve) => {
		let value = '';
		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding('utf8');
		const onData = (chunk: string) => {
			for (const ch of chunk) {
				if (ch === '\n' || ch === '\r' || ch === CTRL_D) {
					stdin.setRawMode(false);
					stdin.pause();
					stdin.off('data', onData);
					stdout.write('\n');
					resolve(value);
					return;
				}
				if (ch === CTRL_C) process.exit(130);
				if (ch === DEL || ch === BACKSPACE) value = value.slice(0, -1);
				else value += ch;
			}
		};
		stdin.on('data', onData);
	});
}
