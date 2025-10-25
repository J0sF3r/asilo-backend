// backend/hashPassword.js
const bcrypt = require('bcryptjs');

const password = 'pruebas';

bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, (err, hash) => {
        if (err) throw err;
        console.log('Tu nuevo hash es:');
        console.log(hash); 
    });
});