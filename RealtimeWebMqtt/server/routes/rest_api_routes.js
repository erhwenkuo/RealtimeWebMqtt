module.exports = function (express, redis_client, mqtt_client) {
    
    var inbox_ctrl = require('../controllers/rest_api_inbox_ctrl')(redis_client, mqtt_client);
    var notification_ctrl = require('../controllers/rest_api_notification_ctrl')(redis_client, mqtt_client);
    
    // Create our Express router
    var router = express.Router();
    
    // Create endpoint handlers for /api/mqtt/inbox
    router.route('/mqtt/inbox/:user_id')
        .get(inbox_ctrl.get_unread);
    
    // Create endpoint handlers for /api/mqtt/notification
    router.route('/mqtt/notification/:user_id')
        .get(notification_ctrl.get_unread);
    
    return router;
};