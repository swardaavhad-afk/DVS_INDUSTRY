module.exports = {
  apps: [
    {
      name: 'dvs-industry-api',
      script: './dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '512M',
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
