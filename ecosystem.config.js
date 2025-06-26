module.exports = {
  apps: [{
    name: 'qcc-staking-backend',
    script: 'src/app.js',
    cwd: '/home/maxpia/qcc_staking/qcc-staking_backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    restart_delay: 4000,
    watch: false,
    ignore_watch: ['node_modules', 'logs', '.git', 'database.sqlite'],
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
}; 