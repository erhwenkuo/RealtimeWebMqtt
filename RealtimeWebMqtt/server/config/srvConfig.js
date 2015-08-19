var srvConfig = {};

// define which tcp port this service bind to
srvConfig.servicePort = 1337;

// config Redis connection info
srvConfig.redis = {};
srvConfig.redis.host = 'localhost';
srvConfig.redis.port = 6379;

// config Mqtt Connection info
srvConfig.mqtt = {};
srvConfig.mqtt.host = 'localhost';
srvConfig.mqtt.port = 1883;
srvConfig.mqtt.keepalive = 10;
srvConfig.mqtt.clientId = 'rtWebServer_' + Math.random().toString(16).substr(2, 8);
srvConfig.mqtt.clean = true;
srvConfig.mqtt.reconnectPeriod = 1000;
srvConfig.mqtt.connectTimeout = 30 * 1000;
srvConfig.mqtt.will = {
    topic: 'WillMsg',
        payload: 'Connection Closed abnormally..!',
        qos: 0,
        retain: false
    };
srvConfig.mqtt.username = '';
srvConfig.mqtt.password = '';
srvConfig.mqtt.rejectUnauthorized = false;


module.exports = srvConfig;
