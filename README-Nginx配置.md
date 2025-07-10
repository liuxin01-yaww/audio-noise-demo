# Nginx 反向代理配置指南

## 概述

本文档提供了使用Nginx作为WebSocket信令服务器反向代理的完整配置示例。

## 配置特性

- ✅ **WebSocket支持**: 完整的Socket.IO和WebSocket代理配置
- ✅ **HTTPS安全**: SSL/TLS配置和安全头部
- ✅ **负载均衡**: 支持多实例负载均衡
- ✅ **缓存优化**: 静态文件缓存和API缓存
- ✅ **跨域支持**: CORS头部配置
- ✅ **压缩传输**: Gzip压缩配置
- ✅ **日志记录**: 访问日志和错误日志
- ✅ **安全加固**: 多种安全头部和配置

## 安装和配置

### 1. 复制配置文件

```bash
# 复制配置文件到Nginx配置目录
sudo cp nginx.conf /etc/nginx/sites-available/webrtc-signaling

# 创建软链接启用站点
sudo ln -s /etc/nginx/sites-available/webrtc-signaling /etc/nginx/sites-enabled/

# 删除默认站点（可选）
sudo rm /etc/nginx/sites-enabled/default
```

### 2. 修改配置参数

编辑 `/etc/nginx/sites-available/webrtc-signaling` 文件：

```nginx
# 修改域名
server_name your-domain.com www.your-domain.com;

# 修改SSL证书路径
ssl_certificate /etc/ssl/certs/your-domain.crt;
ssl_certificate_key /etc/ssl/private/your-domain.key;
```

### 3. 获取SSL证书

#### 使用Let's Encrypt（推荐）

```bash
# 安装certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期
sudo crontab -e
# 添加以下行：
# 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 使用自签名证书（开发环境）

```bash
# 创建SSL目录
sudo mkdir -p /etc/ssl/certs /etc/ssl/private

# 生成自签名证书
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/your-domain.key \
  -out /etc/ssl/certs/your-domain.crt

# 设置权限
sudo chmod 600 /etc/ssl/private/your-domain.key
sudo chmod 644 /etc/ssl/certs/your-domain.crt
```

### 4. 测试和启动

```bash
# 测试配置文件语法
sudo nginx -t

# 重新加载配置
sudo systemctl reload nginx

# 启动Nginx（如果未启动）
sudo systemctl start nginx

# 设置开机自启
sudo systemctl enable nginx
```

## 负载均衡配置

如果你有多个WebSocket服务器实例，可以配置负载均衡：

```nginx
upstream webrtc_signaling {
    # 多个服务器实例
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    
    # 负载均衡策略
    least_conn;  # 最少连接数（推荐用于WebSocket）
    
    # 健康检查
    # server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
}
```

## 开发环境配置

对于开发环境，你可以使用更简单的HTTP配置：

```nginx
server {
    listen 8080;
    server_name localhost;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 性能优化

### 1. 工作进程配置

编辑 `/etc/nginx/nginx.conf`：

```nginx
# 工作进程数（通常等于CPU核心数）
worker_processes auto;

# 每个工作进程的最大连接数
events {
    worker_connections 1024;
    use epoll;
}

# 文件描述符限制
worker_rlimit_nofile 65535;
```

### 2. 缓存配置

```nginx
# 在http块中添加缓存配置
http {
    # 代理缓存路径
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=webrtc_cache:10m max_size=1g inactive=60m use_temp_path=off;
    
    # 其他配置...
}
```

### 3. 连接保持

```nginx
# 在server块中添加
keepalive_timeout 65;
keepalive_requests 100;
```

## 监控和日志

### 1. 日志配置

```nginx
# 自定义日志格式
log_format webrtc_format '$remote_addr - $remote_user [$time_local] '
                        '"$request" $status $body_bytes_sent '
                        '"$http_referer" "$http_user_agent" '
                        '$request_time $upstream_response_time';

# 应用日志格式
access_log /var/log/nginx/webrtc-signaling.access.log webrtc_format;
```

### 2. 状态监控

```nginx
# 添加状态监控端点
location /nginx_status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    deny all;
}
```

## 故障排除

### 1. 常见问题

#### WebSocket连接失败
```bash
# 检查Nginx配置
sudo nginx -t

# 检查日志
sudo tail -f /var/log/nginx/webrtc-signaling.error.log

# 检查代理目标是否可达
curl -I http://127.0.0.1:3000/api/health
```

#### 502 Bad Gateway错误
```bash
# 检查后端服务是否运行
./start-server.sh status

# 检查端口是否监听
netstat -tuln | grep :3000

# 检查防火墙
sudo ufw status
```

#### SSL证书问题
```bash
# 检查证书有效性
openssl x509 -in /etc/ssl/certs/your-domain.crt -text -noout

# 测试SSL连接
openssl s_client -connect your-domain.com:443
```

### 2. 调试命令

```bash
# 检查Nginx进程
ps aux | grep nginx

# 检查监听端口
netstat -tuln | grep nginx

# 重新加载配置
sudo systemctl reload nginx

# 查看Nginx状态
sudo systemctl status nginx

# 检查配置文件语法
sudo nginx -t
```

## 安全建议

1. **定期更新**: 保持Nginx和SSL证书更新
2. **防火墙**: 配置防火墙只允许必要的端口
3. **监控**: 设置日志监控和告警
4. **备份**: 定期备份配置文件
5. **测试**: 定期测试故障转移和恢复

## 性能基准

在正确配置的情况下，此配置可以支持：
- 数千个并发WebSocket连接
- 高吞吐量的静态文件服务
- 低延迟的API响应
- 自动故障转移和负载均衡

## 相关文档

- [Nginx官方文档](https://nginx.org/en/docs/)
- [WebSocket代理配置](https://nginx.org/en/docs/http/websocket.html)
- [SSL配置指南](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [负载均衡配置](https://nginx.org/en/docs/http/load_balancing.html) 