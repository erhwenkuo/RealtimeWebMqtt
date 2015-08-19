// create angular controller
web_app.controller('mqtt_web_inboxnotification_ctrl', function ($scope, $http, $state, $modal, Notification, app_config) {
    
    // flags to control UI Component collapse or not
    $scope.isLogined = false; //flat to identify if connected to MQTT broker (user loggined)
    $scope.isNotificationEnabled = false; //show notification if any incoming Mqtt Message or not
    
    // data structure to keep online user
    $scope.mqtt_whoisonline = {};
    $scope.mqtt_whoisonline.username = "";
    $scope.mqtt_whoisonline.userstatus = "Available";
    $scope.mqtt_online_users = {}; 

    // data structure to keep unread inbox or notification
    $scope.mqtt_whoisonline.unread_inbox = 0;
    $scope.mqtt_whoisonline.unread_notification = 0;
    $scope.mqtt_whoisonline.inbox = [];
    $scope.mqtt_whoisonline.notification = [];
    
    // reset if user logged out
    var reset = function () {
        $scope.mqtt_client = {};
        $scope.isLogined = false; 
        $scope.isNotificationEnabled = false;
        
        $scope.mqtt_whoisonline = {};
        $scope.mqtt_whoisonline.username = "";
        $scope.mqtt_whoisonline.userstatus = "Available";
        $scope.mqtt_online_users = {};

        $scope.mqtt_whoisonline.unread_inbox = 0;
        $scope.mqtt_whoisonline.unread_notification = 0;
        $scope.mqtt_whoisonline.inbox = [];
        $scope.mqtt_whoisonline.notification = [];
    }
    
    // function called by UI to pop-out a modal window which allow user to input user profile
    $scope.login = function () {
        var modalInstance = $modal.open({
            animation: true,
            templateUrl: 'mqtt_web_inboxnotification_login.html',
            controller:  'mqtt_web_inboxnotification_login_modal_ctrl'
        });
        
        // once modal window is close (user click UI button), below block will be executed
        modalInstance.result.then(function (username) {
            $scope.mqtt_whoisonline.username = username;
            $scope.mqtt_conn.clientid = username; //<--- use username as MQTT connection clientIentifer
            
            // connect to Mqtt Broker via websocket
            $scope.connect();
        }, function () {
            //dismiss (user click dismiss button on UI Modal "dismiss" button)
        });
    }
    
    // function called by UI to pop-out a modal window which allow user to change user online status
    $scope.change_status = function () {
        var modalInstance = $modal.open({
            animation: true,
            templateUrl: 'mqtt_web_inboxnotification_userstatus_change.html',
            controller:  'mqtt_web_inboxnotification_userstatus_change_modal_ctrl'
        });
        
        modalInstance.result.then(function (userstatus) {
            $scope.mqtt_whoisonline.userstatus = userstatus;
            
            var username = $scope.mqtt_whoisonline.username;
            // construct a object to present user's "Presence"
            var user_presence = {
                name: username,
                status: userstatus,
                connectionTime: new Date().getTime()
            };
            
            // construct a MQTT message
            var presence_message = new Paho.MQTT.Message(JSON.stringify(user_presence)); //把物件轉成JSON
            presence_message.destinationName = "demo/whoisonline/" + username + "/presence";
            presence_message.qos = 0; // setup qos level
            presence_message.retained = true; // set "retained" flag to "true"

            $scope.mqtt_client.send(presence_message); // send the message to MQTT broker

        }, function () {
            //dismiss (user click dismiss button on UI Modal "dismiss" button)
        });
    }
    
    // function called by UI to pop-out a modal window which allow user to send a chat message to other user
    $scope.send_message = function (user_to) {
        var modalInstance = $modal.open({
            animation: true,
            templateUrl: 'mqtt_web_inboxnotification_senduser_message.html',
            controller:  'mqtt_web_inboxnotification_sendmessage_modal_ctrl',
            resolve: {
                user_to: function () {
                    return user_to;
                }
            }
        });
        
        modalInstance.result.then(function (result) {
            var message_type = result.message_type;
            // different Message Type using different topic
            var topic = "demo/whoisonline/" + result.user_to + "/" + message_type;            
            // construct a object 
            var messaging_obj = {
                user_from: $scope.mqtt_whoisonline.username,
                message_type: result.message_type,
                message: result.message_to,
                messagingTime: new Date().getTime()
            };
            
            var user_message = new Paho.MQTT.Message(JSON.stringify(messaging_obj)); //convert object to JSON string
            
            user_message.destinationName = topic;
            user_message.qos = 0;
            user_message.retained = false;
            
            $scope.mqtt_client.send(user_message);
        }, function () {
            //dismiss
        });
    }
    
    // function called by UI to pop-out a modal window which allow user to view their inbox or notification
    $scope.show_messages = function (message_type) {
        var unread_count = 0;
        if (message_type === 'inbox')
            unread_count = $scope.mqtt_whoisonline.unread_inbox;
        else
            unread_count = $scope.mqtt_whoisonline.unread_notification;
        
        if (unread_count == 0)
            return;
        
        //base on User_Id & message_type to retrieve unread inbox or notification (using RESTful api)
        var req = {
            method: 'GET',
            url: '/api/mqtt/' + message_type + '/' + $scope.mqtt_whoisonline.username,
            params: { unread: unread_count }
        };
        
        $http(req)
        .success(function (data, status, headers, config) {            
            //construct an Mqtt Message to reset the "unread" counter
            //var reset_count_message = new Paho.MQTT.Message("");      
            //reset_count_message.destinationName = "demo/whoisonline/" + $scope.mqtt_whoisonline.username + "/" + message_type + "/unread";
            //reset_count_message.qos = 0;
            //reset_count_message.retained = true;
            //$scope.mqtt_client.send(reset_count_message);
            
            var messages = [];
            data.forEach(function (entry) {
                messages.push(JSON.parse(entry));
            });
            
            if (message_type === 'inbox')
                $scope.mqtt_whoisonline.inbox = messages;
            else
                $scope.mqtt_whoisonline.notification = messages;
            
            // pop out modal window
            var modalInstance = $modal.open({
                animation: true,
                templateUrl: 'mqtt_web_inboxnotification_showmessages.html',
                controller:  'mqtt_web_inboxnotification_showmessages_modal_ctrl',
                resolve: {
                    inObj: function () {
                        return { message_type: message_type, messages: messages };
                    }
                }
            });
            
            modalInstance.result.then(function () {
                //$scope.selected = selectedItem;
            }, function () {
                //$log.info('Modal dismissed at: ' + new Date());
            });
        })
        .error(function (data, status, headers, config) {
            alert("Error:" + status + ", " + data);
        });
    }
    
    
    // MQTT broker connection parameters
    $scope.mqtt_client = {};
    $scope.mqtt_conn = {};
    $scope.mqtt_conn.host = app_config.mqtt_broker_url || "localhost";
    $scope.mqtt_conn.port = app_config.mqtt_broker_port || 8000;
    //$scope.mqtt_conn.clientid = "web_" + parseInt(Math.random() * 100, 10);
    $scope.mqtt_conn.keep_alive = 60;
    $scope.mqtt_conn.clean_session = true;
    $scope.mqtt_conn.userid = "";
    $scope.mqtt_conn.password = "";
    
    // **** make sure the mqtt "lastwill" related data is set
    $scope.mqtt_conn.lastwill_topic = "demo/whoisonline/" + $scope.mqtt_whoisonline.username + "/presence";
    $scope.mqtt_conn.lastwill_qos = 0;
    $scope.mqtt_conn.lastwill_message = "";
    $scope.mqtt_conn.lastwill_retain = true;
    
    // function to connect MQTT broker via websocket (make sure MQTT Broker websocket supported is enabled)
    $scope.connect = function () {
        // Create a mqtt client instance
        $scope.mqtt_client = new Paho.MQTT.Client($scope.mqtt_conn.host, Number($scope.mqtt_conn.port), $scope.mqtt_conn.clientid);
        
        var connOptions = {
            timeout: 3,
            //useSSL: useTLS,
            cleanSession: $scope.mqtt_conn.clean_session,
            onSuccess: onConnectSuccess,
            onFailure: onConnectFail
        };
        
        if ($scope.mqtt_conn.userid.length > 0)
            connOptions.userName = $scope.mqtt_conn.userid;
        
        if ($scope.mqtt_conn.password.length > 0)
            connOptions.password = $scope.mqtt_conn.password;
        
        // make sure the mqtt "lastwill" related data is set properly
        $scope.mqtt_conn.lastwill_topic = "demo/whoisonline/" + $scope.mqtt_whoisonline.username + "/presence";
        
        var willmsg = new Paho.MQTT.Message($scope.mqtt_conn.lastwill_message);
        willmsg.qos = $scope.mqtt_conn.lastwill_qos;
        willmsg.destinationName = $scope.mqtt_conn.lastwill_topic;
        willmsg.retained = $scope.mqtt_conn.lastwill_retain;
        
        connOptions.willMessage = willmsg;        
        
        // *** setup callback handlers ***
        $scope.mqtt_client.onConnectionLost = onConnectionLost;
        $scope.mqtt_client.onMessageArrived = onMessageArrived;
        
        // connect to MQTT broker
        $scope.mqtt_client.connect(connOptions);
    }
    
    // function to disconnect current MQTT connection
    $scope.disconnect = function () {
        // *** make usre we send a "empty" mqtt message to remove persistant "presence" message on MQTT Broker
        var topic = "demo/whoisonline/" + $scope.mqtt_whoisonline.username + "/presence";
        
        var disconnect_msg = new Paho.MQTT.Message("");
        disconnect_msg.qos = 0;
        disconnect_msg.destinationName = topic;
        disconnect_msg.retained = true; //<--- mare sure "retained" flag is "true"
        
        // send out a "message content is empty" to reset present
        $scope.mqtt_client.send(disconnect_msg);
        
        // disconnect MQTT connection
        $scope.mqtt_client.disconnect();
        
        // reset related page model structure
        reset();
    }
    
    // callback function used by MQTT client, this function will be called when 
    // the MQTT client connect to MQTT broker successfully
    function onConnectSuccess() {
        // once connect to MQTT, we send out a Mqtt Message to notfiy we are online (presence)
        var username = $scope.mqtt_whoisonline.username;
        
        // construct "Presence" object
        var user_presence = {
            name: username,
            status: 'Available',
            connectionTime: new Date().getTime()
        };
        
        var presence_message = new Paho.MQTT.Message(JSON.stringify(user_presence)); //把物件轉成JSON
        presence_message.destinationName = "demo/whoisonline/" + username + "/presence";
        presence_message.qos = 0;
        presence_message.retained = true; //set the "retained" is "true"
        $scope.mqtt_client.send(presence_message);
        
        // let's subscribe "presence" topic to get all online user's presence 
        var presence_topic = "demo/whoisonline/+/presence";
        $scope.mqtt_client.subscribe(presence_topic, { qos: 0 });
        
        // let's subscribe self "chat" topic, so we can catch chat message if someone want to talk to us
        var messaging_topic = "demo/whoisonline/" + username + "/chat";
        $scope.mqtt_client.subscribe(messaging_topic, { qos: 0 });
        
        // let's subscribe self "inbox" & "notification" topic, so we can be notfied via the most update counter
        var inbox_topic = "demo/whoisonline/" + username + "/inbox";
        var notification_topic = "demo/whoisonline/" + username + "/notification";
        $scope.mqtt_client.subscribe(inbox_topic, { qos: 0 });
        $scope.mqtt_client.subscribe(notification_topic, { qos: 0 });
        
        // let's subscribe self unread "inbox" & "notification" counter topic, so we can be notfied via the most update counter (Retained = true)
        var unread_topics = "demo/whoisonline/" + username + "/+/unread";
        $scope.mqtt_client.subscribe(unread_topics, { qos: 0 });
        
        $scope.isLogined = true; //turn on the isLogined flag to "true"
        
        $scope.$apply(); // force angular.js to check data change
    }
    
    // callback function used by MQTT client, this function will be called when 
    // the MQTT client connect to MQTT broker fail
    function onConnectFail(message) {
        Notification.error({ title: 'MQTT Connection Status', message: "MQTT Broker Connection failed: " + message.errorMessage });
    }

    // called by MQTT client connection object when detect the connection to MQTT broker is broken
    function onConnectionLost(responseObject) {
        if (responseObject.errorCode !== 0) {
            console.log("onConnectionLost: " + responseObject.errorMessage);
        }
        Notification.error({ title: "Mqtt Connection lost", message: responseObject.errorMessage });
        reset();
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
        
        // check if need to show Notification on UI
        if ($scope.isNotificationEnabled) {
            Notification.info({ title: "Topic: " + messageObj.topic + ", Qos: " + messageObj.qos, message: messageObj.payload });
        }
        
        //**below coding blocks are used to process incomeing MQTT message:
        // this demonstration, there are two types of message need to be taking of:
        //   1.user "presence" messages (online/offline/status)
        //   2.user self-owned "chat" which submitted by other user
        
        // use regular expression to detect "presence" message
        var regex = "demo/whoisonline/(.+)/presence";
        var found = topic.match(regex);
        if (found) { // this is "Presence" message

            var user = found[1]; //get the "userid" from regular expression matching 
            
            if (user == $scope.mqtt_whoisonline.username) {
                if (!messageObj.payload || messageObj.payload.length === 0) {
                    //self offline presence messsage
                    //-> should not reach code here, since we are offline
                    
                }
                else {
                    //update self page user status
                    var presence = JSON.parse(messageObj.payload);
                    $scope.mqtt_whoisonline.userstatus = presence.status;
                }
            } else {
                if (!messageObj.payload || messageObj.payload.length === 0) {
                    //user offline
                    var user = found[1];
                    delete $scope.mqtt_online_users[user];
                }
                else {
                    //user online
                    var presence = JSON.parse(messageObj.payload);
                    var user = found[1];
                    if ($scope.mqtt_online_users[user])
                        $scope.mqtt_online_users[user].presence = presence;
                    else
                        $scope.mqtt_online_users[user] = { presence: presence, lastmsg: null }
                }
            }
        }
        
        // verify if message's topic name is the the as self "chat" topic name
        var message_topic = "demo/whoisonline/" + $scope.mqtt_whoisonline.username + "/chat";        
        if (message_topic == topic) {
            var user_messaging = JSON.parse(messageObj.payload);
            Notification.info({ title: "Message from :" + user_messaging.user_from, message: user_messaging.message });            
            $scope.mqtt_online_users[user_messaging.user_from].lastmsg = user_messaging;
        }
        
        //*****verify if message's topic is related to "unread inbox" or "unread notification" counter
        regex = "demo/whoisonline/" + $scope.mqtt_whoisonline.username + "/(.+)/unread";
        var unread_found = topic.match(regex);
        if (unread_found) {
            //check what type of unread counter
            var unread_type = unread_found[1];

            if (unread_type === "inbox") {
                $scope.mqtt_whoisonline.unread_inbox = Number(messageObj.payload);
                if ($scope.mqtt_whoisonline.unread_inbox > 0)
                    $('#notifyAudio')[0].play();  //play Notification Sound
            }
            else if (unread_type === "notification") {
                $scope.mqtt_whoisonline.unread_notification = Number(messageObj.payload);
                if ($scope.mqtt_whoisonline.unread_notification > 0)
                    $('#notifyAudio')[0].play();  //play Notification Sound
            }
        }
        $scope.$apply();
    }
});

// angular.js modal controller - login
web_app.controller('mqtt_web_inboxnotification_login_modal_ctrl', function ($scope, $modalInstance) {
    $scope.mqtt_whoisonline = {};
    $scope.mqtt_whoisonline.username = "";
    
    
    $scope.ok = function () {
        $modalInstance.close($scope.mqtt_whoisonline.username);
    };
    
    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
});

// angular.js modal controller - change user online status
web_app.controller('mqtt_web_inboxnotification_userstatus_change_modal_ctrl', function ($scope, $modalInstance) {
    $scope.userstatus = "Available";
    
    
    $scope.ok = function () {
        $modalInstance.close($scope.userstatus);
    };
    
    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
});

// angular.js modal controller - send message to other user
web_app.controller('mqtt_web_inboxnotification_sendmessage_modal_ctrl', function ($scope, $modalInstance, user_to) {
    $scope.user_to = user_to;
    $scope.message_to = "";
    $scope.msg_type = "chat";
    
    $scope.ok = function () {
        $modalInstance.close({ user_to: $scope.user_to, message_to: $scope.message_to, message_type: $scope.msg_type });
    };
    
    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
});

// angular.js modal controller - show inbount/notification messages
web_app.controller('mqtt_web_inboxnotification_showmessages_modal_ctrl', function ($scope, $modalInstance, inObj) {
    $scope.message_type = inObj.message_type;
    $scope.messages = inObj.messages;
    
    $scope.ok = function () {
        $modalInstance.close();
    };
    
    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
});