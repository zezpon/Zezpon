module.exports = {
  apps: [
    {
      name: "zezpon",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      max_memory_restart: "500M",
      restart_delay: 3000,
      watch: false
    }
  ]
};
