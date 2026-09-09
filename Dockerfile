# Build stage: install everything and compile the SvelteKit app plus the CLI scripts.
# Every package is a devDependency on purpose: the Node adapter and esbuild bundle
# them into ./build, so the runtime image needs no node_modules at all.
FROM node:24-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@12.3.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime stage: Node plus the self-contained build output.
FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY package.json server.js ./
COPY drizzle ./drizzle
COPY --from=build /app/build ./build
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -q --spider http://127.0.0.1:3000/login || exit 1
# Migrate + ensure the admin account, then serve.
CMD ["sh", "-c", "node build/bootstrap.js && exec node server.js"]
