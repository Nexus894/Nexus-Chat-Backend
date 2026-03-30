const express = require("express");
const { protect } = require("../middleware/auth");
const { getSmartReplies } = require("../controllers/aiController");

const router = express.Router();
router.use(protect);

router.post("/smart-replies", getSmartReplies);

module.exports = router;
