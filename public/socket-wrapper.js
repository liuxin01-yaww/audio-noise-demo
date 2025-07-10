/**
 * Socket.IO连接包装器 - 自动处理跨域问题
 * 使用方法：
 * 1. 引入此文件：<script src="socket-wrapper.js"></script>
 * 2. 使用：const socket = createSocketConnection('ws://localhost:3000');
 */

(function(window) {
    'use strict';

    // 默认配置
    const DEFAULT_CONFIG = {
        // 自动处理跨域的连接选项
        transports: ['websocket', 'polling'],
        withCredentials: true,
        autoConnect: false,
        forceNew: true,
        timeout: 20000,
        
        // 重连配置
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        
        // 跨域配置
        upgrade: true,
        rememberUpgrade: true
    };

    /**
     * 检测当前环境
     * @returns {string} 'localhost' | 'production'
     */
    function detectEnvironment() {
        const hostname = window.location.hostname;
        return (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') 
            ? 'localhost' 
            : 'production';
    }

    /**
     * 根据环境自动配置服务器URL
     * @param {string} serverUrl - 用户提供的服务器URL
     * @returns {string} 处理后的服务器URL
     */
    function configureServerUrl(serverUrl) {
        if (!serverUrl) {
            // 如果没有提供URL，根据当前访问的主机和端口自动配置
            const hostname = window.location.hostname;
            const port = window.location.port || '3000';
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            return `${protocol}//${hostname}:${port}`;
        }
        
        // 自动处理协议
        if (window.location.protocol === 'https:' && serverUrl.startsWith('ws://')) {
            console.warn('HTTPS页面自动切换到WSS协议');
            return serverUrl.replace('ws://', 'wss://');
        }
        
        return serverUrl;
    }

    /**
     * 创建Socket.IO连接
     * @param {string} serverUrl - Socket.IO服务器URL
     * @param {Object} options - 额外的连接选项
     * @returns {Object} Socket.IO连接实例
     */
    function createSocketConnection(serverUrl, options = {}) {
        // 检查Socket.IO是否已加载
        if (typeof io === 'undefined') {
            throw new Error('Socket.IO库未加载，请确保已引入socket.io.js');
        }

        // 配置服务器URL
        const finalServerUrl = configureServerUrl(serverUrl);
        
        // 合并配置选项
        const config = Object.assign({}, DEFAULT_CONFIG, options);
        
        console.log('🔌 创建Socket.IO连接:', finalServerUrl);
        console.log('📝 连接配置:', config);

        // 创建Socket.IO连接
        const socket = io(finalServerUrl, config);

        // 添加跨域相关的事件监听
        socket.on('connect', function() {
            console.log('✅ Socket.IO连接成功');
            console.log('🌐 连接ID:', socket.id);
            console.log('🚀 传输方式:', socket.io.engine.transport.name);
        });

        socket.on('connect_error', function(error) {
            console.error('❌ Socket.IO连接失败:', error);
            
            // 提供跨域问题的诊断信息
            if (error.description && error.description.includes('CORS')) {
                console.error('🚫 跨域问题检测到，请检查服务器CORS配置');
            }
            
            // 如果是HTTPS页面连接HTTP服务器
            if (window.location.protocol === 'https:' && finalServerUrl.startsWith('ws://')) {
                console.error('🔒 HTTPS页面不能连接到不安全的WebSocket服务器');
            }
        });

        socket.on('disconnect', function(reason) {
            console.log('🔌 Socket.IO连接断开:', reason);
        });

        socket.on('reconnect', function(attemptNumber) {
            console.log('🔄 Socket.IO重新连接成功，尝试次数:', attemptNumber);
        });

        socket.on('reconnect_error', function(error) {
            console.error('🔄 Socket.IO重连失败:', error);
        });

        // 添加便捷方法
        socket.connectWithRetry = function() {
            console.log('🔄 开始连接Socket.IO服务器...');
            socket.connect();
        };

        socket.safeEmit = function(event, data, callback) {
            if (socket.connected) {
                socket.emit(event, data, callback);
            } else {
                console.warn('⚠️ Socket.IO未连接，无法发送事件:', event);
            }
        };

        return socket;
    }

    /**
     * 快速连接方法（自动连接）
     * @param {string} serverUrl - Socket.IO服务器URL
     * @param {Object} options - 额外的连接选项
     * @returns {Object} Socket.IO连接实例
     */
    function quickConnect(serverUrl, options = {}) {
        const socket = createSocketConnection(serverUrl, options);
        socket.connectWithRetry();
        return socket;
    }

    /**
     * 创建WebRTC信令Socket连接
     * @param {string} serverUrl - Socket.IO服务器URL
     * @returns {Object} 配置好的Socket.IO连接实例
     */
    function createWebRTCSignalingSocket(serverUrl) {
        const socket = createSocketConnection(serverUrl);
        
        // 添加WebRTC信令相关的便捷方法
        socket.sendOffer = function(offer, targetId, callback) {
            socket.safeEmit('offer', { offer, targetId }, callback);
        };

        socket.sendAnswer = function(answer, targetId, callback) {
            socket.safeEmit('answer', { answer, targetId }, callback);
        };

        socket.sendIceCandidate = function(candidate, targetId, callback) {
            socket.safeEmit('ice-candidate', { candidate, targetId }, callback);
        };

        socket.joinRoom = function(roomId, callback) {
            socket.safeEmit('join-room', { roomId }, callback);
        };

        socket.leaveRoom = function(roomId, callback) {
            socket.safeEmit('leave-room', { roomId }, callback);
        };

        return socket;
    }

    // 暴露到全局
    window.createSocketConnection = createSocketConnection;
    window.quickConnect = quickConnect;
    window.createWebRTCSignalingSocket = createWebRTCSignalingSocket;
    
    // 兼容性别名
    window.SocketWrapper = {
        create: createSocketConnection,
        quickConnect: quickConnect,
        webrtc: createWebRTCSignalingSocket
    };

    console.log('✅ Socket.IO包装器已加载');

})(window); 