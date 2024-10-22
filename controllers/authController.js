// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// Sign Up
exports.signUp = async (req, res) => {
  const { firstName, lastName, email, password, gender } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      gender,
    });

    await user.save();

    res.status(201).json({ msg: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Sign In
exports.signIn = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Forgot Password (with email verification)
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '15m',
    });
    console.log(resetToken);

    const resetURL = `http://127.0.0.1:5500/views/resetPasswordForm.html?token=${resetToken}`;
    const message = `You are receiving this email because you (or someone else) have requested to reset your password. Click on the following link to reset your password: \n\n ${resetURL}`;

    await sendEmail({
      email: user.email,
      subject: 'Password Reset Request',
      message,
    });

    res.json({ msg: 'Email sent' });
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
};



// Reset Password
exports.resetPassword = async (req, res) => {
  const { newPassword } = req.body;
  const { token } = req.params;

  try {
      // Find user with the reset token and check if it has expired
      const user = await User.findOne({
          resetPasswordToken: token,
          resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) {
          return res.status(400).json({ msg: 'Token is invalid or has expired' });
      }

      // Hash the new password and save it
      user.password = await bcrypt.hash(newPassword, 10);
      user.resetPasswordToken = undefined; // Clear the reset token
      user.resetPasswordExpires = undefined; // Clear the expiration
      await user.save();

      res.status(200).json({ msg: 'Password has been reset' });
  } catch (error) {
      console.error(error.message);
      res.status(500).json({ msg: 'Server error' });
  }
};

