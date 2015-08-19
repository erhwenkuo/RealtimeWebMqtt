// load appConfig object
var appConfig = require('./config/appConfig.js');

// load redis client library
var redis = require('redis');
// connect to redis server
var redis_client = redis.createClient(appConfig.redis.port, appConfig.redis.host, {});

// load mqtt client library
var mqtt = require('mqtt');
// connect to mqtt broker
var mqtt_client = mqtt.connect(appConfig.mqtt);

// mqtt topics that this program want to subscribe
var inbox_topic = "demo/whoisonline/+/inbox";
var notification_topic = "demo/whoisonline/+/notification";

// listen mqtt event which is triggered whenever mqtt connect successfully
mqtt_client.on('connect', function () {
    console.log('mqtt client connected:' + appConfig.mqtt.clientId);

    // subscribe INBOX & NOTIFICATION topic  & UNREAD_INBOX_NOTIFICATION
    mqtt_client.subscribe(inbox_topic, { qos: 0 });
    mqtt_client.subscribe(notification_topic, { qos: 0 });
});

// ** listen to event which is triggered when "inbox" or "notification" message is received
mqtt_client.on('message', function (topic, message, pakcet) {
    console.log("Recieved Message:= " + message.toString() + "\nOn topic:= " + topic);
    
    // step1. put "inbox" or "notification" message to Redis List data structure
    redis_client.lpush(topic, message.toString());

    // step2. increment counter
    var unread_topic = topic + "/unread";
    var unread_count = 0;
    redis_client.incr(unread_topic, function (err, res) {
        unread_count = res;
        console.log("Topic: [" + unread_topic + "] is " + unread_count);
        
        // step3. publish message to notify the counter change
        mqtt_client.publish(unread_topic , unread_count.toString() , { qos: 0, retain: true });
    });   
});

// event which is triggered when mqtt connection encounter issues
mqtt_client.on('error', function (err) {
    console.log(err);
    client.end();
});


// event which is triggered when mqtt connection is closed
mqtt_client.on('close', function () {
    console.log(appConfig.mqtt.clientId + " disconected");
});

console.log("================================================");
console.log("#    rtInboxHandler console app is running     #");
console.log("================================================");