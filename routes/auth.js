// routes/auth.js
const express = require('express');
const { signUp, signIn, forgotPassword,resetPassword,chatApplication } = require('../controllers/authController');
const router = express.Router();

// Sign Up
router.post('/signup', signUp);

// Sign In
router.post('/signin', signIn);

// Forgot Password
router.post('/forgot-password', forgotPassword);

//Reset Password
router.post('/reset-password/:token', resetPassword);

//for chatapplication
router.post('/chat' ,chatApplication);

module.exports = router;
