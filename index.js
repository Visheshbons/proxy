// ---------- Initialisation ---------- \\

import express from 'express';
import chalk from 'chalk';

const app = express();
const port = process.env.PORT || 1500;



// ---------- Middleware ---------- \\

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));



// ---------- Routes ---------- \\

// app.get(...)



// ---------- Error Handler ---------- \\

app.use((req, res, next) => {
    statusCode(req, res, 404);
    next();
});

app.use((err, req, res, next) => {
    statusCode(req, res, err.status || 500);
});



// ---------- Runtime ---------- \\

app.listen(port, () => {
    console.log(`Server is running on port ${chalk.green(port)}`);
});