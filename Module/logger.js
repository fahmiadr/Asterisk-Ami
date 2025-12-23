const fs = require('fs');
const logjs = require('log4js')
const config = require('../config.json');

var loggers;

const logger = (data) => {
    
    const dateNow = Date.now();
    const myDate = new Date(dateNow);
    const year=myDate.getFullYear();
    const month=myDate.getMonth()+1;
    const day=myDate.getDate();
    const hour=myDate.getHours();
    const minute=myDate.getMinutes();
    const seconds=myDate.getSeconds();

    const directory = `./logs`;
    const filename = `${year}-${month}-${day}`;
    const hours = `${hour}:${minute}:${seconds}`;
    
    console.log(`${filename} ${hours} : ${data}`);
    /*
    data = `${filename} ${hours} : ${data}` + `\r\n`;

    try {
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        fs.appendFile(`${directory}/${filename}.log`, data, function (err) {
            if (err) return console.log(err);
        });
    } catch (err) {
        console.error(err)
    }
    */

    /*
    ; Using Log 4 js
    */
    if(!logjs.isConfigured()){
        logjs.configure({
            appenders: { AMI: { type: "file", filename: config.Log.Filename, 
                                                       maxLogSize: config.Log.MaxLogSize, 
                                                       backups: config.Log.MaxLogNumber, } },
            categories: { default: { appenders: ["AMI"], level: config.Log.Level } },
        });    
    }
    loggers = logjs.getLogger("AMI");
    loggers.debug(data);
}

module.exports = logger;
