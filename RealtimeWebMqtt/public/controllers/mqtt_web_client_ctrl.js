// create angular controller
web_app.controller('mqtt_web_client_ctrl', function ($scope, $http, $state, Notification, app_config) {     
    // flags to control UI Component collapse or not
    $scope.isMqttConnection_Collapsed = true;
    $scope.isMqttPublish_Collapsed = true;
    $scope.isMqttSubscribe_Collapsed = true;
    $scope.isNotificationEnabled = true;
    
    // data model to control incoming MQTT messages
    $scope.messages = [];
    $scope.mqtt_message = {}
    $scope.mqtt_message.size = 10;
    $scope.clearMessages = function () {
        $scope.messages = [];
    };
    
    // function to control the size of MQTT messages in memory
    $scope.limitMessages = function () {
        //check message size limit
        if ($scope.messages.length > $scope.mqtt_message.size) {
            while ($scope.messages.length > $scope.mqtt_message.size) {
                $scope.messages.splice($scope.mqtt_message.size, 1);
            }
        }
    };   
    
    // MQTT broker connection parameters
    $scope.mqtt_client = {};    
    $scope.isConnected = false;
    $scope.mqtt_conn = {};
    $scope.mqtt_conn.host = app_config.mqtt_broker_url || "localhost";
    $scope.mqtt_conn.port = app_config.mqtt_broker_port || 9001;
    $scope.mqtt_conn.clientid = generateUUID();
    $scope.mqtt_conn.keep_alive = 60;
    $scope.mqtt_conn.clean_session = false;
    $scope.mqtt_conn.userid = "";
    $scope.mqtt_conn.password = "";
    $scope.mqtt_conn.lastwill_topic = "";
    $scope.mqtt_conn.lastwill_qos = 0;
    $scope.mqtt_conn.lastwill_message = "";
    $scope.mqtt_conn.lastwill_retain = true;
    
    // connect MQTT broker via websocket (make sure MQTT Broker websocket supported is enabled)
    $scope.connect = function () {
        // Create a mqtt client instance
        $scope.mqtt_client = new Paho.MQTT.Client($scope.mqtt_conn.host, Number($scope.mqtt_conn.port), $scope.mqtt_conn.clientid);
        
        var connOptions = {
            timeout: 3,
            cleanSession: $scope.mqtt_conn.clean_session,
            onSuccess: onConnectSuccess,
            onFailure: onConnectFail
        };
        
        if ($scope.mqtt_conn.userid.length > 0)
            connOptions.userName = $scope.mqtt_conn.userid;
        
        if ($scope.mqtt_conn.password.length > 0)
            connOptions.password = $scope.mqtt_conn.password;
        
        // configure Last-Will & Testament message
        if ($scope.mqtt_conn.lastwill_topic.length > 0) {
            var willmsg = new Paho.MQTT.Message($scope.mqtt_conn.lastwill_message);
            willmsg.qos = $scope.mqtt_conn.lastwill_qos;
            willmsg.destinationName = $scope.mqtt_conn.lastwill_topic;
            willmsg.retained = $scope.mqtt_conn.lastwill_retain;            
            connOptions.willMessage = willmsg;
        }
        
        // *** setup callback handlers ***
        $scope.mqtt_client.onConnectionLost = onConnectionLost;
        $scope.mqtt_client.onMessageArrived = onMessageArrived;
        
        // connect the client
        $scope.mqtt_client.connect(connOptions);
    }
    
    // function to disconnect MQTT broker connection
    $scope.disconnect = function () {
        $scope.mqtt_client.disconnect();
        
        if ($scope.mqtt_conn.clean_session)
            $scope.subscriptions = []; // cleanup client's subscriptions
    }
    
    // callback function used by MQTT client, this function will be called when 
    // the MQTT client connect to MQTT broker successfully
    function onConnectSuccess() {
        // Once a connection has been made, make a subscription and send a message
        $scope.isConnected = true;
        $scope.isMqttConnection_Collapsed = true;
        $scope.$apply();
        Notification.info({ title: 'MQTT Connection Status', message: "MQTT Broker Connection success" });
    }
    
    // callback function used by MQTT client, this function will be called when 
    // the MQTT client connect to MQTT broker fail
    function onConnectFail(message) {
        Notification.error({ title: 'MQTT Connection Status', message: "MQTT Broker Connection failed: " + message.errorMessage });
    }

    // callback function used by MQTT client, this function will be called when 
    // the MQTT client lost its connection to MQTT broker
    function onConnectionLost(responseObject) {
        if (responseObject.errorCode !== 0) {
            console.log("onConnectionLost: " + responseObject.errorMessage);
        }
        $scope.isConnected = false;
        $scope.$apply();
    }
    
    // ***callback function used by MQTT client, this function will be called when 
    // the MQTT client received messages from MQTT broker
    function onMessageArrived(message) {
        var topic = message.destinationName;
        
        var messageObj = {
            'topic': message.destinationName,
            'retained': message.retained,
            'qos': message.qos,
            'payload': message.payloadString,
            'timestamp': moment().format('YYYY-MM-DD, hh:mm:ss')
        };
        
        // show Notification on UI
        if ($scope.isNotificationEnabled) {
            Notification.info({ title: "Topic: " + messageObj.topic + ", Qos: " + messageObj.qos, message: messageObj.payload });
        }
        
        $scope.messages.unshift(messageObj);
        
        // check UI message size limit
        if ($scope.messages.length > $scope.mqtt_message.size) {
            while ($scope.messages.length > $scope.mqtt_message.size) {
                $scope.messages.splice($scope.mqtt_message.size, 1);
            }
        }
        
        $scope.$apply();
    }
    
    //***** MQTT Subscripiton Model *****//
    $scope.subscriptions = [];    
    $scope.mqtt_subscription = {};
    $scope.mqtt_subscription.topic = "";
    $scope.mqtt_subscription.qos = 0;
    
    // function to be called from UI Button for MQTT topic subscription
    $scope.subscribe = function () {
        if (!$scope.isConnected) {
            Notification.error("Subscribe:" + "Not connected");
            return;
        }        
        if ($scope.mqtt_subscription.topic.length < 1) {
            Notification.error("Subscribe:" + "Topic cannot be empty");
            return;
        }        
        var found = false;
        $scope.subscriptions.forEach(function (element, index, array) {
            if (element.topic == $scope.mqtt_subscription.topic) {
                found = true;
                return;
            }
        });
        if (found) {
            Notification.error("Subscribe:" + "You are already subscribed to this topic");
            return;
        }        
        var subscription = { 'topic': $scope.mqtt_subscription.topic, 'qos': Number($scope.mqtt_subscription.qos), 'color': $scope.mqtt_subscription.color };        
        // ask MQTT broker to subscribe given topic
        $scope.mqtt_client.subscribe(subscription.topic, { qos: subscription.qos });        
        // keep this topic subscription in page memory for later use
        $scope.subscriptions.push(subscription);
    };
    
    // function to be called from UI Button for MQTT topic subscription removal
    $scope.unsubscribe = function (index) {
        var subscription = $scope.subscriptions.splice(index, 1);
        var topic = subscription[0].topic;
        $scope.mqtt_client.unsubscribe(topic);
    };
    
    //***** Mqtt Publish Model *****//
    $scope.mqtt_publish = {};
    $scope.mqtt_publish.topic = "";
    $scope.mqtt_publish.qos = 0;
    $scope.mqtt_publish.retain = false;
    $scope.mqtt_publish.message = "";
    
    // function to be called from UI Button for publish message to MQTT broker
    $scope.publish = function () {
        if (!$scope.isConnected) {
            Notification.error("Publish:" + "Not connected");
            return;
        }        
        if ($scope.mqtt_publish.topic.length < 1) {
            Notification.error("Publish:" + "Topic cannot be empty");
            return;
        }        
        try {
            var message = new Paho.MQTT.Message($scope.mqtt_publish.message);
            message.destinationName = $scope.mqtt_publish.topic;
            message.qos = Number($scope.mqtt_publish.qos);
            message.retained = $scope.mqtt_publish.retain;            
            $scope.mqtt_client.send(message);
            Notification.success({ title: "Publish success: " + message.destinationName });
        }
        catch (e) {
            Notification.error("Publish fail:" + e);
        }
    };
    
    //　function to genrate a UUID (unique identifier)
    function generateUUID() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return uuid;
    }
});