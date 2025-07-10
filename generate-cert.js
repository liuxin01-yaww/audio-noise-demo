const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 获取本机IP地址
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = ['127.0.0.1', 'localhost'];
    
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

// 创建certs目录
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir);
}

console.log('正在生成SSL证书...');

try {
    const ips = getLocalIPs();
    console.log('检测到的IP地址:', ips.join(', '));
    
    // 生成私钥
    execSync(`openssl genrsa -out ${certsDir}/server.key 2048`, { stdio: 'inherit' });
    
    // 创建证书配置文件，包含多个IP地址和域名
    const configContent = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = CN
ST = Beijing
L = Beijing
O = WebRTC Demo
CN = localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
${ips.map((ip, index) => {
    if (ip === 'localhost') {
        return `DNS.${index + 1} = ${ip}`;
    } else {
        return `IP.${index + 1} = ${ip}`;
    }
}).join('\n')}
`;
    
    const configFile = path.join(certsDir, 'cert.conf');
    fs.writeFileSync(configFile, configContent);
    
    // 生成证书签名请求
    execSync(`openssl req -new -key ${certsDir}/server.key -out ${certsDir}/server.csr -config ${configFile}`, { stdio: 'inherit' });
    
    // 生成自签名证书
    execSync(`openssl x509 -req -days 365 -in ${certsDir}/server.csr -signkey ${certsDir}/server.key -out ${certsDir}/server.crt -extensions v3_req -extfile ${configFile}`, { stdio: 'inherit' });
    
    // 删除临时文件
    fs.unlinkSync(path.join(certsDir, 'server.csr'));
    fs.unlinkSync(configFile);
    
    console.log('✅ SSL证书生成成功！');
    console.log('证书文件位置：');
    console.log(`  - 私钥: ${certsDir}/server.key`);
    console.log(`  - 证书: ${certsDir}/server.crt`);
    console.log('');
    console.log('🌐 证书支持的地址：');
    ips.forEach(ip => {
        console.log(`  - ${ip}`);
    });
    console.log('');
    console.log('⚠️  注意：这是自签名证书，浏览器会显示安全警告。');
    console.log('   在浏览器中点击"高级"并选择"继续访问"即可。');
    
} catch (error) {
    console.error('❌ 证书生成失败:', error.message);
    console.log('');
    console.log('💡 请确保系统已安装OpenSSL：');
    console.log('   - macOS: brew install openssl');
    console.log('   - Ubuntu/Debian: sudo apt-get install openssl');
    console.log('   - Windows: 下载并安装OpenSSL for Windows');
    process.exit(1);
} 