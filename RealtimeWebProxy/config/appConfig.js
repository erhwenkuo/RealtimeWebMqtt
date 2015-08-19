var appConfig = {};

// define which tcp port this service bind to
appConfig.servicePort = 80;

// setup http service host:port & mqtt websocket host:port
appConfig.options = {
    'http' : 'http://localhost:1337',
    'mqtt' : 'http://52.69.150.31:9001'
}

module.exports = appConfig;
