const { ScrapperModule } = require("./modules/scrapJobs_linkedin");
const express = require("express");
const app = express();
const port = process.env.PORT || 6969;

// Add middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', require('./routes/index'));

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});