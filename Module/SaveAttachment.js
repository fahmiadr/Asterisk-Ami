const fs=require('fs');
const logger = require('./logger');

const saveAttachments = function(filename, path, data){
    logger("Data in attachemtn function = "+JSON.stringify(data));
    var thisBuffer = new Buffer(data.length)
    for (let i=0;i<data.length;i++){
        thisBuffer[i]=data[i];
    }
    fs.writeFile(path+filename,thisBuffer,(error)=>{
        if(error) logger(`ERROR!Save.Attachments. Msg=${error.message}`)
        else{
            logger(`Attachments.Path = ${path}`)
            logger(`Attachments.Filename = ${filename}`)
        }
    })
};

module.exports={
    saveAttachments
}