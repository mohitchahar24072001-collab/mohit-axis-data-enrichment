module.exports = {
  apps: [{
    name: 'mohit-axis',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/Users/mohitchahar/Desktop/mohit/Profile /additional documents/claude/data-enrichment-app',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    watch: false,
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
  }]
};
