const express = require('express');
const app = express();
const port = 3000;

app.get('/resources/*', (req, res) => {
    console.log(req.path);
    res.sendFile(req.path, {
        root: "./"
    });
});

app.get('(/*)?', (req, res) => {
    console.log(req.path);
    res.sendFile("web/" + req.path, {
        root: "./"
    });
});

app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});