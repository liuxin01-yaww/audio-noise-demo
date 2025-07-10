#!/bin/bash

# WebSocket信令服务器启动脚本
# 适用于 Linux/Mac 系统

# 设置脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 配置变量
SERVICE_NAME="signaling-server"
NODE_ENV="production"
PORT=3000
HTTP_PORT=3001
LOG_DIR="logs"
PID_FILE="$SERVICE_NAME.pid"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "mac"
    else
        echo "unknown"
    fi
}

# 检查Node.js是否安装
check_nodejs() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
}

# 创建日志目录
create_log_dir() {
    if [ ! -d "$LOG_DIR" ]; then
        mkdir -p "$LOG_DIR"
        log_info "创建日志目录: $LOG_DIR"
    fi
}

# 检查端口是否被占用（跨平台）
check_port() {
    local port=$1
    local os=$(detect_os)
    
    if [ "$os" = "mac" ]; then
        # Mac系统使用netstat
        if netstat -an | grep -q "LISTEN.*:$port"; then
            log_warn "端口 $port 已被占用"
            return 1
        fi
    else
        # Linux系统使用ss或netstat
        if command -v ss &> /dev/null; then
            if ss -tuln | grep -q ":$port "; then
                log_warn "端口 $port 已被占用"
                return 1
            fi
        elif command -v netstat &> /dev/null; then
            if netstat -tuln | grep -q ":$port "; then
                log_warn "端口 $port 已被占用"
                return 1
            fi
        else
            log_warn "无法检查端口占用情况，跳过检查"
        fi
    fi
    return 0
}

# 获取本机IP地址（跨平台）
get_local_ip() {
    local os=$(detect_os)
    
    if [ "$os" = "mac" ]; then
        # Mac系统
        ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1
    else
        # Linux系统
        if command -v hostname &> /dev/null; then
            hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost"
        else
            ip route get 8.8.8.8 | awk '{print $7}' | head -1 2>/dev/null || echo "localhost"
        fi
    fi
}

# 检查服务是否已经运行
check_service_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            log_warn "WebSocket信令服务器已经在运行中 (PID: $pid)"
            return 0
        else
            log_warn "PID文件存在但进程不存在，清理PID文件"
            rm -f "$PID_FILE"
        fi
    fi
    return 1
}

# 启动服务（nohup方式）
start_service() {
    log_info "启动 WebSocket信令服务器..."
    
    # 设置环境变量
    export NODE_ENV=$NODE_ENV
    export PORT=$PORT
    export HTTP_PORT=$HTTP_PORT
    export HOST=0.0.0.0
    
    # 启动服务
    nohup node signaling-server.js \
        > "$LOG_DIR/output.log" \
        2> "$LOG_DIR/error.log" \
        & echo $! > "$PID_FILE"
    
    local pid=$(cat "$PID_FILE")
    sleep 2
    
    if ps -p $pid > /dev/null 2>&1; then
        log_info "WebSocket信令服务器启动成功!"
        log_info "PID: $pid"
        log_info "服务端口: $PORT"
        log_info "日志文件: $LOG_DIR/output.log"
        log_info "错误日志: $LOG_DIR/error.log"
        log_info ""
        log_info "访问地址:"
        log_info "  http://localhost:$PORT"
        
        local ip=$(get_local_ip)
        if [ "$ip" != "localhost" ] && [ -n "$ip" ]; then
            log_info "  http://$ip:$PORT"
        fi
        
        return 0
    else
        log_error "WebSocket信令服务器启动失败，请检查错误日志"
        return 1
    fi
}

# 停止服务
stop_service() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            log_info "停止 WebSocket信令服务器 (PID: $pid)"
            kill $pid
            
            # 等待进程结束
            local count=0
            while ps -p $pid > /dev/null 2>&1; do
                sleep 1
                count=$((count + 1))
                if [ $count -gt 10 ]; then
                    log_warn "强制终止进程"
                    kill -9 $pid
                    break
                fi
            done
            
            rm -f "$PID_FILE"
            log_info "WebSocket信令服务器已停止"
        else
            log_warn "服务未运行"
            rm -f "$PID_FILE"
        fi
    else
        log_warn "PID文件不存在，服务可能未运行"
    fi
}

# 重启服务
restart_service() {
    log_info "重启 WebSocket信令服务器..."
    stop_service
    sleep 2
    start_service
}

# 查看服务状态
check_status() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            log_info "WebSocket信令服务器正在运行 (PID: $pid)"
            
            # 检查端口
            if check_port $PORT; then
                log_warn "服务端口 $PORT 未监听"
            else
                log_info "服务端口 $PORT 正在监听"
            fi
        else
            log_warn "PID文件存在但进程不存在"
            rm -f "$PID_FILE"
        fi
    else
        log_warn "WebSocket信令服务器未运行"
    fi
}

# 查看日志
view_logs() {
    if [ -f "$LOG_DIR/output.log" ]; then
        log_info "输出日志 (最后30行):"
        tail -n 30 "$LOG_DIR/output.log"
    else
        log_warn "输出日志文件不存在"
    fi
    
    echo ""
    
    if [ -f "$LOG_DIR/error.log" ]; then
        log_info "错误日志 (最后30行):"
        tail -n 30 "$LOG_DIR/error.log"
    else
        log_warn "错误日志文件不存在"
    fi
}

# 显示帮助信息
show_help() {
    echo "WebSocket信令服务器管理脚本"
    echo ""
    echo "用法: $0 {start|stop|restart|status|logs|help}"
    echo ""
    echo "命令:"
    echo "  start    - 启动服务"
    echo "  stop     - 停止服务"
    echo "  restart  - 重启服务"
    echo "  status   - 查看服务状态"
    echo "  logs     - 查看日志"
    echo "  help     - 显示帮助信息"
    echo ""
    echo "系统支持: Linux, macOS"
    echo ""
}

# 主函数
main() {
    case "$1" in
        start)
            check_nodejs
            
            if check_service_running; then
                exit 0
            fi
            
            if ! check_port $PORT; then
                log_error "端口 $PORT 被占用，请检查"
                exit 1
            fi
            
            create_log_dir
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        status)
            check_status
            ;;
        logs)
            view_logs
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "无效的参数: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@" 