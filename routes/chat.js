const express        = require('express');
const router         = express.Router();
const wrapAsync      = require('../utils/wrapAsync.js');
const chatController = require('../controllers/chat.js');

router.post('/', wrapAsync(chatController.chat));

module.exports = router;
