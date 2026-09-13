// pm2 process file for the user-owned Astro dev server.
// Managed by the user in their own terminal — agents must NOT touch it.
// See AGENTS.md ("Dev server ownership").
module.exports = {
	apps: [
		{
			name: "astro-dev",
			cwd: __dirname,
			script: "./node_modules/.bin/astro",
			args: "dev --host --port 4321 --strictPort",
			interpreter: "node",
			node_args: "--trace-deprecation",
			autorestart: true,
			exp_backoff_restart_delay: 2000,
			max_memory_restart: "2G",
			min_uptime: "10s",
			env: {
				NODE_ENV: "development",
				DEBUG: "astro:router,astro:ssr",
				// Force foreground mode: without this, Astro's agent detection
				// (isRunByAgent) sees pm2's daemon env, detaches into background
				// mode with a 30s boot timeout, and pm2 ends up supervising a
				// wrapper instead of the server. With this set, `astro dev`
				// runs the server in-process and manages .astro/dev.json itself.
				ASTRO_DEV_BACKGROUND: "1",
			},
		},
	],
};
