const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const supabase = require('../config/supabaseClient');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const bcrypt = require('bcryptjs');

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role = 'patient' } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (role !== 'patient') {
      return res.status(403).json({ message: 'Only patient registration is allowed' });
    }

    const { data: existingUsers } = await supabase.from('users').select('id').eq('email', email);
    if (existingUsers?.length > 0) return res.status(409).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: newUser, error: createError } = await supabase.from('users').insert({
      email, password: hashedPassword, first_name: firstName, last_name: lastName, role
    }).select().single();
    if (createError) throw createError;

    const { data: newPatient } = await supabase.from('patients').insert({ user_id: newUser.id }).select().single();

    const token = generateToken({ userId: newUser.id, email, role, patientId: newPatient.id });
    const refreshToken = generateRefreshToken({ userId: newUser.id, email, role });

    await supabase.from('refresh_tokens').insert({
      user_id: newUser.id, token: refreshToken, expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString()
    });

    res.status(201).json({ message: 'User registered', token, refreshToken, user: { ...newUser, patientId: newPatient.id } });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    let roleId = null, roleKey = null;
    if (user.role === 'patient') {
      const { data: p } = await supabase.from('patients').select('id').eq('user_id', user.id).single();
      if (p) { roleId = p.id; roleKey = 'patientId'; }
    } else if (user.role === 'doctor') {
      const { data: d } = await supabase.from('doctors').select('id').eq('user_id', user.id).single();
      if (d) { roleId = d.id; roleKey = 'doctorId'; }
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    if (roleId) tokenPayload[roleKey] = roleId;

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email, role: user.role });

    await supabase.from('refresh_tokens').insert({
      user_id: user.id, token: refreshToken, expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString()
    });

    const userRes = { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role };
    if (roleId) userRes[roleKey] = roleId;

    res.json({ message: 'Login successful', token, refreshToken, user: userRes });
  } catch (error) { next(error); }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await supabase.from('refresh_tokens').delete().eq('token', refreshToken);
    res.json({ message: 'Logout successful' });
  } catch (error) { next(error); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, phone_number, created_at')
      .eq('id', req.user.userId)
      .single();

    if (!user) return res.status(404).json({ message: 'User not found' });

    let roleData = {};
    if (user.role === 'patient') {
      const { data: p } = await supabase
        .from('patients')
        .select('id, assigned_doctor_id, onboarding_completed, onboarding_step')
        .eq('user_id', req.user.userId)
        .single();
      if (p) roleData = { patientId: p.id, assignedDoctorId: p.assigned_doctor_id, onboardingCompleted: p.onboarding_completed, onboardingStep: p.onboarding_step };
    } else if (user.role === 'doctor') {
      const { data: d } = await supabase.from('doctors').select('id, specialization').eq('user_id', req.user.userId).single();
      if (d) roleData = { doctorId: d.id, specialization: d.specialization };
    }

    res.json({ user: { ...user, firstName: user.first_name, lastName: user.last_name, phoneNumber: user.phone_number, createdAt: user.created_at, ...roleData } });
  } catch (error) { next(error); }
});

module.exports = router;
