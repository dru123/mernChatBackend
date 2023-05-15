const mongoose = require('mongoose');

const userScehma = new mongoose.Schema({
    username: { type: String, unique: true},
    password: String
}, {timestamps: true});

 const userSchemaModel = mongoose.model('User', userScehma);

 module.exports = userSchemaModel;