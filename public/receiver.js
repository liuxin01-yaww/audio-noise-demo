class AudioReceiver {
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
        this.peerConnection = null;
        this.remoteStream = null;
        this.isReceiving = false;
        this.senderId = null;
        this.volume = 1.0;
        
        // 录制相关
        this.mediaRecorder = null;
        this.isRecording = false;
        this.recordedChunks = [];
        this.recordedBlob = null;
        this.recordedAudioURL = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
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
        this.volumeBtn = document.getElementById('volumeBtn');
        this.remoteVideo = document.getElementById('remoteVideo');
        
        // 录制相关元素
        this.recordBtn = document.getElementById('recordBtn');
        this.stopRecordBtn = document.getElementById('stopRecordBtn');
        this.playRecordBtn = document.getElementById('playRecordBtn');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.audioPlayback = document.getElementById('audioPlayback');
        this.downloadSection = document.getElementById('downloadSection');
        this.downloadLink = document.getElementById('downloadLink');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startReceiving());
        this.stopBtn.addEventListener('click', () => this.stopReceiving());
        this.volumeBtn.addEventListener('click', () => this.toggleVolume());
        
        // 录制相关事件
        this.recordBtn.addEventListener('click', () => this.startRecording());
        this.stopRecordBtn.addEventListener('click', () => this.stopRecording());
        this.playRecordBtn.addEventListener('click', () => this.playRecording());
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to signaling server');
            this.socket.emit('register', { type: 'receiver' });
        });

        this.socket.on('client-connected', (data) => {
            if (data.type === 'sender') {
                this.senderId = data.id;
                this.updateStatus('检测到推流端', 'connecting');
            }
        });

        this.socket.on('client-disconnected', (data) => {
            if (data.id === this.senderId) {
                this.senderId = null;
                this.updateStatus('推流端断开连接', 'disconnected');
                this.resetConnection();
            }
        });

        this.socket.on('offer', async (data) => {
            try {
                this.senderId = data.senderId;
                await this.handleOffer(data.offer);
            } catch (error) {
                console.error('Error handling offer:', error);
                this.updateStatus('连接失败', 'disconnected');
            }
        });

        this.socket.on('ice-candidate', async (data) => {
            try {
                if (this.peerConnection) {
                    await this.peerConnection.addIceCandidate(data.candidate);
                }
            } catch (error) {
                console.error('Error adding received ice candidate:', error);
            }
        });
    }

    async startReceiving() {
        try {
            this.updateStatus('等待推流端连接...', 'connecting');
            
            this.setupPeerConnection();
            this.isReceiving = true;
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            
            // 如果已经有发送端连接，等待offer
            if (this.senderId) {
                this.updateStatus('等待推流端发送音频...', 'connecting');
            }
        } catch (error) {
            console.error('Error starting receiving:', error);
            this.updateStatus('启动失败', 'disconnected');
        }
    }

    setupPeerConnection() {
        this.peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        // 处理接收到的远程流
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote track');
            this.remoteStream = event.streams[0];
            this.remoteVideo.srcObject = this.remoteStream;
            this.remoteVideo.volume = this.volume;
            
            // 启用录制按钮
            this.recordBtn.disabled = false;
            this.volumeBtn.disabled = false;
            
            this.updateStatus('连接已建立，正在接收音频', 'connected');
        };

        // 处理ICE候选
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.senderId) {
                this.socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    targetId: this.senderId
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
                this.resetConnection();
            } else if (this.peerConnection.connectionState === 'failed') {
                this.updateStatus('连接失败', 'disconnected');
                this.resetConnection();
            }
        };
    }

    async handleOffer(offer) {
        if (!this.peerConnection) {
            this.setupPeerConnection();
        }

        await this.peerConnection.setRemoteDescription(offer);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.socket.emit('answer', {
            answer: answer,
            targetId: this.senderId
        });

        this.updateStatus('正在建立连接...', 'connecting');
    }

    stopReceiving() {
        this.resetConnection();
        this.updateStatus('未连接', 'disconnected');
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.recordBtn.disabled = true;
        this.volumeBtn.disabled = true;
        
        this.isReceiving = false;
    }

    resetConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        this.remoteVideo.srcObject = null;
        
        // 停止录制
        if (this.isRecording) {
            this.stopRecording();
        }
    }

    toggleVolume() {
        if (this.volume > 0) {
            this.volume = 0;
            this.volumeBtn.textContent = '音量: 0%';
        } else {
            this.volume = 1.0;
            this.volumeBtn.textContent = '音量: 100%';
        }
        
        if (this.remoteVideo) {
            this.remoteVideo.volume = this.volume;
        }
    }

    async startRecording() {
        if (!this.remoteStream) {
            alert('没有音频流可以录制');
            return;
        }

        try {
            // 创建用于录制的音频上下文
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.remoteStream);
            
            // WAV录制参数
            this.sampleRate = this.audioContext.sampleRate;
            this.bufferSize = 4096;
            this.recordedBuffers = [];
            
            // 创建ScriptProcessorNode进行音频处理
            this.scriptProcessor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
            
            this.scriptProcessor.onaudioprocess = (event) => {
                if (this.isRecording) {
                    const inputBuffer = event.inputBuffer;
                    const inputData = inputBuffer.getChannelData(0);
                    // 复制音频数据
                    const buffer = new Float32Array(inputData.length);
                    buffer.set(inputData);
                    this.recordedBuffers.push(buffer);
                }
            };
            
            // 连接音频节点
            source.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);
            
            this.isRecording = true;
            
            this.recordBtn.disabled = true;
            this.stopRecordBtn.disabled = false;
            this.recordingStatus.style.display = 'block';
            
            console.log('WAV recording started');
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('录制启动失败: ' + error.message);
        }
    }

    stopRecording() {
        if (this.isRecording) {
            this.isRecording = false;
            
            // 处理录制的音频数据
            if (this.recordedBuffers.length > 0) {
                this.processRecordedAudio();
            }
            
            // 清理音频节点
            if (this.scriptProcessor) {
                this.scriptProcessor.disconnect();
                this.scriptProcessor = null;
            }
            
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
            
            this.recordBtn.disabled = false;
            this.stopRecordBtn.disabled = true;
            this.recordingStatus.style.display = 'none';
            
            console.log('WAV recording stopped');
        }
    }
    
    processRecordedAudio() {
        // 计算总样本数
        const totalSamples = this.recordedBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
        
        // 合并所有音频缓冲区
        const combinedBuffer = new Float32Array(totalSamples);
        let offset = 0;
        for (const buffer of this.recordedBuffers) {
            combinedBuffer.set(buffer, offset);
            offset += buffer.length;
        }
        
        // 转换为WAV格式
        const wavBlob = this.encodeWAV(combinedBuffer, this.sampleRate);
        this.recordedBlob = wavBlob;
        this.recordedAudioURL = URL.createObjectURL(wavBlob);
        
        // 显示播放控件和下载链接
        this.audioPlayback.src = this.recordedAudioURL;
        this.audioPlayback.style.display = 'block';
        this.downloadLink.href = this.recordedAudioURL;
        this.downloadSection.style.display = 'block';
        this.playRecordBtn.disabled = false;
        
        // 设置下载文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.downloadLink.download = `recorded-audio-${timestamp}.wav`;
        
        // 清理缓冲区数据
        this.recordedBuffers = [];
    }
    
    encodeWAV(samples, sampleRate) {
        const length = samples.length;
        const buffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(buffer);
        
        // WAV文件头
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        // RIFF标识符
        writeString(0, 'RIFF');
        // 文件长度
        view.setUint32(4, 36 + length * 2, true);
        // WAVE标识符
        writeString(8, 'WAVE');
        // fmt子块
        writeString(12, 'fmt ');
        // fmt子块长度
        view.setUint32(16, 16, true);
        // 音频格式 (PCM = 1)
        view.setUint16(20, 1, true);
        // 声道数
        view.setUint16(22, 1, true);
        // 采样率
        view.setUint32(24, sampleRate, true);
        // 字节率
        view.setUint32(28, sampleRate * 2, true);
        // 块对齐
        view.setUint16(32, 2, true);
        // 位深度
        view.setUint16(34, 16, true);
        // data子块
        writeString(36, 'data');
        // data子块长度
        view.setUint32(40, length * 2, true);
        
        // 音频数据
        let offset = 44;
        for (let i = 0; i < length; i++) {
            // 转换为16位PCM
            const sample = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }



    playRecording() {
        if (this.audioPlayback.src) {
            this.audioPlayback.play();
        }
    }

    updateStatus(message, type) {
        this.statusEl.textContent = message;
        this.statusEl.className = `status ${type}`;
    }
}

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new AudioReceiver();
}); 