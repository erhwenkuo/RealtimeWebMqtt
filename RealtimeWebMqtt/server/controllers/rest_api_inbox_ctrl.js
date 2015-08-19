module.exports = function (redis_client, mqtt_client) {
    var ctrl = {};
    
    ctrl.get_unread = function (req, res) {
        var unread = -1;
        
        //check if client submit how many unread
        if (req.query.unread)
            unread = (Number(req.query.unread) - 1);
        
        var user_id = req.params.user_id;
        var list_key = "demo/whoisonline/" + user_id + "/inbox";

        var result = redis_client.lrange(list_key, 0, unread, function (err, resp) {
            if (err) {
                res.status(err.status).send(err.message);
            } else {
                // reset unread counter to 0 in redis
                redis_client.set("demo/whoisonline/" + user_id + "/inbox/unread", "0");   
                
                // publish mqtt message to notify the counter change
                mqtt_client.publish("demo/whoisonline/" + user_id + "/inbox/unread" , "0" , { qos: 0, retain: true });
                
                // return offline "inbox" messages
                res.json(resp);
            }
        });
    };
    
    return ctrl;
};