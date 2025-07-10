class AudioSender {
    constructor() {
        console.log('websocket-url', this.getWebSocketUrl())
        this.socket = io(this.getWebSocketUrl(), {
            transports: ['websocket', 'polling'],
            withCredentials: true,
            autoConnect: true,
            forceNew: true,
            timeout: 20000,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            upgrade: true,
            rememberUpgrade: true
        });
        this.localStream = null;
        this.peerConnection = null;
        this.isStreaming = false;
        this.isMuted = false;
        this.receiverId = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.getAudioDevices();
    }

    getWebSocketUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        // 优先使用URL参数，如果没有则使用当前访问的主机和端口
        const domain = urlParams.get('domain') || window.location.hostname;
        const port = urlParams.get('port') || window.location.port || '3000';
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${domain}:${port}`;
    }

    initializeElements() {
        this.statusEl = document.getElementById('status');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.localVideo = document.getElementById('localVideo');
        this.audioDeviceSelect = document.getElementById('audioDevice');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startStreaming());
        this.stopBtn.addEventListener('click', () => this.stopStreaming());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.audioDeviceSelect.addEventListener('change', () => this.changeAudioDevice());
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to signaling server');
            this.socket.emit('register', { type: 'sender' });
        });

        this.socket.on('client-connected', (data) => {
            if (data.type === 'receiver') {
                this.receiverId = data.id;
                this.updateStatus('检测到拉流端', 'connecting');
            }
        });

        this.socket.on('client-disconnected', (data) => {
            if (data.id === this.receiverId) {
                this.receiverId = null;
                this.updateStatus('拉流端断开连接', 'disconnected');
            }
        });

        this.socket.on('answer', async (data) => {
            try {
                await this.peerConnection.setRemoteDescription(data.answer);
                this.updateStatus('连接已建立', 'connected');
            } catch (error) {
                console.error('Error setting remote description:', error);
                this.updateStatus('连接失败', 'disconnected');
            }
        });

        this.socket.on('ice-candidate', async (data) => {
            try {
                await this.peerConnection.addIceCandidate(data.candidate);
            } catch (error) {
                console.error('Error adding received ice candidate:', error);
            }
        });
    }

    async getAudioDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            
            this.audioDeviceSelect.innerHTML = '<option value="">默认设备</option>';
            audioDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `音频设备 ${device.deviceId.substring(0, 8)}`;
                this.audioDeviceSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error getting audio devices:', error);
        }
    }

    async startStreaming() {
        try {
            this.updateStatus('正在获取音频设备...', 'connecting');
            
            const selectedDeviceId = this.audioDeviceSelect.value;
            const constraints = {
                audio: selectedDeviceId ? { deviceId: selectedDeviceId } : true,
                video: false
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.localVideo.srcObject = this.localStream;

            this.setupPeerConnection();
            this.isStreaming = true;
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.muteBtn.disabled = false;
            
            this.updateStatus('等待拉流端连接...', 'connecting');
            
            // 如果已经有接收端连接，立即发送offer
            if (this.receiverId) {
                await this.createOffer();
            }
        } catch (error) {
            console.error('Error starting stream:', error);
            this.updateStatus('无法获取音频设备', 'disconnected');
            alert('无法获取音频设备，请检查权限设置');
        }
    }

    setupPeerConnection() {
        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        // 添加本地流到对等连接
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        // 处理ICE候选
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.receiverId) {
                this.socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    targetId: this.receiverId
                });
            }
        };

        // 监听连接状态变化
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                this.updateStatus('连接已建立', 'connected');
            } else if (this.peerConnection.connectionState === 'disconnected') {
                this.updateStatus('连接断开', 'disconnected');
            }
        };
    }

    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.socket.emit('offer', {
                offer: offer,
                targetId: this.receiverId
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    stopStreaming() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.localVideo.srcObject = null;
        this.isStreaming = false;
        this.isMuted = false;
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.muteBtn.disabled = true;
        this.muteBtn.textContent = '静音';
        
        this.updateStatus('未连接', 'disconnected');
    }

    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isMuted = !audioTrack.enabled;
                this.muteBtn.textContent = this.isMuted ? '取消静音' : '静音';
            }
        }
    }

    async changeAudioDevice() {
        if (this.isStreaming) {
            const selectedDeviceId = this.audioDeviceSelect.value;
            const constraints = {
                audio: selectedDeviceId ? { deviceId: selectedDeviceId } : true,
                video: false
            };

            try {
                // 停止当前流
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => track.stop());
                }

                // 获取新的音频流
                this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
                this.localVideo.srcObject = this.localStream;

                // 更新对等连接中的音频轨道
                if (this.peerConnection) {
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    const sender = this.peerConnection.getSenders().find(s => 
                        s.track && s.track.kind === 'audio'
                    );
                    
                    if (sender) {
                        await sender.replaceTrack(audioTrack);
                    }
                }
            } catch (error) {
                console.error('Error changing audio device:', error);
                alert('无法切换音频设备');
            }
        }
    }

    updateStatus(message, type) {
        this.statusEl.textContent = message;
        this.statusEl.className = `status ${type}`;
    }
}

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 等待接收端连接的处理
    const sender = new AudioSender();
    
    // 监听拉流端连接事件
    sender.socket.on('client-connected', async (data) => {
        if (data.type === 'receiver' && sender.isStreaming) {
            sender.receiverId = data.id;
            await sender.createOffer();
        }
    });
}); 