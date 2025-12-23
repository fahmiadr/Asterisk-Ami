const AsteriskManager = require('asterisk-manager');
const mysql = require('mysql2/promise');  // gunakan mysql2 agar bisa async/await
const logger = require('./Module/logger');
const config = require('./config.json');
const query = require('./Module/Query');

// Konfigurasi koneksi AMI
const AMI_CONFIG = {
  port: config.AMI.port,
  host: config.AMI.host,
  username: config.AMI.username,
  password: config.AMI.password,
  reconnectDelay: config.AMI.reconnectDelay, // 5 detik
};

let ami = null;
let reconnecting = false;

// Fungsi untuk konek ke Asterisk
function connectAMI() {
    logger('🔄 Trying to connect to Asterisk AMI...');

    try {

        ami = new AsteriskManager(
        AMI_CONFIG.port,
        AMI_CONFIG.host,
        AMI_CONFIG.username,
        AMI_CONFIG.password,
        true
        );

        // Saat konek berhasil
        ami.on('connect', () => {
        reconnecting = false;
        logger(`✅ Connected to Asterisk AMI`);
        });

        // Saat koneksi error
        ami.on('error', (err) => {
        logger(`❌ AMI Connection Error: ${err.message}`);
        scheduleReconnect();
        });

        // Saat disconnect
        ami.on('disconnect', () => {
        logger(`⚠️ Disconnected from AMI`);
        scheduleReconnect();
        });

        // Contoh event listener (bisa disesuaikan)
        ami.on('managerevent', async (event) => {         

          //logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
          
          // Jika ingin melakukan filter by Event tertentu saja di aktifkan code ini
          //const includeEvents = ['Newchannel', 'Hangup', 'QueueJoin', 'QueueLeave', 'Dial'];
          //if (!includeEvents.includes(event.event)) return;
       
          // Simpan semua event ke PostgreSQL
          //await insertCallEvent(event);

          const e = event.event?.toLowerCase();
          const direction = 'inbound';//= detectDirection(event.channel);

          switch (e) { 
            case 'queuememberstatus':   
                break;
            case 'agentlogin':
            case 'queuememberadded':
                await query.updateAgentsLogin(event).catch(err => logger(`Insert error: ${err.message}`));
                logger(`📥 AMI.AGENTS: ${JSON.stringify(event, null, 2)}`);
                break;
            case 'queuememberremoved':
                await query.updateAgentsLogout(event).catch(err => logger(`Insert error: ${err.message}`));
                logger(`📥 AMI.AGENTS: ${JSON.stringify(event, null, 2)}`);
                break;
            case 'queuememberpause':
                await query.updateAgentsAUX(event).catch(err => logger(`Insert error: ${err.message}`));
                logger(`📥 AMI.AGENTS: ${JSON.stringify(event, null, 2)}`);
                break;
            default:
              break;
          }
        }
    );

    } catch (error) {
        console.error('🚫 Failed to initialize AMI:', error.message);
        scheduleReconnect();
    }
}

// Fungsi untuk detect Direction
function detectDirection(channel) {
  if (!channel) return 'internal';
  if (channel.startsWith('SIP/') || channel.startsWith('PJSIP/')) {
    return channel.includes('out') ? 'outbound' : 'inbound';
  }
  return 'internal';
}

// Fungsi untuk reconnect otomatis
function scheduleReconnect() {
  if (reconnecting) return; // hindari double reconnect
  reconnecting = true;
  logger(`⏳ Reconnecting in ${AMI_CONFIG.reconnectDelay / 1000} seconds...`);

  setTimeout(() => {
    connectAMI();
  }, AMI_CONFIG.reconnectDelay);
}

// Tutup koneksi saat Node dimatikan
process.on('SIGINT', () => {
  logger('🛑 Disconnecting from Asterisk AMI...');
  if (ami) ami.disconnect();
  process.exit(0);
});

// Jalankan koneksi awal
// connectAMI();

module.exports={
  connectAMI
}

