# 🚀 WebRTC音频通信系统 - 前端部署总结

## 📦 前端部署包说明

该项目已经成功创建**纯前端**部署包，所有需要部署到静态文件服务器的文件都在 `deploy/` 目录中。

> ⚠️ **重要变更**: 现在已改为纯前端部署，不包含后端服务器文件。

## 📋 部署包内容

前端部署包包含以下文件（总计 64 KB）：

### 页面文件
- `index.html` - 首页/选择页面
- `sender.html` - 推流端页面 
- `receiver.html` - 拉流端页面（支持WAV格式录制）
- `test-config.html` - WebSocket配置测试页面

### 静态资源
- `public/styles.css` - 样式文件
- `public/sender.js` - 推流端逻辑
- `public/receiver.js` - 拉流端逻辑（支持WAV录制）

### 配置和文档
- `config.js` - 前端配置文件（WebSocket服务器地址等）
- `FRONTEND_DEPLOYMENT.md` - 详细部署说明
- `README.html` - 本地测试说明页面

## 🎯 快速部署指南

### 1. 上传文件
将 `deploy/` 目录下的所有文件上传到任何静态文件服务器：
- CDN服务（阿里云OSS、腾讯云COS、AWS S3等）
- 静态网站托管（GitHub Pages、Netlify、Vercel等）
- 自有Web服务器（Nginx、Apache等）

### 2. WebSocket服务器地址（URL参数获取）
🎉 **支持灵活的URL参数配置！** WebSocket服务器地址从URL参数自动获取：

#### URL参数说明
- `wsDomain` - 指定WebSocket服务器域名
- `wsPort` - 指定WebSocket服务器端口

#### 配置示例

**默认配置（使用当前域名和端口）：**
```
https://your-domain.com/sender.html
→ wss://your-domain.com
```

**指定WebSocket端口：**
```
https://your-domain.com/sender.html?wsPort=3000
→ wss://your-domain.com:3000
```

**指定WebSocket域名：**
```
https://your-domain.com/sender.html?wsDomain=api.backend.com
→ wss://api.backend.com
```

**同时指定域名和端口：**
```
https://your-domain.com/sender.html?wsDomain=api.backend.com&wsPort=8080
→ wss://api.backend.com:8080
```

**本地开发示例：**
```
http://localhost:8080/sender.html?wsDomain=localhost&wsPort=3000
→ ws://localhost:3000
```

配置文件 `config.js` 现在是这样的：
```javascript
window.WEBRTC_CONFIG = {
    // 从URL参数自动获取：protocol://domain:port
    socketServerUrl: 'wss://api.backend.com:8080',  // 自动生成
    
    // STUN服务器配置（可自定义）
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ],
    
    debug: false  // 设为true启用调试模式
};
```

### 3. 正确的Socket.IO连接 ✅
现在 `sender.js` 和 `receiver.js` 都已经修复，正确使用配置的WebSocket地址：

```javascript
// 修复前（错误）：
this.socket = io();

// 修复后（正确）：
this.socket = io(window.WEBRTC_CONFIG.socketServerUrl);
```

同时STUN服务器也使用配置中的地址：
```javascript
// 修复前（硬编码）：
this.peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// 修复后（使用配置）：
this.peerConnection = new RTCPeerConnection({
    iceServers: window.WEBRTC_CONFIG.iceServers
});
```

### 4. 本地测试
如果需要本地测试，可以使用以下命令：

```bash
# 方法一：Python
python3 -m http.server 8080

# 方法二：Node.js
npx serve -s . -p 8080

# 方法三：PHP
php -S localhost:8080
```

然后访问 `http://localhost:8080`

### 5. 访问应用
- 首页：`https://your-domain.com/index.html`
- 推流端：`https://your-domain.com/sender.html`
- 拉流端：`https://your-domain.com/receiver.html`
- 配置测试：`https://your-domain.com/test-config.html`

## 🔧 环境要求

### 前端要求
- ✅ HTTPS环境（WebRTC要求）
- ✅ 现代浏览器（Chrome 70+、Firefox 68+、Safari 14+、Edge 79+）
- ✅ 静态文件服务器

### 后端要求
前端需要配合WebSocket信令服务器使用：

1. **WebSocket支持** - 处理offer/answer/ice-candidate信令交换
2. **CORS配置** - 允许前端域名访问
3. **Socket.IO兼容** - 前端使用Socket.IO客户端

## ⭐ 新功能特性

### WAV格式录制
- ✅ 拉流端支持录制接收到的音频
- ✅ 录制格式：WAV（16位PCM，单声道）
- ✅ 实时音频处理，无需MediaRecorder API
- ✅ 一键下载录制文件

### 静态部署优化
- ✅ 使用CDN版本的Socket.IO客户端
- ✅ **WebSocket地址自动获取**，无需手动配置
- ✅ 所有路径改为相对路径，支持子目录部署
- ✅ 完全独立的前端包，无需Node.js环境
- ✅ 支持URL参数指定WebSocket端口

## 📚 部署方式对比

| 部署方式 | 优点 | 适用场景 |
|---------|------|---------|
| **CDN部署** | 全球加速、高可用 | 生产环境，用户分布广泛 |
| **静态托管** | 简单易用、免费 | 小型项目，快速原型 |
| **自有服务器** | 完全控制、定制化 | 企业环境，特殊需求 |

## 🛡️ 安全注意事项

1. **HTTPS必需**：WebRTC要求安全上下文
2. **域名配置**：确保WebSocket服务器允许前端域名访问
3. **CORS设置**：后端需要正确配置CORS策略
4. **证书有效性**：使用有效的SSL证书

## 📞 技术架构

```
前端静态文件 (CDN/静态服务器)
     ↓ WebSocket连接
WebSocket信令服务器 (后端)
     ↓ 交换连接信息
WebRTC P2P音频通信 (直连)
```

## 🔄 更新部署

1. 替换静态文件
2. 清除浏览器/CDN缓存
3. WebSocket地址自动适配，无需额外配置

---

✅ **前端部署包已准备就绪，可以直接部署到任何静态文件服务器！**

📖 **详细说明请查看**: `deploy/FRONTEND_DEPLOYMENT.md`  
📱 **本地测试说明**: `deploy/README.html` 