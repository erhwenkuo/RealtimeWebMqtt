web_app.controller('iot_smartphone_viewer_ctrl', function ($scope, $http, $state, Notification, app_config) {
    var self = this;    
    $scope.screenControlledDeviceId = null;
    
    //產生一個QR的barcode來讓Device可以用掃code的方式導到smartphone collector的網頁

    var web_ip = "http://" + app_config.http_host;
    $scope.smartphone_collector_url = web_ip + "/#/iot_smartphone_collector";
    
    //動態產生一個隨機碼來當IoT Device Id
    $scope.deviceId = generateUUID();
    $scope.isConnected = false; //是否連上MQTT Broker   
    
    $scope.smartphones_list = [];
    $scope.smartphones_map = {};
    
    $scope.isSmartphoneList_Collapsed = false;

    //使用witlab IoT SDK來產生IotApplication的instance
    $scope.iotApp = null;
    
    //連接到MQTT Broker
    $scope.connect = function () {
        //設定連結相關的資訊
        var iot_config = {};
        iot_config.mqttBrokerUrl = app_config.mqtt_broker_url;
        iot_config.mqttBrokerPort = app_config.mqtt_broker_port;

        iot_config.org = "iot";
        iot_config.type = "html5-smartphone-viewer";
        iot_config.id = $scope.deviceId; // 使用user在UI輸入的手機號碼來作為deviceId
        iot_config.presence = false;
        
        $scope.iotApp = new IotApplication(iot_config);
        
        //註冊相關的回呼function
        $scope.iotApp.on("connect", iotConnect);
        $scope.iotApp.on("connectionLost", iotConnectionLost);
        $scope.iotApp.on("devicePresence", iotDevicePresenceHandler);
        $scope.iotApp.on("deviceEvent", iotDeviceEventHander);
        
        //連結MQTT broker
        $scope.iotApp.connect();
    }
    
    //中斷MQTT Broker的連線
    $scope.disconnect = function () {
        $scope.iotApp.disconnect();
    }
    
    $scope.controlScreen = function (iotDeviceId) {
        if (!$scope.screenControlledDeviceId) {
            
            var cached_presence = $scope.smartphones_map[iotDeviceId];
            var idx = $scope.smartphones_list.indexOf(cached_presence);
            
            cached_presence.screenControlled = true;
            $scope.smartphones_map[iotDeviceId] = cached_presence;
            $scope.smartphones_list[idx] = cached_presence;
            
            $scope.screenControlledDeviceId = iotDeviceId;
        }
        else {
            if ($scope.screenControlledDeviceId !== iotDeviceId) {
                var preControlDevice = $scope.screenControlledDeviceId;
                $scope.releaseControlScreen(preControlDevice);
                
                $scope.screenControlledDeviceId = null;
                
                var cached_presence = $scope.smartphones_map[iotDeviceId];
                var idx = $scope.smartphones_list.indexOf(cached_presence);
                
                cached_presence.screenControlled = true;
                $scope.smartphones_map[iotDeviceId] = cached_presence;
                $scope.smartphones_list[idx] = cached_presence;
                
                $scope.screenControlledDeviceId = iotDeviceId;
            }
        }
    }
    
    $scope.releaseControlScreen = function (iotDeviceId) {
        if ($scope.screenControlledDeviceId && $scope.screenControlledDeviceId === iotDeviceId) {
            if ($scope.smartphones_map[iotDeviceId]) {
                var cached_presence = $scope.smartphones_map[iotDeviceId];
                var idx = $scope.smartphones_list.indexOf(cached_presence);
                
                cached_presence.screenControlled = false;
                $scope.smartphones_map[iotDeviceId] = cached_presence;
                $scope.smartphones_list[idx] = cached_presence;
                
                $scope.screenControlledDeviceId = null;
            }
        }
    }
    
    //用來偵測iotDevice是否順利連線的callback
    function iotConnect(isConnected) {
        $scope.isConnected = isConnected;
        Notification.info({ title: "IoT Connect Status" , message: $scope.isConnected.toString() });
        
        $scope.iotApp.subscribeToDevicePresences("iot", "smartphone"); //監聽有上線的smartphone presences
        $scope.iotApp.subscribeToDeviceEvents("iot", "smartphone"); //監聽有上線的smartphone events
    }
    
    //用來偵測iotDevice是否有不小心斷線的callback   
    function iotConnectionLost(isConnected) {
        $scope.isConnected = isConnected;
        Notification.info({ title: "IoT Connect Status" , message: $scope.isConnected.toString() });
    }
    
    //用來處理iotDevice的Presence的callback
    function iotDevicePresenceHandler(org, type, id, payload, topic) {
        console.log("Topic:" + topic + ", Payload: " + payload);
        var presence = JSON.parse(payload); //{"ts":1438827253217,"d":{"status":"offline","org":"witlab","type":"smartphone","id":"0937926124"}}
        
        //檢查上線的smartphone
        if (presence.d.status && presence.d.status === "online") {
            var id = presence.d.id;
            var splits = id.split("|");
            var deviceOwner = splits[0];
            var deviceId = splits[1];
            
            presence.deviceId = deviceId;
            presence.deviceOwner = deviceOwner;
            presence.excessiveVibrationDetected = false; //use to detect vibration
            presence.screenControlled = false;
            
            if (!$scope.smartphones_map[id]) {
                $scope.smartphones_map[id] = presence;
                $scope.smartphones_list.push(presence);
                $scope.$apply();
            }
        } else if (presence.d.status && presence.d.status === "offline") {
            var id = presence.d.id;
            if ($scope.smartphones_map[id]) {
                var cached_presence = $scope.smartphones_map[id];
                var idx = $scope.smartphones_list.indexOf(cached_presence);
                if (idx >= 0)
                    $scope.smartphones_list.splice(idx, 1);
                delete $scope.smartphones_map[id];
                if ($scope.screenControlledDeviceId && id === $scope.screenControlledDeviceId)
                    $scope.screenControlledDeviceId = null;
                $scope.$apply();
            }
        }
    }
    
    //用來處理iotDevice的Event的callback
    function iotDeviceEventHander(org, type, id, evt, payload, topic) {
        console.log("Topic:" + topic + ", Payload: " + payload);
        
        var sensorData = JSON.parse(payload); //{"ts":1438832215317,"d":{"ax":"0.56","ay":"0.19","az":"-0.96","oa":"-344.87","ob":"47.42","og":"-17.75"}}
        
        //檢查上線的smartphone
        if ($scope.smartphones_map[id]) {
            
            var cached_presence = $scope.smartphones_map[id];
            var idx = $scope.smartphones_list.indexOf(cached_presence);
            
            cached_presence.sensorData = sensorData;
            
            $scope.smartphones_map[id] = cached_presence;
            if (idx >= 0)
                $scope.smartphones_list[idx] = cached_presence
            
            var values = {
                time: sensorData.ts,
                accelX: parseFloat(sensorData.d.ax),
                accelY: parseFloat(sensorData.d.ay),
                accelZ: parseFloat(sensorData.d.az),
                rotA: parseFloat(sensorData.d.oa),
                rotB: parseFloat(sensorData.d.ob),
                rotG: parseFloat(sensorData.d.og)
            };
            
            /*
			 * Calculate if the phone we're monitoring is vibrating excessively. You could easily extend this sample by subscribing to events
			 * from *all* phones simultaneously, and therefore alert if any phone is vibrating excessively.
			 */
            values["accelMag"] = Math.sqrt(values.accelX * values.accelX + values.accelY * values.accelY + values.accelZ * values.accelZ);
            
            if (values["accelMag"] >= 20 && (!cached_presence.excessiveVibrationDetected)) {
                cached_presence.excessiveVibrationDetected = true;
                setTimeout(function () {
                    cached_presence.excessiveVibrationDetected = false;
                    $scope.$apply();
                }, 2000);
            }
            
            if ($scope.screenControlledDeviceId && $scope.screenControlledDeviceId === id)
                render(values.rotB, values.rotG, values.rotA);
            
            $scope.$apply();
        }
    }
    
    //　產生一個UUID
    function generateUUID() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return uuid;
    }
    
    // Three.js 3D 顯示
    var camera, scena, renderer;
    var cube;
    
    // set the scene size
    var scene_width = 270;
    var scene_height = 270;
    
    init();
    render(0, 0, 0);
    
    function init() {
        renderer = new THREE.WebGLRenderer({ antialias: true , alpha: true });
        renderer.setSize(scene_width, scene_height);
        
        
        //get the DOM element to attach to   
        $container = $('#3D_Container');
        
        $container.append(renderer.domElement);
        
        // camera
        camera = new THREE.PerspectiveCamera(65, scene_width / scene_height, 1, 1000);
        camera.position.z = 500;
        
        
        // scene
        scene = new THREE.Scene();
        
        // cube
        cube = new THREE.Mesh(new THREE.BoxGeometry(200, 400, 75), new THREE.MeshLambertMaterial({ color: 0x55B663 }));
        
        cube.overdraw = true;
        cube.rotation.x = Math.PI * 0.1;
        scene.add(cube);
        
        camera.lookAt(cube.position);

        // directional lighting
        var directionalLight = new THREE.DirectionalLight(0xffffff);
        directionalLight.position.set(1, 1, 1).normalize();
        scene.add(directionalLight);
    }
    
    function animate() {
        requestAnimationFrame(animate);
        render();
    }
    
    function render(_x, _y, _z) {
        //beta
        cube.rotation.x = (_x - 90) * Math.PI / 180;
        //gamma
        cube.rotation.y = _y * Math.PI / 180;
        //alpha
        cube.rotation.z = (_z - 90) * Math.PI / 180;
        renderer.render(scene, camera);
    }
});