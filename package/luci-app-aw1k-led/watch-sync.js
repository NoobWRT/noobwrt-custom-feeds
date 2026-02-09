#!/usr/bin/env node

const chokidar = require('chokidar');
const SftpClient = require('ssh2-sftp-client');
const { Client: SSHClient } = require('ssh2');
const path = require('path');
const fs = require('fs').promises;
const fsSynchronous = require('fs');

// Configuration
const CONFIG = {
  host: '192.168.1.1',  // Change to your router's IP
  port: 22,
  username: 'root',     // Change to your router's username
  password: '',         // Add your password or use privateKey
  // privateKey: require('fs').readFileSync('/path/to/private/key'),
  readyTimeout: 10000,
};

// Path mappings: local -> remote
// OpenWrt packages put target filesystem content under ./files
const PATH_MAPPINGS = [
  {
    local: 'files',
    remote: '/',
    description: 'Package filesystem (files/ -> /)'
  },
  {
    local: 'qmodem/led-status-check.sh',
    remote: '/usr/bin/led-status-check.sh',
    description: 'QModem reference script',
    isFile: true
  }
];

const BASE_DIR = __dirname;

class ThemeSync {
  constructor() {
    this.sftp = new SftpClient();
    this.ssh = new SSHClient();
    this.isConnected = false;
    this.reconnectTimeout = null;
    this.lastRestartTime = 0;
    this.restartDebounceMs = 1000; // Debounce restarts to max 1 per second
  }

  async connect() {
    try {
      console.log(`🔌 Connecting to ${CONFIG.host}...`);
      await this.sftp.connect(CONFIG);
      this.ssh.connect(CONFIG);
      this.isConnected = true;
      console.log('✅ Connected to router\n');
    } catch (err) {
      console.error('❌ Connection failed:', err.message);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      this.ssh.exec(command, (err, stream) => {
        if (err) return reject(err);
        
        let stdout = '';
        let stderr = '';
        
        stream.on('close', (code, signal) => {
          resolve({ code, stdout, stderr });
        });
        
        stream.on('data', (data) => {
          stdout += data.toString();
        });
        
        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    });
  }

  async restartLedService() {
    const now = Date.now();
    if (now - this.lastRestartTime < this.restartDebounceMs) {
      return; // Skip if restart was done recently
    }
    this.lastRestartTime = now;

    if (!this.isConnected) {
      console.log('⏭️  Skipping LED restart (not connected)\n');
      return;
    }

    try {
      console.log('🔄 Restarting LED service...');
      const result = await this.executeCommand('/etc/init.d/led-status restart && echo "LED restarted"');
      
      if (result.code === 0) {
        console.log('✅ LED service restarted\n');
      } else {
        console.log(`⚠️  Restart exit code: ${result.code}`);
        if (result.stderr) console.log(`   Error: ${result.stderr}\n`);
      }
    } catch (err) {
      console.error(`❌ Restart failed:`, err.message);
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        this.isConnected = false;
        this.scheduleReconnect();
      }
      console.log();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) return;
    
    console.log('⏳ Reconnecting in 5 seconds...\n');
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 5000);
  }

  async ensureConnection() {
    if (!this.isConnected) {
      await this.connect();
    }
    return this.isConnected;
  }

  getRemotePath(localPath) {
    const relativePath = path.relative(BASE_DIR, localPath);
    
    for (const mapping of PATH_MAPPINGS) {
      const localNormalized = mapping.local.replace(/\\/g, path.sep);
      
      if (mapping.isFile) {
        if (relativePath.replace(/\\/g, path.sep) === localNormalized) {
          return mapping.remote;
        }
      } else {
        if (relativePath.replace(/\\/g, path.sep).startsWith(localNormalized)) {
          const subPath = relativePath.slice(localNormalized.length)
            .replace(/\\/g, '/')
            .replace(/^\//, '');
          return `${mapping.remote}${subPath ? '/' + subPath : ''}`;
        }
      }
    }
    
    return null;
  }

  async ensureRemoteDir(remotePath) {
    const dir = path.posix.dirname(remotePath);
    try {
      await this.sftp.mkdir(dir, true);
    } catch (err) {
      // Directory might already exist
      if (err.code !== 4) { // 4 = Failure
        console.error(`   ⚠️  Could not create directory ${dir}:`, err.message);
      }
    }
  }

  async uploadFile(localPath) {
    if (!await this.ensureConnection()) {
      console.log(`⏭️  Skipping ${localPath} (not connected)`);
      return;
    }

    const remotePath = this.getRemotePath(localPath);
    if (!remotePath) {
      console.log(`⏭️  Skipping ${localPath} (not in watched paths)`);
      return;
    }

    try {
      if (this.shouldNormalize(localPath, remotePath)) {
        this.normalizeLineEndings(localPath);
      }
      console.log(`📤 Uploading: ${path.basename(localPath)}`);
      console.log(`   Local:  ${localPath}`);
      console.log(`   Remote: ${remotePath}`);
      
      await this.ensureRemoteDir(remotePath);
      await this.sftp.put(localPath, remotePath);

      if (this.shouldChmod(remotePath)) {
        await this.chmodExecutable(remotePath);
      }
      
      console.log(`✅ Synced successfully`);
      await this.restartLedService();
    } catch (err) {
      console.error(`❌ Upload failed:`, err.message);
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        this.isConnected = false;
        this.scheduleReconnect();
      }
      console.log();
    }
  }

  shouldNormalize(localPath, remotePath) {
    if (localPath.endsWith('.sh')) return true;
    if (remotePath.endsWith('.sh')) return true;
    if (remotePath.startsWith('/etc/init.d/')) return true;
    if (remotePath.startsWith('/etc/uci-defaults/')) return true;
    return false;
  }

  normalizeLineEndings(localPath) {
    try {
      const buf = fsSynchronous.readFileSync(localPath);
      if (buf.includes(0x0d)) {
        const text = buf.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        fsSynchronous.writeFileSync(localPath, text, 'utf8');
        console.log('🔧 Normalized line endings (LF)');
      }
    } catch (err) {
      console.error(`❌ Line ending normalize failed for ${localPath}:`, err.message);
    }
  }

  shouldChmod(remotePath) {
    if (remotePath.endsWith('.sh')) return true;
    if (remotePath.startsWith('/usr/bin/')) return true;
    if (remotePath.startsWith('/etc/init.d/')) return true;
    if (remotePath.startsWith('/etc/uci-defaults/')) return true;
    return false;
  }

  async chmodExecutable(remotePath) {
    try {
      const result = await this.executeCommand(`chmod +x '${remotePath.replace(/'/g, "'\\''")}'`);
      if (result.code !== 0) {
        console.log(`⚠️  chmod failed (${result.code}) for ${remotePath}`);
        if (result.stderr) console.log(`   Error: ${result.stderr}\n`);
      }
    } catch (err) {
      console.error(`❌ chmod error:`, err.message);
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        this.isConnected = false;
        this.scheduleReconnect();
      }
    }
  }

  async deleteFile(localPath) {
    if (!await this.ensureConnection()) {
      console.log(`⏭️  Skipping deletion of ${localPath} (not connected)`);
      return;
    }

    const remotePath = this.getRemotePath(localPath);
    if (!remotePath) return;

    try {
      console.log(`🗑️  Deleting: ${remotePath}`);
      await this.sftp.delete(remotePath);
      console.log(`✅ Deleted successfully\n`);
    } catch (err) {
      console.error(`❌ Delete failed:`, err.message, '\n');
    }
  }

  startWatching() {
    const watchPaths = PATH_MAPPINGS.map(m => 
      path.join(BASE_DIR, m.local)
    );

    console.log('👀 Watching for changes:');
    PATH_MAPPINGS.forEach(m => {
      console.log(`   ${m.description}: ${m.local}`);
    });
    console.log();

    const watcher = chokidar.watch(watchPaths, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    watcher
      .on('add', filePath => {
        console.log(`➕ File added: ${path.basename(filePath)}`);
        this.uploadFile(filePath);
      })
      .on('change', filePath => {
        console.log(`✏️  File changed: ${path.basename(filePath)}`);
        this.uploadFile(filePath);
      })
      .on('unlink', filePath => {
        console.log(`➖ File deleted: ${path.basename(filePath)}`);
        this.deleteFile(filePath);
      })
      .on('error', error => {
        console.error('❌ Watcher error:', error);
      });

    console.log('✨ Watch mode active. Press Ctrl+C to stop.\n');
  }

  async forceSync() {
    if (!await this.ensureConnection()) {
      console.log('❌ Cannot force sync - not connected to router\n');
      return false;
    }

    console.log('🔄 Force syncing all files...\n');
    let uploadCount = 0;
    let errorCount = 0;

    for (const mapping of PATH_MAPPINGS) {
      const localPath = path.join(BASE_DIR, mapping.local);
      
      try {
        if (mapping.isFile) {
          // Single file
          if (fsSynchronous.existsSync(localPath)) {
            await this.uploadFile(localPath);
            uploadCount++;
          }
        } else {
          // Directory - recursively upload all files
          const files = await this.getAllFiles(localPath);
          for (const filePath of files) {
            try {
              await this.uploadFile(filePath);
              uploadCount++;
            } catch (err) {
              console.error(`❌ Failed to upload ${filePath}: ${err.message}`);
              errorCount++;
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error processing ${mapping.description}: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n✅ Force sync complete! Uploaded: ${uploadCount} files${errorCount > 0 ? `, Errors: ${errorCount}` : ''}\n`);
    return true;
  }

  async getAllFiles(dir) {
    const files = [];
    
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      if (item.name.startsWith('.')) continue; // Skip hidden files
      
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        files.push(...await this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async cleanup() {
    console.log('\n🛑 Shutting down...');
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.isConnected) {
      await this.sftp.end();
      this.ssh.end();
    }
    console.log('👋 Goodbye!');
    process.exit(0);
  }
}

// Main
async function main() {
  console.log('🚀 OpenWrt Package Sync - Starting...\n');

  const sync = new ThemeSync();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => sync.cleanup());
  process.on('SIGTERM', () => sync.cleanup());

  await sync.connect();
  
  // Check for force sync flag
  const args = process.argv.slice(2);
  if (args.includes('--force-sync') || args.includes('-f')) {
    const success = await sync.forceSync();
    if (success) {
      console.log('Starting watch mode...\n');
      sync.startWatching();
    } else {
      await sync.cleanup();
    }
  } else {
    sync.startWatching();
  }
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message);
  // Don't exit - keep watching
  setTimeout(() => {
    console.log('🔄 Restarting watcher...\n');
    // Try to reconnect
  }, 3000);
});
