const fs = require('fs');
const path = require('path');

console.log('📦 WebRTC前端资源部署打包工具\n');

// 需要部署的前端文件列表
const frontendFiles = [
    'index.html',
    'sender.html',
    'receiver.html'
];

// 需要部署的目录列表
const frontendDirs = [
    'public'
];

// 创建部署目录
function createDeployDir() {
    console.log('1. 创建前端部署目录...');
    
    const deployDir = path.join(__dirname, 'deploy');
    
    // 清理旧的部署目录
    if (fs.existsSync(deployDir)) {
        console.log('   🗑️  清理旧的部署目录...');
        fs.rmSync(deployDir, { recursive: true, force: true });
    }
    
    // 创建新的部署目录
    fs.mkdirSync(deployDir, { recursive: true });
    console.log(`   ✅ 前端部署目录已创建: ${deployDir}`);
    
    return deployDir;
}

// 复制前端文件
function copyFrontendFiles(deployDir) {
    console.log('\n2. 复制前端文件...');
    
    let copiedFiles = 0;
    let skippedFiles = 0;
    
    // 复制HTML文件
    frontendFiles.forEach(file => {
        const srcPath = path.join(__dirname, file);
        const destPath = path.join(deployDir, file);
        
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`   ✅ 已复制: ${file}`);
            copiedFiles++;
        } else {
            console.log(`   ⚠️  跳过不存在的文件: ${file}`);
            skippedFiles++;
        }
    });
    
    // 复制静态资源目录
    frontendDirs.forEach(dir => {
        const srcPath = path.join(__dirname, dir);
        const destPath = path.join(deployDir, dir);
        
        if (fs.existsSync(srcPath)) {
            copyDirectory(srcPath, destPath);
            console.log(`   ✅ 已复制目录: ${dir}`);
            copiedFiles++;
        } else {
            console.log(`   ⚠️  跳过不存在的目录: ${dir}`);
            skippedFiles++;
        }
    });
    
    console.log(`   📊 复制完成: ${copiedFiles} 个文件/目录, ${skippedFiles} 个跳过`);
}

// 递归复制目录
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    
    items.forEach(item => {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

// 修改前端文件以适配静态部署
// function modifyForStaticDeployment(deployDir) {
//     console.log('\n4. 配置静态部署...');
    
//     // 修改HTML文件，添加配置引用并修改socket.io引用
//     const htmlFiles = ['index.html', 'sender.html', 'receiver.html'];
    
//     htmlFiles.forEach(filename => {
//         const filePath = path.join(deployDir, filename);
//         if (fs.existsSync(filePath)) {
//             let content = fs.readFileSync(filePath, 'utf8');
            
//             // 修改socket.io引用为本地文件
//             content = content.replace(
//                 '<script src="/socket.io/socket.io.js"></script>',
//                 '<script src="./socket.io.js"></script>'
//             );
            
//             fs.writeFileSync(filePath, content);
//             console.log(`   ✅ 已修改: ${filename} (修改socket.io引用)`);
//         }
//     });
// }

// 创建前端部署说明
function createFrontendDeploymentGuide(deployDir) {
    console.log('\n5. 创建前端部署说明...');
    
    const guideContent = `# 前端资源部署说明

## 📦 部署包内容

这是一个纯前端的WebRTC音频通信应用，包含以下文件：

### 页面文件
- \`index.html\` - 首页/选择页面
- \`sender.html\` - 推流端页面
- \`receiver.html\` - 拉流端页面

### 静态资源
- \`public/styles.css\` - 样式文件
- \`public/sender.js\` - 推流端逻辑
- \`public/receiver.js\` - 拉流端逻辑（支持WAV格式录制）
- \`socket.io.js\` - Socket.IO客户端库

### 配置文件
- \`config.js\` - 前端配置文件

## 🚀 部署方式

### 方式一：静态文件服务器
可以部署到任何静态文件服务器：

#### Nginx
\`\`\`nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/deploy/directory;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 启用GZIP压缩
    gzip on;
    gzip_types text/css application/javascript text/html;
}
\`\`\`

#### Apache
\`\`\`apache
<VirtualHost *:80>
    DocumentRoot /path/to/deploy/directory
    ServerName your-domain.com
    
    <Directory /path/to/deploy/directory>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
\`\`\`

### 方式二：CDN部署
- 阿里云OSS + CDN
- 腾讯云COS + CDN  
- AWS S3 + CloudFront
- GitHub Pages
- Netlify
- Vercel

### 方式三：本地测试
\`\`\`bash
# 使用Python简单HTTP服务器
python3 -m http.server 8080

# 使用Node.js serve包
npx serve -s . -p 8080

# 使用Live Server (VSCode插件)
# 右键HTML文件 -> Open with Live Server
\`\`\`

## ⚙️ 配置说明

### 修改WebSocket服务器地址
编辑 \`config.js\` 文件：

\`\`\`javascript
window.WEBRTC_CONFIG = {
    // 修改为你的后端服务器地址
    socketServerUrl: 'wss://your-backend-server.com',
    
    // 如果是本地测试
    // socketServerUrl: 'ws://localhost:3000',
    
    // 其他配置...
};
\`\`\`

### 后端服务器要求
前端需要配合WebSocket信令服务器使用，后端服务器需要：

1. **WebSocket支持** - 处理offer/answer/ice-candidate信令
2. **CORS配置** - 允许前端域名访问
3. **HTTPS支持** - WebRTC需要安全上下文

## 🔧 开发和调试

### 本地开发
1. 启动后端信令服务器
2. 修改 \`config.js\` 中的服务器地址
3. 使用静态文件服务器打开前端页面

### 调试技巧
- 打开浏览器开发者工具查看控制台日志
- 在 \`config.js\` 中设置 \`debug: true\` 启用调试模式
- 检查网络面板查看WebSocket连接状态

## 📱 使用方法

1. **推流端**：访问 \`/sender.html\`
   - 选择音频设备
   - 点击"开始推流"

2. **拉流端**：访问 \`/receiver.html\`  
   - 点击"开始接收"
   - 可以录制音频并下载WAV格式文件

## 🛡️ 注意事项

### HTTPS要求
- WebRTC需要HTTPS环境才能正常工作
- 本地测试可以使用localhost
- 生产环境必须使用HTTPS

### 浏览器兼容性
- Chrome 70+
- Firefox 68+
- Safari 14+
- Edge 79+

### 网络要求
- 需要WebSocket连接到信令服务器
- 防火墙需要允许WebRTC端口
- 复杂网络环境可能需要TURN服务器

## 🔄 更新部署

1. 替换静态文件
2. 清除浏览器缓存
3. 更新CDN缓存（如果使用CDN）

---

**提示**: 这是纯前端资源包，需要配合WebSocket信令服务器使用。
`;
    
    const guideFile = path.join(deployDir, 'FRONTEND_DEPLOYMENT.md');
    fs.writeFileSync(guideFile, guideContent);
    console.log('   ✅ 前端部署说明已创建: FRONTEND_DEPLOYMENT.md');
}

// 创建示例服务器文件
function createExampleServer(deployDir) {
    console.log('\n6. 创建示例服务器文件...');
    
    const serverContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>本地测试服务器</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; }
        .command { background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .note { background: #e7f3ff; padding: 15px; border-left: 4px solid #2196F3; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📁 WebRTC前端资源</h1>
        
        <div class="note">
            <strong>注意：</strong>这些是纯前端文件，需要通过HTTP/HTTPS服务器访问才能正常工作。
        </div>
        
        <h2>🚀 快速启动本地服务器</h2>
        
        <h3>方法一：Python</h3>
        <div class="command">
            <code>python3 -m http.server 8080</code><br>
            然后访问：<a href="http://localhost:8080">http://localhost:8080</a>
        </div>
        
        <h3>方法二：Node.js</h3>
        <div class="command">
            <code>npx serve -s . -p 8080</code><br>
            然后访问：<a href="http://localhost:8080">http://localhost:8080</a>
        </div>
        
        <h3>方法三：PHP</h3>
        <div class="command">
            <code>php -S localhost:8080</code><br>
            然后访问：<a href="http://localhost:8080">http://localhost:8080</a>
        </div>
        
        <h2>📖 页面导航</h2>
        <ul>
            <li><a href="index.html">首页</a> - 选择推流或拉流</li>
            <li><a href="sender.html">推流端</a> - 发送音频</li>
            <li><a href="receiver.html">拉流端</a> - 接收和录制音频</li>
        </ul>
        
        <h2>⚙️ 配置说明</h2>
        <p>在使用前请先编辑 <code>config.js</code> 文件，设置正确的WebSocket服务器地址。</p>
        
        <div class="note">
            <strong>需要后端支持：</strong>该前端需要配合WebSocket信令服务器使用，用于交换WebRTC连接信息。
        </div>
    </div>
</body>
</html>`;
    
    const serverFile = path.join(deployDir, 'README.html');
    fs.writeFileSync(serverFile, serverContent);
    console.log('   ✅ 示例页面已创建: README.html');
}

// 生成部署摘要
function generateSummary(deployDir) {
    console.log('\n7. 生成部署摘要...');
    
    const files = fs.readdirSync(deployDir);
    const totalSize = files.reduce((size, file) => {
        const filePath = path.join(deployDir, file);
        try {
            const stats = fs.statSync(filePath);
            return size + stats.size;
        } catch (error) {
            return size;
        }
    }, 0);
    
    console.log(`   📊 前端部署包信息：`);
    console.log(`      - 文件数量: ${files.length}`);
    console.log(`      - 总大小: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log(`      - 部署目录: ${deployDir}`);
    
    console.log('\n   📁 前端包包含的文件：');
    files.forEach(file => {
        console.log(`      - ${file}`);
    });
}

// 复制Socket.IO客户端文件
function copySocketIOClientFile(deployDir) {
    console.log('\n3. 复制Socket.IO客户端文件...');
    
    const socketIOClientPath = path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js');
    const socketIODir = path.join(deployDir, 'socket.io');
    const destPath = path.join(socketIODir, 'socket.io.js');
    
    try {
        // 创建 socket.io 目录
        if (!fs.existsSync(socketIODir)) {
            fs.mkdirSync(socketIODir, { recursive: true });
            console.log('   ✅ 已创建目录: socket.io/');
        }
        
        if (fs.existsSync(socketIOClientPath)) {
            fs.copyFileSync(socketIOClientPath, destPath);
            console.log('   ✅ 已复制: socket.io/socket.io.js');
        } else {
            console.log('   ⚠️  警告: 未找到Socket.IO客户端文件，请确保已安装socket.io包');
        }
    } catch (error) {
        console.log('   ❌ 复制Socket.IO客户端文件失败:', error.message);
    }
}

// 主函数
function main() {
    try {
        const deployDir = createDeployDir();
        copyFrontendFiles(deployDir);
        copySocketIOClientFile(deployDir);
        // modifyForStaticDeployment(deployDir);
        createFrontendDeploymentGuide(deployDir);
        createExampleServer(deployDir);
        generateSummary(deployDir);
        
        console.log('\n🎉 前端部署包创建完成！');
        console.log('\n📋 使用方法：');
        console.log('   1. 将 deploy/ 目录下的文件上传到静态文件服务器');
        console.log('   2. 编辑 config.js 设置WebSocket服务器地址');
        console.log('   3. 通过HTTP/HTTPS访问 index.html');
        console.log('\n📖 详细说明请查看：deploy/FRONTEND_DEPLOYMENT.md');
        console.log('📱 本地测试说明：deploy/README.html');
        
    } catch (error) {
        console.error('\n❌ 前端部署包创建失败:', error.message);
        process.exit(1);
    }
}

// 运行部署脚本
if (require.main === module) {
    main();
}

module.exports = {
    createDeployDir,
    copyFrontendFiles,
    copySocketIOClientFile,
    // modifyForStaticDeployment,
    createFrontendDeploymentGuide,
    createExampleServer,
    generateSummary,
    main
}; 