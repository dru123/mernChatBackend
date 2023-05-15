const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const brcypt = require('bcryptjs');
const { ErrorHandler } = require('./errorHandler');
const app = express();
const salt = brcypt.genSaltSync(10);
const corsOpts = {
    "origin": "http://localhost:3000",
    "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    "credentials": true,
    "preflightContinue": false,
    "optionsSuccessStatus": 204
};
const ws = require('ws');

app.use(cors(corsOpts));
app.use(express.json());
app.use(cookieParser());

mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, {}, (err, userData) => {
            if (err) throw err;
            return res.json(userData);
        })
    } else {
        return res.json('No user Found')
    }
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashPassword = brcypt.hashSync(password, salt);
    const createdUser = await User.create({ username, password: hashPassword });
    jwt.sign({ userId: createdUser?._id, username }, process.env.JWT_SECRET, {}, (err, token) => {
        if (err) throw err;
        res.cookie('token', token).status(201).json({ id: createdUser?._id, username });
    })
});

/**
 * Login Route - Authenticate the user password, if verified logged in successfully.
 */
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username });
    if (foundUser) {
        const passOk = await brcypt.compare(password, foundUser.password);
        console.log(foundUser, passOk)
        if (passOk) {
            jwt.sign({ userId: foundUser?._id, username }, process.env.JWT_SECRET, {}, (err, token) => {
                if (err) throw err;
                res.cookie('token', token).status(201).json({ id: foundUser?._id, username });
            })
        } else {
            res.status(500).json('No user found, please Register');
        }
    }
});

/**
 * Error handling middleware
 */
app.use(ErrorHandler);

const server = app.listen(4000, () => {
    console.log('Server started...........')
});

const wss = new ws.WebSocketServer({ server });

/**
 * When socket is connected, set the userId and username inside socket connection.
 */
wss.on('connection', (connection, req) => {
    const cookie = req.headers.cookie;
    const tokenString = cookie?.split('=')[1];
    if (tokenString) {
        jwt.verify(tokenString, process.env.JWT_SECRET, {}, (err, userData) => {
            if (err) throw err;
            const { username, userId } = userData;
            connection.username = username;
            connection.userId = userId;
        });
    }

    //grab the clients from websocketserver to see if its online or not
    [...wss.clients].forEach(client => client.send(JSON.stringify(
        {
        online: [...wss.clients].map(c => ({ userId: c.userId, username: c.username }))
        }
    )));

})