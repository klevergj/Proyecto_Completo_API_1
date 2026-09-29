module.exports = {
  apps: [
    {
      name: 'backend-api',
      script: './server.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 8080
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: '44.197.171.122',
      ref: 'origin/main',
      repo: 'git@github.com:klevergj/Proyecto_Completo_API_1.git',
      path: '/var/www/tu-app',
      'post-deploy': 'cd backend && npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};