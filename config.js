const os = require('os');
const path = require('path');

// 获取本机IP地址
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if ('IPv4' !== interface.family || interface.internal !== false) {
                continue;
            }
            ips.push(interface.address);
        }
    }
    
    return ips;
}

// 环境配置
const config = {
    // 服务器配置
    server: {
        port: parseInt(process.env.PORT) || 3000,
        httpPort: parseInt(process.env.HTTP_PORT) || 3001,
        host: process.env.HOST || '0.0.0.0'
    },
    
    // SSL配置
    ssl: {
        enabled: process.env.SSL_ENABLED !== 'false', // 默认启用SSL
        certPath: process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'server.crt'),
        keyPath: process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'server.key'),
        autoGenerate: process.env.SSL_AUTO_GENERATE !== 'false' // 默认自动生成证书
    },
    
    // 环境信息
    env: {
        nodeEnv: process.env.NODE_ENV || 'development',
        isProduction: process.env.NODE_ENV === 'production',
        isDevelopment: process.env.NODE_ENV !== 'production'
    },
    
    // 日志配置
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        enabled: process.env.LOGGING_ENABLED !== 'false'
    },
    
    // 网络配置
    network: {
        localIPs: getLocalIPs(),
        publicDomain: process.env.PUBLIC_DOMAIN || null,
        allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*']
    },
    
    // WebRTC配置
    webrtc: {
        iceServers: process.env.ICE_SERVERS ? JSON.parse(process.env.ICE_SERVERS) : [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    }
};

// 导出配置
module.exports = config;

// 如果直接运行此文件，显示配置信息
if (require.main === module) {
    console.log('📋 当前配置信息：');
    console.log(JSON.stringify(config, null, 2));
} 