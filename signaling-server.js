const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIO = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();

// 添加CORS中间件支持
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    
    next();
});

// 获取本机IP地址
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            // 跳过内部和非IPv4地址
            if ('IPv4' !== interface.family || interface.internal !== false) {
                continue;
            }
            ips.push(interface.address);
        }
    }
    
    return ips;
}

// 检查SSL证书文件是否存在
const certPath = path.join(__dirname, 'certs', 'cert.pem');
const keyPath = path.join(__dirname, 'certs', 'key.pem');
let server, httpsServer;

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    // 读取SSL证书
    const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };
    
    // 创建HTTPS服务器
    httpsServer = https.createServer(options, app);
    server = httpsServer;
    console.log('🔒 HTTPS服务器已启用');
} else {
    // 创建HTTP服务器（回退）
    server = http.createServer(app);
    console.log('⚠️  使用HTTP服务器（建议运行 npm run cert 生成SSL证书）');
}

const io = socketIO(server, {
    cors: {
        origin: "*", // 允许所有来源，生产环境请配置具体域名
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true // 支持Engine.IO v3客户端
});

// 静态文件服务 - 优化配置
// 为public目录设置静态资源服务
app.use('/public', express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path, stat) => {
        // 为不同类型的文件设置合适的缓存策略
        if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年缓存
        } else {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1天缓存
        }
    }
}));

// 为根目录设置静态文件服务（主要用于HTML文件）
app.use(express.static(path.join(__dirname, './'), {
    index: false, // 禁用默认的index.html查找，让路由处理
    setHeaders: (res, path, stat) => {
        // HTML文件不缓存
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// 路由配置 - 恢复所有前端页面路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/sender', (req, res) => {
    res.sendFile(path.join(__dirname, 'sender.html'));
});

app.get('/receiver', (req, res) => {
    res.sendFile(path.join(__dirname, 'receiver.html'));
});

// API 路由 - 提供系统信息API
app.get('/api/info', (req, res) => {
    res.json({
        name: 'WebRTC Audio Communication Server',
        version: '1.0.0',
        protocol: httpsServer ? 'HTTPS' : 'HTTP',
        port: PORT,
        connectedClients: Object.keys(clients).length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// 健康检查API
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 存储连接的客户端
let clients = {};

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // 客户端注册
    socket.on('register', (data) => {
        clients[socket.id] = {
            type: data.type, // 'sender' or 'receiver'
            socket: socket,
            connectedAt: new Date().toISOString()
        };
        console.log(`Client ${socket.id} registered as ${data.type}`);
        
        // 通知其他客户端有新连接
        socket.broadcast.emit('client-connected', {
            id: socket.id,
            type: data.type
        });
    });

    // 转发offer
    socket.on('offer', (data) => {
        console.log('Forwarding offer from', socket.id, 'to', data.targetId);
        if (clients[data.targetId]) {
            clients[data.targetId].socket.emit('offer', {
                offer: data.offer,
                senderId: socket.id
            });
        }
    });

    // 转发answer
    socket.on('answer', (data) => {
        console.log('Forwarding answer from', socket.id, 'to', data.targetId);
        if (clients[data.targetId]) {
            clients[data.targetId].socket.emit('answer', {
                answer: data.answer,
                senderId: socket.id
            });
        }
    });

    // 转发ICE candidate
    socket.on('ice-candidate', (data) => {
        console.log('Forwarding ICE candidate from', socket.id, 'to', data.targetId);
        if (clients[data.targetId]) {
            clients[data.targetId].socket.emit('ice-candidate', {
                candidate: data.candidate,
                senderId: socket.id
            });
        }
    });

    // 客户端断开连接
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        delete clients[socket.id];
        
        // 通知其他客户端有客户端断开
        socket.broadcast.emit('client-disconnected', {
            id: socket.id
        });
    });
});

const PORT = process.env.PORT || 3000;
const HTTP_PORT = process.env.HTTP_PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0'; // 监听所有网络接口

server.listen(PORT, HOST, () => {
    const protocol = httpsServer ? 'https' : 'http';
    const localIPs = getLocalIPs();
    
    console.log(`\n🚀 服务器启动成功！`);
    console.log(`📱 主服务器 (${protocol.toUpperCase()}): 监听 ${HOST}:${PORT}`);
    console.log(`\n🌐 可访问的地址：`);
    
    // 显示localhost访问地址
    console.log(`  localhost:`);
    console.log(`    ├─ 首页: ${protocol}://localhost:${PORT}/`);
    console.log(`    ├─ 推流端: ${protocol}://localhost:${PORT}/sender`);
    console.log(`    └─ 拉流端: ${protocol}://localhost:${PORT}/receiver`);
    
    // 显示IP地址访问地址
    if (localIPs.length > 0) {
        console.log(`\n  IP地址访问:`);
        localIPs.forEach((ip, index) => {
            const isLast = index === localIPs.length - 1;
            const prefix = isLast ? '    └─' : '    ├─';
            console.log(`    ${ip}:`);
            console.log(`    ${prefix} 首页: ${protocol}://${ip}:${PORT}/`);
            console.log(`    ${prefix} 推流端: ${protocol}://${ip}:${PORT}/sender`);
            console.log(`    ${prefix} 拉流端: ${protocol}://${ip}:${PORT}/receiver`);
            if (!isLast) console.log('');
        });
    }
    
    console.log(`\n🔗 API 端点:`);
    console.log(`    ├─ 系统信息: ${protocol}://localhost:${PORT}/api/info`);
    console.log(`    └─ 健康检查: ${protocol}://localhost:${PORT}/api/health`);
    
    if (httpsServer) {
        console.log(`\n⚠️  首次访问时，浏览器会显示安全警告（自签名证书）`);
        console.log(`   点击"高级"并选择"继续访问"即可正常使用`);
    }
    
    console.log(`\n💡 提示：`);
    console.log(`   - 同一局域网内的设备可以通过IP地址访问`);
    console.log(`   - 推荐使用HTTPS以获得最佳WebRTC体验`);
    console.log(`   - 已启用CORS跨域支持，支持不同域名访问`);
    console.log(`   - 静态文件服务已优化，支持缓存策略`);
});

// 如果启用了HTTPS，同时创建HTTP服务器用于重定向
if (httpsServer) {
    const redirectApp = express();
    
    redirectApp.use((req, res) => {
        const host = req.headers.host.split(':')[0];
        res.redirect(`https://${host}:${PORT}${req.url}`);
    });
    
    const httpServer = http.createServer(redirectApp);
    httpServer.listen(HTTP_PORT, HOST, () => {
        console.log(`🔄 HTTP重定向服务器: ${HOST}:${HTTP_PORT} -> HTTPS:${PORT}`);
    });
}