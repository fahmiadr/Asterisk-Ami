var imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
const _ = require('lodash');
const myConnection = require('./Query');
const configurationFile = require('../config.json');
const logger = require('./logger');
const moment = require('moment');
const tlsOptions = { rejectUnauthorized: false };
const saveAttachment = require('./SaveAttachment')
const random_string = require('./random_string');
const { imap } = require('utf7');

const config = {
    imap: {
      user: "email.tiketing.selindo@gmail.com",
      password: "dnijfpzpihernjmg",
      host: "imap.gmail.com",
      port: "993",
      tls: false,
      tlsOptions: tlsOptions
    }
};

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

const readEmail = async function(){
    try{
        
    logger("Get.Email.Account.Inbound");

    const data = await myConnection.getEmailAccountInbound();
        
    data.tls=1;
    data.port=993;
    logger(`user = ${data.username}`);
    logger(`password = ${data.password}`);
    logger(`host = ${data.host}`);
    logger(`port = ${data.port}`);
    logger(`tls = ${data.tls}`);

    const configs = {
        imap: {
            user: data.username,
            password: data.password,
            host: data.host,
            port: data.port,
            tls: Boolean(data.tls),
            tlsOptions: tlsOptions
        }
    }

    await imaps.connect(configs).then(function (connection) {
        logger("Imaps.Running");
        logger("new date = " + new Date());
        return connection.openBox('INBOX').then(function () {
            var searchCriteria = [
                //'UNSEEN'
                ['SINCE', new Date()]
            ];
            var fetchOptions = {
                bodies: ['HEADER', 'TEXT', ''],
                markSeen: true,
                struct: true
            };
            return connection.search(searchCriteria, fetchOptions).then(function (messages) {
                var attachments=[];
                messages.forEach(function (item) {
                    var all = _.find(item.parts, { "which": "" })
                    var id = random_string(15);// item.attributes.uid;
                    var idHeader = "Imap-Id: "+id+"\r\n";                    
                    simpleParser(idHeader+all.body, (err, mail) => {
                        // access to the whole mail object
                        var varTo;
                        var varCC;
                        var tanggal = moment(mail.date).format('YYYY-MM-DD HH:mm:ss');

                        for (let i = 0; i < mail.to.value.length; i++) {
                            varTo+=mail.to.value[i].address+";"
                        }

                        try {
                            logger(`CC=${JSON.stringify(mail.cc)}`)
                            for (let i = 0; i < mail.cc.value.length; i++) {
                                varCC=mail.cc.value[i].address+";"
                            }                            
                        } catch (error) {
                            logger(`ERROR When get cc var`)
                        }
                        
                        logger("ID = " + id);
                        logger("From = " + mail.from.value[0].address)
                        logger("To = " + varTo)
                        logger("CC = " + varCC)
                        logger("Date = " + tanggal)
                        logger("Subject = " + mail.subject)
                        logger("Body = " +mail.html)

                        myConnection.saveEmail(id,
                            varTo,
                            mail.from.value[0].address,
                            mail.subject,
                            tanggal,
                            mail.html);
                    });
                    
                    /*
                    ; Deletion
                    */
                    //connection.deleteMessage(item.attributes.uid);
                    

                    /*
                    * Attachments
                    */
                    logger(`EmailId=${id}:Check.Attachments`);
                    logger(`message.struct=${item.attributes.struct}, JSON=${JSON.stringify(item.attributes.struct)}`);
                    var parts = imaps.getParts(item.attributes.struct);
                    attachments = attachments.concat(parts.filter(function (part) {
                        logger(`EmailId=${id}:Find.Attachments.`);
                        return part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT';
                    }).map(function (part) {
                        // retrieve the attachments only of the messages with attachments
                        logger(`EmailId=${id}:Attachments.Founded.`);
                        return connection.getPartData(item, part)
                            .then(function (partData) {
                                var filenameEncrypt=random_string(10)+"_"+part.disposition.params.filename;
                                logger(`Id=${id}`)
                                logger(`Filename=${filenameEncrypt}`)
                                myConnection.saveAttachment(id,configurationFile.Attachments.Path,filenameEncrypt);
                                //logger(`FilenameEncypt=${filenameEncrypt}`)
                                //logger(`Data = ${JSON.stringify(partData)}`)
                                saveAttachment.saveAttachments(filenameEncrypt,
                                    configurationFile.Attachments.Path,
                                    partData)
                                return {
                                    filename: part.disposition.params.filename,
                                    data: partData,
                                    id: id
                                };
                            });
                    }));
                });

                //return Promise.all(attachments);
                logger("Exit");
                connection.end();
            });
        }).then(function (attachments){
            logger(JSON.stringify(attachments));
        });
    });
    }catch(error){
        logger("ERROR!:ReadEmail.Msg="+error.message);
    }
}

const runEmailreceive = async function(){
    await readEmail();
    setTimeout(runEmailreceive,10000);
    /*setTimeout(() => {
        logger("Delay");
    }, 5000);
    runEmailreceive();
    */
}

module.exports = {
    readEmail,
    runEmailreceive
}
