// ---------- Initialisation ---------- \\

import express from 'express';
import chalk from 'chalk';

import { statusCode } from './errors.js'; // Custom error handler

const app = express();
const port = process.env.PORT || 1500;



// ---------- Middleware ---------- \\

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));



// ---------- Routes ---------- \\

// app.get(...)



// ---------- Error Handler ---------- \\

app.use((req, res, next) => { 
    // Runs if a request does not match any of the routes mentioned above
    statusCode(req, res, 404);
});

app.use((err, req, res, next) => {
    // Runs when an error occurs in any of the above routes
    statusCode(req, res, err.status /* If it exists */ || 500);
    console.log(chalk.red(err))
});



// ---------- Runtime ---------- \\

app.listen(port, () => {
    // Server start log
    console.log(`Server is running on port ${chalk.green(port)}`);
});