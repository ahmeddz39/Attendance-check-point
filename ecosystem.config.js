module.exports = {
  apps: [
    {
      name: 'attendance-app',
      script: 'backend/src/server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      watch: false,
    },
  ],
}
