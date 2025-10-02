const express = require("express");
const { getJobs } = require("../services/getJobs");

const router = express.Router();

router.get('/jobsList', (req, res) => getJobs({ req, res }));

module.exports = router;