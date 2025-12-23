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

          logger(`📥 AMI EVENT: ${JSON.stringify(event, null, 2)}`);
          
          // Jika ingin melakukan filter by Event tertentu saja di aktifkan code ini
          //const includeEvents = ['Newchannel', 'Hangup', 'QueueJoin', 'QueueLeave', 'Dial'];
          //if (!includeEvents.includes(event.event)) return;
       
          // Simpan semua event ke PostgreSQL
          // await insertCallEvent(event);

          const e = event.event?.toLowerCase();
          const direction = 'inbound';//= detectDirection(event.channel);

          switch (e) {
             /* =========================
              CHANNEL / CALL
            ========================== */
            case 'newchannel': 
              const direction = detectDirection(event.channel);
              logger(`📥 AMI EVENT AgentConnect: ${JSON.stringify(event, null, 2)}`);
              await query.insertNewChannel(event, direction);
              break;
            case 'newstate': 
              // Call answered
              if (event.channelstate === '6' || event.channelstatedesc === 'Up') {
                logger(`📥 AMI EVENT AgentConnect: ${JSON.stringify(event, null, 2)}`);
                await query.updateAnswered(event);
              }
              break;
            case 'queuecallerabandon':
              await query.updateAgentAbandon(event);
              logger(`📥 AMI EVENT AgentConnect: ${JSON.stringify(event, null, 2)}`);
              break;
            case 'hangup': 
              await query.updateHangup(event);
              logger(`📥 AMI EVENT AgentConnect: ${JSON.stringify(event, null, 2)}`);
              break;
            case 'agentconnect':
              await query.updateAgentConnect(event).catch(err => logger(`Insert error: ${err.message}`));
              logger(`📥 AMI EVENT AgentConnect: ${JSON.stringify(event, null, 2)}`);
              break;
            case 'stopmixmonitor':
            case 'mixmonitorstop':
              const filename = event.Filename?.trim();
              logger(`[MixMonitorStop] Filename:${filename}`);
              break;
            case 'mixmonitorstart':
              const thisFile = event.File?.trim();
              logger(`[MixMonitorStart] Filename:${thisFile}`);
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

