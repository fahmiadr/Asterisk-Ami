//const mysql = require('mysql2/promise');
//const setting = require('./Settings');
const { Pool } = require('pg');
const logger = require('./logger');
const mysqlPromise = require('mysql2/promise');
const config = require('../config.json');

/*
const saveEmail = function(id,to,from,subject,date,body){
    logger("Save.Data.Id="+id);
    const param =  [id, '1', from, to, subject, body, date, '2023-02-01'];
    const myQuery=`insert into email_mailbox (email_id,direction,efrom,eto,esubject,
        ebody_html,date_email,date_receive) values (?,?,?,?,?,?,?,?)`;

    logger(`Execute.Query=${myQuery}, Param=${param}`);

    const connection = mysql.createConnection(setting);
    const data = connection.query(myQuery,param, (err,rows)=> {
        if(err) logger(`Error=${err.message}`);
        else logger(`Rows.Affected=${rows.affectedRows}`);
     });
     
     connection.end((error)=> {
        if(error) logger("ERROR!:saveEmail.End.Database.Connection");
        else logger("saveEmail.End.Database.Connection")
    })
}

const getEmailAccountInbound = async function(){
    try{        
        const myQuery = "select username,password,host,port,tls from email_account where type='Inbound'";

        logger(`Execute.Query=${myQuery}`);

        const connection = await mysql.createConnection(setting);
        const [rows, fields] = await connection.promise().query(myQuery);
        
        connection.end((error)=> {
            if(error) logger("ERROR!:getEmailAccountInbound.End.Database.Connection");
    
            logger("getEmailAccount.End.Database.Connection")
        });
        //logger(`Username=${rows[0].username},Password=${rows[0].password}`);
        return rows[0];
    }
    catch(error){
        logger("ERROR!;STATE=getEmailAccountInbound;Msg="+error.message);
    }
}

const saveAttachment = function(id,path,filename){
    const param =  [id,path,filename];
    const myQuery=`insert into email_attachments (email_id,url,filename) values (?,?,?)`;

    logger(`Execute.Query=${myQuery}, Param=${param}`);

    const connection = mysql.createConnection(setting);
    const data = connection.query(myQuery,param, (err,rows)=> {
        if(err) logger(`Error=${err.message}`);
        else logger(`Rows.Affected=${rows.affectedRows}`);
     });

     connection.end((error)=> {
        if(error) logger("ERROR!:saveAttachment.End.Database.Connection");
        else logger("saveAttachment.End.Database.Connection")
    })
}

const getEmailAccount = async function(email){
    try{        
        const param = [email];
        const myQuery = `select username, password, host, port, tls from email_account where username=? and type='Outbound' LIMIT 1`;

        logger(`Execute.Query=${myQuery}, Param=${param}`);

        const connection = await mysql.createConnection(setting);
        const [rows, fields] = await connection.promise().query(myQuery,param);
        
        connection.end((error)=> {
            if(error) logger("ERROR!:getEmailAccount.End.Database.Connection");
    
            logger("getEmailAccount.End.Database.Connection")
        });
        //logger(`Username=${rows[0].username},Password=${rows[0].password}`);
        return rows[0];
    }
    catch(error){
        logger("ERROR!;STATE=getEmailAccount;Msg="+error.message);
    }
}

const getAttachmentInbound = async function(id){
    try{        
        const param = [id];
        const myQuery = `select url,filename from email_attachments where email_id=?`;

        logger(`Execute.Query=${myQuery}, Param=${param}`);

        const connection = await mysql.createConnection(setting);
        const [rows, fields] = await connection.promise().query(myQuery,param);
        
        connection.end((error)=> {
            if(error) logger("ERROR!:getAttachmentInbound.End.Database.Connection");
    
            logger("getAttachmentInbound.End.Database.Connection")
        });
        var data=[];
        for(var i=0;i<rows.length;i++){
            var newData = {
                filename:rows[i].filename,
                path:rows[i].url+rows[i].filename
            }
            data.push(newData);
        }
        return data;
    }
    catch(error){
        logger("ERROR!;STATE=getEmailAccount;Msg="+error.message);
    }
}

const updateEmailOutStatus = function(id){
    const param = [id];
    const myQuery = `update email_out set sent='1', eDatesent=now() where id=?`;
    
    logger(`Execute.Query=${myQuery}, Param=${param}`);

    const connection = mysql.createConnection(setting);
    const data = connection.query(myQuery,param, (err,rows)=> {
        if(err) logger(`Error=${err.message}`);
        else logger(`Rows.Affected=${rows.affectedRows}`);
     });

    connection.end((error)=> {
        if(error) logger("ERROR!:updateEmailOutStatus.End.Database.Connection");
        else logger("updateEmailOutStatus.End.Database.Connection")
    })
}
*/

/*
 ;Module Query untuk Asterisk 
*/
// buat pool agar koneksi efisien
/*
const pool = mysql.createPool({
  host: config.DB.host,
  port: config.DB.port, 
  user: config.DB.user,
  password: config.DB.password,
  database: config.DB.name,
  waitForConnections: true,
  connectionLimit: 10,
});
*/

// buat pool untuk pg
const pool = new Pool({
  host: config.DB.host,
  port: config.DB.port,
  user: config.DB.user,
  password: config.DB.password,
  database: config.DB.name,
  max: 10, // sama seperti connectionLimit
  idleTimeoutMillis: 30000,
});

// Insert call baru
async function insertNewChannel(event, direction) {
  const now = new Date();
  const sql = `
    INSERT INTO calls
    (unique_id, direction, caller_id, callee_id, source_channel, status, start_time, created_at, linked_id, abandon)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
    ON CONFLICT (unique_id) DO NOTHING
  `;
  const params = [
    event.uniqueid,
    direction,
    event.calleridnum || null,
    event.exten || null,
    event.channel,
    'ringing',
    now,
    event.linkedid,
    'No'
  ];
  try {
    await pool.query(sql, params);
    logger(`[NEWCHANNEL] ${event.calleridnum || ''} -> ${event.exten || ''}`);
  } catch (err) {
    logger(`❌ DB Error (insertNewChannel): ${err.message}`);
  }
}

// Update call jadi answered
async function updateAnswered(event) {
  const now = new Date();
  try {    
    logger(`[ANSWERED] ${event.uniqueid}`);
    await pool.query(
      `UPDATE calls 
       SET status = $1, answer_time = $2, billsec = NULL 
       WHERE unique_id = $3`,
      ['answered', now, event.uniqueid]
    );
  } catch (err) {
    logger(`❌ DB Error (updateAnswered): ${err.message}`);
  }
}

// ✅ Insert ke table call_events
async function insertCallEvent(event) {
  const sql = `
    INSERT INTO call_events (
      unique_id, event_time, event_type, channel, queue_name, agent_id, event_data
    ) VALUES ($1, NOW(), $2, $3, $4, $5, $6)
  `;

  const params = [
    event.uniqueid || null,
    event.event || 'Unknown',
    event.channel || null,
    event.queue || event.queue_name || null,
    event.agent || event.membername || null,
    JSON.stringify(event),
  ];

  try {
    await pool.query(sql, params);
    logger(`[EVENT STORED] ${event.event} - ${event.uniqueid}`);
  } catch (err) {
    logger(`❌ DB Error (insertCallEvent): ${err.message}`);
  }
}

// Update holdtime, ringtime dan queue
async function updateAgentConnect(event){
  try {
    // update by uniqueid
      logger(`[AGENTCONNECT] ${event.uniqueid}`);
      await pool.query(
        `UPDATE calls 
         SET queue = $1, hold_time = $2, ring_time = $3
         WHERE unique_id = $4`,
        [
          event.queue,
          event.holdtime,
          event.ringtime,
          event.uniqueid
        ]
      );
  } catch(err) {
    logger(`❌ DB Error (updateAgentConnect): ${err.message}`);
  }
}

// Update holdtime, ringtime dan queue
async function updateAgentAbandon(event){
  try {
    // update by uniqueid
      logger(`[AGENTABANDON] ${event.uniqueid}`);
      await pool.query(
        `UPDATE calls 
         SET queue = $1, abandon = $2
         WHERE unique_id = $3`,
        [
          event.queue,
          'Yes',
          event.uniqueid
        ]
      );
  } catch(err) {
    logger(`❌ DB Error (updateAgentConnect): ${err.message}`);
  }
}

// Update call jadi hangup
async function updateHangup(event) {
  const now = new Date();
  try {
    const result = await pool.query(
      `SELECT start_time, answer_time 
       FROM calls 
       WHERE unique_id = $1`,
      [event.uniqueid]
    );

    if (result.rows.length > 0) {
      const start = new Date(result.rows[0].start_time);
      const answer = result.rows[0].answer_time
        ? new Date(result.rows[0].answer_time)
        : null;

      const duration = Math.floor((now - start) / 1000);
      const billsec = answer ? Math.floor((now - answer) / 1000) : 0;

      await pool.query(
        `UPDATE calls 
         SET status = $1, end_time = $2, duration = $3, billsec = $4, hangup_cause = $5, hangup_by = $6
         WHERE unique_id = $7`,
        [
          'hangup',
          now,
          duration,
          billsec,
          event.cause_txt || event.cause,
          detectHangupBy(event),
          event.uniqueid,
        ]
      );

      logger(`[HANGUP] ${event.uniqueid} (${duration}s)`);
    }
  } catch (err) {
    logger(`❌ DB Error (updateHangup): ${err.message}`);
  }
}

/* 
  ; Table Agents
*/
async function updateAgentsLogin(event){
  try {
    // update by uniqueid
      logger(`[AMI.AGENTS.LOGIN].QUEUE=${event.queue},EXT=${event.membername}`);
      await pool.query(
        `UPDATE agents
          SET 
              status = 'Logged In',
              last_login = NOW(),
              login_time = NOW(),
              queue_name = $1,
              updated_at = NOW()
          WHERE extension = $2;`,
        [
          event.queue,
          event.membername
        ]
      );
  } catch(err) {
    logger(`❌ DB Error (updateAgentsLogin): ${err.message}`);
  }
}

async function updateAgentsLogout(event){
  try {
    // update by uniqueid
      logger(`[AMI.AGENTS.LOGIN].QUEUE=${event.queue},EXT=${event.membername}`);
      await pool.query(
        `UPDATE agents
          SET 
              status = 'Logged Out',
              last_logout = NOW(),
              logout_time = NOW(),
              queue_name = $1,
              updated_at = NOW()
          WHERE extension = $2;`,
        [
          event.queue,
          event.membername
        ]
      );
  } catch(err) {
    logger(`❌ DB Error (updateAgentsLogout): ${err.message}`);
  }
}

async function updateAgentsAUX(event){
  try {
    // update by uniqueid
      logger(`[AMI.AGENTS.LOGIN].QUEUE=${event.queue},EXT=${event.membername}`);
      const paused = event.paused === "1";
      if(paused){
        // PAUSE
        await pool.query(
            `UPDATE agents 
             SET status = 'Aux',
                 last_pause = NOW(),
                 aux_reason = $1,
                 updated_at = NOW()
             WHERE extension = $2`,
            [event.pausedreason || '', event.membername]
        );
      }
      else{
        // UNPAUSE
        await pool.query(
            `UPDATE agents 
             SET status = 'Ready',
                 aux_reason = NULL,
                 last_unpause = NOW(),
                 updated_at = NOW()
             WHERE extension = $1`,
            [event.membername]
        );
      }
  } catch(err) {
    logger(`❌ DB Error (updateAgentsAUX): ${err.message}`);
  }
}

async function updateAgentsRinging(event) {
  try {
     const agentId = event.calleridnum;

    if (!agentId) return;

    logger(`[AMI.AGENTS.RINGING] QUEUE=${event.queue}, EXT=${agentId}`);

    await pool.query(
      `UPDATE agents
       SET
         status = 'Ringing'
       WHERE extension = $1`,
      [
        agentId
      ]
    );
  } catch (err) {
    logger(`❌ DB Error (updateAgentsRinging): ${err.message}`);
  }
}

async function updateAgentsConnected(event) {
  try {
    const agentId =
      event.membername ||
      event.connectedlinenum ||
      (event.channel?.match(/(?:PJSIP|SIP)\/(\d+)/)?.[1]);

    if (!agentId) return;

    logger(`[AMI.AGENTS.CONNECTED] EXT=${agentId}`);

    await pool.query(
      `UPDATE agents
       SET
         status = 'Connected'
       WHERE extension = $1`,
      [agentId]
    );
  } catch (err) {
    logger(`❌ DB Error (updateAgentsConnected): ${err.message}`);
  }
}

async function updateAgentsHangup(event) {
  try {
    const agentId =
      event.membername ||
      event.connectedlinenum ||
      (event.channel?.match(/(?:PJSIP|SIP)\/(\d+)/)?.[1]);

    if (!agentId) return;

    logger(`[AMI.AGENTS.HANGUP] EXT=${agentId}`);

    await pool.query(
      `UPDATE agents
       SET
         status = 'Avail'
            WHERE extension = $1`,
      [agentId]
    );
  } catch (err) {
    logger(`❌ DB Error (updateAgentsHangup): ${err.message}`);
  }
}

// Helper
function detectHangupBy(event) {
  if (!event) return 'system';
  if (event.calleridnum && event.connectedlinenum && event.calleridnum !== event.connectedlinenum)
    return 'caller';
  return 'agent';
}

function detectDirection(channel) {
  if (!channel) return 'internal';
  if (channel.startsWith('SIP/') || channel.startsWith('PJSIP/')) {
    return channel.includes('out') ? 'outbound' : 'inbound';
  }
  return 'internal';
}

/*
; Report
*/

function extractCommon(event) {
  return {
    callId: event.linkedid || event.uniqueid,
    uniqueid: event.uniqueid,
    queueName: event.queue || event.queuename || null,
    agentId:
      event.membername ||
      event.connectedlinenum ||
      (event.channel?.match(/(?:PJSIP|SIP)\/(\d+)/)?.[1]) ||
      null,
    eventTime: event.eventtime
      ? new Date(event.eventtime * 1000)
      : new Date()
  };
}

async function insertQueueEvent({
  eventTime,
  callId,
  uniqueid,
  queueName,
  agentId,
  eventName,
  waitTime = null,
  talkTime = null,
  rawEvent
}) {
  try {
    await pool.query(
      `
      INSERT INTO cc_queue_event
      (
        event_time,
        call_id,
        uniqueid,
        queue_name,
        agent_id,
        event,
        wait_time,
        talk_time,
        raw_event
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        eventTime,
        callId,
        uniqueid,
        queueName,
        agentId,
        eventName,
        waitTime,
        talkTime,
        rawEvent
      ]
    );
  } catch (err) {
    logger(`❌ DB Error (insertQueueEvent): ${err.message}`);
  }
}

async function onQueueCallerJoin(event) {
  const c = extractCommon(event);

  await insertQueueEvent({
    ...c,
    eventName: 'ENTERQUEUE',
    rawEvent: event
  });
}

async function onAgentRingNoAnswer(event) {
  const c = extractCommon(event);

  await insertQueueEvent({
    ...c,
    eventName: 'RINGNOANSWER',
    rawEvent: event
  });
}

async function onBridgeEnter(event) {
  const c = extractCommon(event);

  await insertQueueEvent({
    ...c,
    eventName: 'CONNECT',
    waitTime: event.holdtime ? parseInt(event.holdtime) : null,
    rawEvent: event
  });
}

async function onQueueCallerAbandon(event) {
  const c = extractCommon(event);

  await insertQueueEvent({
    ...c,
    eventName: 'ABANDON',
    waitTime: event.waittime ? parseInt(event.waittime) : null,
    rawEvent: event
  });
}

async function onQueueCallerLeave(event) {
  const c = extractCommon(event);

  await insertQueueEvent({
    ...c,
    eventName: 'LEAVE',
    rawEvent: event
  });
}

async function onHangup(event) {
  const c = extractCommon(event);

  await insertQueueEvent({
    ...c,
    eventName: 'HANGUP',
    talkTime: event.talktime ? parseInt(event.talktime) : null,
    rawEvent: event
  });

  // existing logic
  // await updateAgentsHangup(event);
}

/*
; Agent State Event 
*/
const AGENT_STATE_MAP = {
  agentlogin:           'AVAIL',
  agentlogoff:          'OFF',
  agentpause:           'AUX',
  agentunpause:         'AVAIL',
  agentcalled:          'RING',
  agentconnect:         'ACD',
  agentcomplete:        'ACW',
  agentcompletecaller:  'ACW'
};

function extractAgent(event) {
  const agentId =
    event.MemberName ||
    event.membername ||
    event.Agent ||
    event.agent ||
    event.Interface?.match(/(?:PJSIP|SIP|Local)\/(\d+)/)?.[1];

  if (!agentId) return null;

  return {
    agentId,
    eventTime: event.EventTime
      ? new Date(event.EventTime * 1000)
      : new Date()
  };
}

async function switchAgentState({
  agentId,
  newState,
  eventTime,
  sourceEvent,
  rawEvent,
  reason,
  queue,
  callId
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. close previous active state
    await client.query(
      `
      UPDATE agent_state_event
      SET end_time = $1
      WHERE agent_id = $2
        AND end_time IS NULL
      `,
      [eventTime, agentId]
    );

    // 2. insert new state
    await client.query(
      `
      INSERT INTO agent_state_event
      (
        agent_id,
        state,
        start_time,
        source_event,
        raw_event,
        reason,
        queue_name,
        call_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        agentId,
        newState,
        eventTime,
        sourceEvent,
        rawEvent,
        reason,
        queue,
        callId
      ]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    logger(`❌ DB Error (switchAgentState): ${err.message}`);
  } finally {
    client.release();
  }
}

async function onStateAgentEvent(event) {
  const data = extractAgent(event);
  if (!data) return;

  const state = AGENT_STATE_MAP[event.event?.toLowerCase()];
  if (!state) return;

  let reason = null;
  if(event.event==='AgentComplete') reason = event.reason;
  else if(event.event==='AgentCompleteCaller') event.reason;

  let callId=event.uniqueid||null;

  await switchAgentState({
    agentId: data.agentId,
    newState: state,
    eventTime: data.eventTime,
    sourceEvent: event.event,
    rawEvent: event,
    reason: reason,
    queue: event.queue,
    callId: callId
  });
}

async function onStateQueueMemberStatus(event) {
  logger(`QueueMemberEvent`)
  const data = extractAgent(event);
  if (!data) return;

  logger(`QueueMemberEvent.Found.Agent=${data.agentId}`);

  let state = null;
  let reason = null;
  let myEvent = event.event.toLowerCase();
  let callId = event.uniqueid || null;

  if(myEvent ==='queuememberremoved') state='OFF';
  else if(myEvent === 'queuememberadded') state='AVAIL';
  else if(myEvent === 'queuememberpause'){
    if (event.paused === '1') {
      state = 'AUX';
      reason = event.pausedreason;
    } 
    else if (event.paused === '0') state = 'READY';
  }

  if (!state) return;

  await switchAgentState({
    agentId: data.agentId,
    newState: state,
    eventTime: data.eventTime,
    sourceEvent: event.event,
    rawEvent: event,
    reason: reason,
    queue: event.queue,
    callId: callId
  });
}


module.exports={
    /*saveEmail,
    saveAttachment,
    updateEmailOutStatus,
    getEmailAccount,
    getEmailAccountInbound,
    getAttachmentInbound,*/
    insertNewChannel,
    updateAnswered,
    updateHangup,
    insertCallEvent,
    updateAgentConnect,
    updateAgentsLogin,
    updateAgentsLogout,
    updateAgentsAUX,
    updateAgentAbandon,
    updateAgentsConnected,
    updateAgentsRinging,
    updateAgentsHangup,
    onAgentRingNoAnswer,
    onBridgeEnter,
    onHangup,
    onQueueCallerAbandon,
    onQueueCallerJoin,
    onQueueCallerLeave,
    onStateAgentEvent,
    onStateQueueMemberStatus
}