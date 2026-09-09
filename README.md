# Fitness Tracker

A self-hosted workout log for a few people who share a gym: shared exercise and machine catalog, personal machine setups, set-by-set logging that saves as you go, and history that never changes after the fact. Built with SvelteKit, Tailwind CSS, PostgreSQL (Drizzle ORM) and Better Auth. Designed for a phone at the gym.

## Deploy on your server

You need [Docker](https://docs.docker.com/engine/install/) (with the compose plugin) and Git on the machine. If you also run [Tailscale](https://tailscale.com) on it, the app is reachable from anywhere on your tailnet without opening any ports.

1. **Get the code**

   ```sh
   git clone <this repository> fitness-tracker
   cd fitness-tracker
   ```

2. **Create your `.env`**

   ```sh
   cp .env.example .env
   openssl rand -base64 32      # paste the output as BETTER_AUTH_SECRET
   ```

   Open `.env` and set at least:

   | Variable                                      | What to put                                                                            |
   | --------------------------------------------- | -------------------------------------------------------------------------------------- |
   | `POSTGRES_PASSWORD`                           | Any password for the database (letters, digits, `-` `_` `.`). Only used inside Docker. |
   | `BETTER_AUTH_SECRET`                          | The random string from `openssl rand -base64 32`.                                      |
   | `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Your own account. It is created on the first start and can manage other accounts.      |
   | `APP_PORT`                                    | The port to serve on (default `3000`).                                                 |

   `docker compose` refuses to start while any of these is missing.

3. **Start it**

   ```sh
   docker compose -f compose.prod.yaml up -d --build
   ```

   The first run builds the image (a few minutes), starts PostgreSQL, applies the database migrations and creates the admin account. Data lives in the Docker volume `fitness-tracker_pgdata` and survives restarts, updates and `docker compose down`.

4. **Open it**

   - At home: `http://<LAN IP of the machine>:<APP_PORT>` (find the IP with `hostname -I` on Linux or `ipconfig getifaddr en0` on macOS).
   - Away from home: `http://<Tailscale name or 100.x address>:<APP_PORT>` from any device signed into your tailnet.
   - Optional HTTPS on the tailnet: `tailscale serve --bg <APP_PORT>` and open `https://<machine>.<tailnet>.ts.net`.

   Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then add everyone else under **Settings → Accounts**. Each person can change their own name, email and password under Settings.

   On a phone, add the site to the home screen (iPhone: Share → _Add to Home Screen_). It then opens full-screen like an app, and the code, fonts and icons are cached on the device so only the data is fetched when switching pages.

### Day-to-day

```sh
docker compose -f compose.prod.yaml logs -f app          # logs
docker compose -f compose.prod.yaml down                  # stop (data is kept)
git pull && docker compose -f compose.prod.yaml up -d --build   # update
```

Changing `ADMIN_PASSWORD` in `.env` later does nothing: the account already exists. Change passwords in Settings, or reset one from the server:

```sh
docker compose -f compose.prod.yaml exec app node build/create-user.js --email you@example.com --reset-password
```

Set `ORIGIN=https://your.public.url` in `.env` and pass it to the `app` service only if you put the app behind an internet-facing reverse proxy; for LAN and Tailscale access leave it unset.

### Backup and restore

```sh
# backup (compressed)
docker compose -f compose.prod.yaml exec -T db pg_dump -U root -d local -Fc > backup-$(date +%F).dump
# restore (replaces the current contents)
docker compose -f compose.prod.yaml exec -T db pg_restore -U root -d local --clean --if-exists < backup-2026-09-08.dump
```

Adjust `-U`/`-d` if you changed `POSTGRES_USER`/`POSTGRES_DB`. Schedule the backup with cron and copy the dumps off the machine. Never run `docker compose down -v`: it deletes the volume.

## Features

- Accounts with email + password; no public sign-up. Admins create and remove accounts (removing one deletes that person's data; the shared catalog stays).
- Shared catalog of exercises and machines (name, gym, model, notes). An exercise can be linked to the machine it needs; the exercise page shows the machine and your setup, and adding it to a workout pre-selects both.
- Personal machine setups (seat, backrest, attachment…) per user, copied into a workout when you pick the machine.
- Start / resume / finish workouts, add exercises with or without a machine, log sets (reps, weight, kg/lb, bodyweight allowed). Every set is saved immediately.
- The machine setup in force is snapshotted onto each set, so later changes never rewrite history. Change the setup between sets when needed.
- History by date; open a workout to view, edit or delete it. Archived catalog entries stay visible in old workouts.

## Development

Requires Node.js 22+ and [pnpm](https://pnpm.io); PostgreSQL runs in Docker.

```sh
pnpm install
cp .env.example .env         # set POSTGRES_PASSWORD, DATABASE_URL (matching it) and BETTER_AUTH_SECRET
pnpm db:start                # PostgreSQL in Docker, bound to 127.0.0.1 only
pnpm db:migrate
pnpm user:create --email you@example.com --name "Your Name" --admin
pnpm dev                     # http://localhost:5173
```

Other scripts:

```sh
pnpm check / pnpm lint / pnpm format      # svelte-check, Prettier + ESLint
pnpm test                                 # Vitest integration tests (uses a separate fitness_test database)
pnpm build && pnpm start                  # production build, then `node server.js`
pnpm db:generate && pnpm db:migrate       # after editing src/lib/server/db/schema.ts; commit the drizzle/ output
pnpm seed:dev                             # demo accounts alex@/sam@example.com (password devpass123) — never on a real database
pnpm user:create --email x --reset-password   # reset a password (set USER_PASSWORD to skip the prompt)
```

### Environment variables

| Variable                                            | Used by             | Description                                                                               |
| --------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker Compose      | Database credentials. Applied only when the volume is first created.                      |
| `POSTGRES_PORT`                                     | Docker Compose      | Host port for the database (default `5432`), always bound to `127.0.0.1`.                 |
| `DATABASE_URL`                                      | pnpm scripts, tests | `postgres://USER:PASSWORD@localhost:PORT/DB`; the Docker deployment builds its own.       |
| `BETTER_AUTH_SECRET`                                | app                 | Signs session cookies. Changing it signs everyone out.                                    |
| `APP_PORT`                                          | `compose.prod.yaml` | Published port of the deployed app (default `3000`).                                      |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`       | `compose.prod.yaml` | First administrator, created on the first start only.                                     |
| `TZ`                                                | app                 | Time zone for server-side dates (`UTC` in Docker by default).                             |
| `ORIGIN`                                            | app                 | Optional: pin one public URL behind an internet-facing proxy. Unset = follow the request. |
| `HOST`, `PORT`                                      | `pnpm start`        | Listen address (`0.0.0.0`, `3000`). Fixed inside the container.                           |

### Project layout

```
src/lib/server/db/          Drizzle schema, migrations config, connection
src/lib/server/auth/        Better Auth setup, requireUser() / requireAdmin() guards
src/lib/server/*.ts         Feature modules (workouts, exercises, machines, account, admin): all DB access
src/lib/components/         Reusable UI
src/routes/(app)/           Authenticated pages; src/routes/login is the only public page
src/tests/                  Vitest integration tests
scripts/                    create-user.ts, bootstrap.ts (Docker start-up), seed-dev.ts
drizzle/                    SQL migrations (committed)
server.js                   Production entry point; derives the origin from each request
Dockerfile, compose.prod.yaml   Deployment. compose.yaml is the development database only
```

Every load function and form action resolves the user from the session and passes that id into the feature modules; ownership is enforced in SQL, so someone else's record looks like a missing one (404). All npm packages are devDependencies on purpose: the Node adapter and esbuild bundle them into `build/`, so the runtime image has no `node_modules`.
