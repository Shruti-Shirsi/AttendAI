const express = require("express");
const router = express.Router();

const {
    registerStudent,
    loginStudent,
    getDashboard
} = require("../controllers/studentController");

router.post("/register", registerStudent);
router.post("/login", loginStudent);
router.get("/:prn/dashboard", getDashboard);

module.exports = router;