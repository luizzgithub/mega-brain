module.exports = {
    apps: [
        {
            name: "MegaBrain",
            script: "src/server.js",
            watch: false,
            max_memory_restart: "256M",
            restart_delay: 5500,
            log_type: "json",
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            error_file: "logs/pm2-whisper-error.log",
            out_file: null,
            merge_logs: true,
            log_memory_usage: true,
            log_cpu_usage: true,
            env: {
                NODE_ENV: "production"
            }
        }
    ]
} 