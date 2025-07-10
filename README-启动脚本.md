# WebSocket信令服务器启动脚本

## 系统支持

- **Linux** (CentOS, Ubuntu, Debian 等)
- **macOS**

## 使用方法

### 1. 给脚本添加执行权限

```bash
chmod +x start-server.sh
```

### 2. 启动服务

```bash
./start-server.sh start
```

### 3. 查看服务状态

```bash
./start-server.sh status
```

### 4. 查看日志

```bash
./start-server.sh logs
```

### 5. 停止服务

```bash
./start-server.sh stop
```

### 6. 重启服务

```bash
./start-server.sh restart
```

## 所有命令

| 命令 | 说明 |
|------|------|
| `start` | 启动服务 |
| `stop` | 停止服务 |
| `restart` | 重启服务 |
| `status` | 查看服务状态 |
| `logs` | 查看日志 |
| `help` | 显示帮助信息 |

## 特性

- ✅ **后台运行**: 使用 `nohup` 方式启动，退出终端后服务继续运行
- ✅ **自动重启**: 如果服务意外停止，可以通过脚本快速重启
- ✅ **日志管理**: 自动管理输出日志和错误日志
- ✅ **端口检查**: 启动前检查端口是否被占用
- ✅ **跨平台**: 在 Linux 和 macOS 上都能运行
- ✅ **进程管理**: 自动管理 PID 文件，避免重复启动

## 文件说明

- `signaling-server.pid`: 服务进程ID文件
- `logs/output.log`: 服务输出日志
- `logs/error.log`: 服务错误日志

## 默认配置

- **端口**: 3000
- **HTTPS重定向端口**: 3001
- **环境**: production
- **监听地址**: 0.0.0.0 (所有网络接口)

## 故障排除

### 1. 端口被占用

```bash
# 查看端口占用情况
lsof -i :3000

# 或者使用netstat
netstat -tuln | grep :3000
```

### 2. 服务启动失败

```bash
# 查看错误日志
./start-server.sh logs

# 或者直接查看错误日志文件
cat logs/error.log
```

### 3. Node.js未安装

```bash
# 检查Node.js是否安装
node --version

# 安装Node.js (Ubuntu/Debian)
sudo apt update
sudo apt install nodejs npm

# 安装Node.js (CentOS/RHEL)
sudo yum install nodejs npm

# 安装Node.js (macOS 使用 Homebrew)
brew install node
```

## 示例

```bash
# 启动服务
$ ./start-server.sh start
[INFO] 启动 WebSocket信令服务器...
[INFO] 创建日志目录: logs
[INFO] WebSocket信令服务器启动成功!
[INFO] PID: 12345
[INFO] 服务端口: 3000
[INFO] 日志文件: logs/output.log
[INFO] 错误日志: logs/error.log

[INFO] 访问地址:
[INFO]   http://localhost:3000
[INFO]   http://192.168.1.100:3000

# 查看状态
$ ./start-server.sh status
[INFO] WebSocket信令服务器正在运行 (PID: 12345)
[INFO] 服务端口 3000 正在监听
``` 