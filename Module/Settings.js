const myConfig = require('../config.json')

module.exports={
    "host": myConfig.Database.host,
    "user": myConfig.Database.user,
    "password": myConfig.Database.password,
    "database": myConfig.Database.database,
    "port": myConfig.Database.port
};