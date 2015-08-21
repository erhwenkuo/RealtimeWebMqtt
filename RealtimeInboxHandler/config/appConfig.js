var appConfig = {};

// Redis connection info
appConfig.redis = {};
appConfig.redis.host = 'localhost';
appConfig.redis.port = 6379;

// Mqtt Connection info
appConfig.mqtt = {};
appConfig.mqtt.host = 'localhost'; 
appConfig.mqtt.port = 1883; //mqtt broker normal tcp connection port
appConfig.mqtt.keepalive = 10;
appConfig.mqtt.clientId = 'rtInboxHandler_' + Math.random().toString(16).substr(2, 8);
appConfig.mqtt.clean = true;
appConfig.mqtt.reconnectPeriod = 1000;
appConfig.mqtt.connectTimeout = 30 * 1000;
appConfig.mqtt.will = {
    topic: 'WillMsg',
    payload: 'Connection Closed abnormally..!',
    qos: 0,
    retain: false
};
appConfig.mqtt.username = '';
appConfig.mqtt.password = '';
appConfig.mqtt.rejectUnauthorized = false;


module.exports = appConfig;
