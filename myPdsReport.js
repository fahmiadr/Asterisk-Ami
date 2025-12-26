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
          // await insertCallEvent(event);

          const e = event.event?.toLowerCase();
          const direction = 'inbound';//= detectDirection(event.channel);

          switch (e) {
            case 'queuecallerjoin':
                logger(`📥 AMI.REPORT.QueueCallerJoin: ${JSON.stringify(event, null, 2)}`);
                await query.onQueueCallerJoin(event);
                break;
            case 'agentringnosnswer':
                logger(`📥 AMI.REPORT.AgentRingNoAnswer: ${JSON.stringify(event, null, 2)}`);
                await query.onAgentRingNoAnswer(event);
                break;
            case 'bridgeenter':
                logger(`📥 AMI.REPORT.BridgeEnter: ${JSON.stringify(event, null, 2)}`);
                await query.onBridgeEnter(event);
                break;
            case 'queuecallerabandon':
                logger(`📥 AMI.REPORT.QueueCallerAbandon: ${JSON.stringify(event, null, 2)}`);
                await query.onQueueCallerAbandon(event);
                break;
            case 'queuecallerleave':
                logger(`📥 AMI.REPORT.QueueCallerLeave: ${JSON.stringify(event, null, 2)}`);
                await query.onQueueCallerLeave(event);
                break;
            case 'hangup':
                logger(`📥 AMI.REPORT.Hangup: ${JSON.stringify(event, null, 2)}`);
                await query.onHangup(event);
                break;
            // ===== AGENT STATE EVENTS =====
            case 'agentlogin':
            case 'agentlogoff':
            case 'agentpause':
            case 'agentunpause':
            case 'agentcalled':
            case 'agentconnect':
            case 'agentcompletecaller':
            case 'agentcomplete':
              logger(`📥 AMI.REPORT.AgentEvent: ${JSON.stringify(event, null, 2)}`);
              await query.onStateAgentEvent(event);
              break;
            case 'queuememberadded':
            case 'queuememberremoved':
            case 'queuememberstatus':
            case 'queuememberpause':
              logger(`📥 AMI.REPORT.QueueMemberEvent: ${JSON.stringify(event, null, 2)}`);
              await query.onStateQueueMemberStatus(event);
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

