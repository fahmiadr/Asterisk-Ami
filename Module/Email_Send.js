const myConnection = require('./Query');
const logger = require('./logger');
const nodemailer = require('nodemailer');
const setting = require('./Settings');
const mysql = require('mysql2');

// fungsi untuk mengirim email
async function sendEmail(id, from, to, cc, subject, message) {
    // konfigurasi email
    const data = await myConnection.getEmailAccount(from);

    var tls;
    if(data.tls=='1') tls=true;
    else tls=false;

    logger("Define.Account.Structure.");
    logger("Host="+data.host);
    logger("Port="+data.port);
    logger("Secure="+tls);
    logger("Username="+data.username);

    const transporter = nodemailer.createTransport({
        host: data.host,
        port: data.port,
        secure: tls,
        auth: {
        user: data.username,
        pass: data.password
        }
    });

    logger("Define.Email.Structure.");
    const myAttachment = await myConnection.getAttachmentInbound(id);
    logger(`attachment.data=${JSON.stringify(myAttachment)}`)
    const mailOptions = {
      from: from,
      to: to,
      cc: cc,
      subject: subject,
      html: message,
      attachments:myAttachment
    };
    
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        logger("ERROR!" + error.message);
      } else {
        console.log('Email.Sent=' + info.response);
      }
      myConnection.updateEmailOutStatus(id);
    });
  }

function getEmailOut(){
    logger("Email.Out.Retrieve.Setting.Connection.from.Config.");
    const connection = mysql.createConnection(setting);

    logger("Query.get.Email.Out.");
    const data = connection.query("select id,eto,efrom,ecc,esubject,ebody from email_out where sent='0' order by edate asc", (err,rows)=> {
        if(err) throw err;
        for(let i=0;i<rows.length;i++){
            const id=rows[i].id;
            const eto=rows[i].eto;
            const efrom=rows[i].efrom;
            const ecc=rows[i].ecc;
            const esubject=rows[i].esubject;
            const ebody=rows[i].ebody;

            logger("Get.New.Data");
            logger(`ID=${id}`);
            logger(`To=${eto}`);
            logger(`From=${efrom}`);
            logger(`CC=${ecc}`);
            logger(`Subject=${esubject}`);
            logger(`Body=${ebody}`);

            sendEmail(id,efrom,eto,ecc,esubject,ebody);
        }

     });
     
    connection.end((error)=> {
        if(error) logger("ERROR!:getEmailOut.End.Database.Connection");

        logger("getEmailOut.End.Database.Connection")
    });
    
    setTimeout(getEmailOut,10000);
}

module.exports={
  getEmailOut
}