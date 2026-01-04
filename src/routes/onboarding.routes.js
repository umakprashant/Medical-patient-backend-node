const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const supabase = require('../config/supabaseClient');

const requirePatient = (req, res, next) => {
  if (req.user.role !== 'patient') return res.status(403).json({ message: 'Patient role required' });
  next();
};

router.get('/status', authenticate, requirePatient, async (req, res, next) => {
  try {
    const { data: p } = await supabase.from('patients').select('onboarding_completed, onboarding_step').eq('id', req.user.patientId).single();
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    res.json({ onboardingCompleted: p.onboarding_completed, currentStep: p.onboarding_step });
  } catch (e) { next(e); }
});

router.post('/step1', authenticate, requirePatient, async (req, res, next) => {
  try {
    const { fullName, dateOfBirth, gender, phoneNumber, emergencyContactName, emergencyContactPhone } = req.body;
    await supabase.from('onboarding_personal').upsert({
      patient_id: req.user.patientId, full_name: fullName, date_of_birth: dateOfBirth, gender, phone_number: phoneNumber,
      emergency_contact_name: emergencyContactName, emergency_contact_phone: emergencyContactPhone, updated_at: new Date()
    }, { onConflict: 'patient_id' });
    
    await supabase.from('patients').update({ onboarding_step: 1 }).eq('id', req.user.patientId); // Logic simplified
    res.json({ message: 'Step 1 saved' });
  } catch (e) { next(e); }
});

router.get('/step1', authenticate, requirePatient, async (req, res, next) => {
    const { data } = await supabase.from('onboarding_personal').select('*').eq('patient_id', req.user.patientId).single();
    res.json({ data });
});

router.post('/step2', authenticate, requirePatient, async (req, res, next) => {
  try {
    const { bloodType, currentMedications, knownAllergies, chronicConditions, previousSurgeries, familyMedicalHistory } = req.body;
    await supabase.from('onboarding_medical').upsert({
      patient_id: req.user.patientId, blood_type: bloodType, current_medications: currentMedications,
      known_allergies: JSON.stringify(knownAllergies), chronic_conditions: JSON.stringify(chronicConditions),
      previous_surgeries: previousSurgeries, family_medical_history: familyMedicalHistory, updated_at: new Date()
    }, { onConflict: 'patient_id' });
    
    await supabase.from('patients').update({ onboarding_step: 2 }).eq('id', req.user.patientId);
    res.json({ message: 'Step 2 saved' });
  } catch (e) { next(e); }
});

router.get('/step2', authenticate, requirePatient, async (req, res, next) => {
    const { data } = await supabase.from('onboarding_medical').select('*').eq('patient_id', req.user.patientId).single();
    if (data) {
        data.known_allergies = JSON.parse(data.known_allergies || '[]');
        data.chronic_conditions = JSON.parse(data.chronic_conditions || '[]');
    }
    res.json({ data });
});

router.post('/step3', authenticate, requirePatient, async (req, res, next) => {
  try {
    const { insuranceProvider, insuranceId, policyHolderName, preferredDoctorId, preferredTimeSlot, referralSource, additionalNotes } = req.body;
    await supabase.from('onboarding_insurance').upsert({
      patient_id: req.user.patientId, insurance_provider: insuranceProvider, insurance_id: insuranceId,
      policy_holder_name: policyHolderName, preferred_doctor_id: preferredDoctorId, preferred_time_slot: preferredTimeSlot,
      referral_source: referralSource, additional_notes: additionalNotes, updated_at: new Date()
    }, { onConflict: 'patient_id' });
    
    await supabase.from('patients').update({ onboarding_step: 3 }).eq('id', req.user.patientId);
    res.json({ message: 'Step 3 saved' });
  } catch (e) { next(e); }
});

router.get('/step3', authenticate, requirePatient, async (req, res, next) => {
    const { data } = await supabase.from('onboarding_insurance').select('*').eq('patient_id', req.user.patientId).single();
    res.json({ data });
});

router.post('/complete', authenticate, requirePatient, async (req, res, next) => {
    try {
        const { data: step3 } = await supabase.from('onboarding_insurance').select('preferred_doctor_id').eq('patient_id', req.user.patientId).single();
        if (!step3) return res.status(400).json({ message: 'Step 3 incomplete' });

        const docId = step3.preferred_doctor_id;
        await supabase.from('patients').update({ onboarding_completed: true, assigned_doctor_id: docId }).eq('id', req.user.patientId);
        await supabase.from('patient_doctor_assignments').upsert({ patient_id: req.user.patientId, doctor_id: docId, status: 'active' }, { onConflict: 'patient_id, doctor_id' });
        
        const { data: room } = await supabase.from('chat_rooms').select('id').eq('patient_id', req.user.patientId).eq('doctor_id', docId).single();
        if (!room) await supabase.from('chat_rooms').insert({ patient_id: req.user.patientId, doctor_id: docId });

        res.json({ message: 'Onboarding completed' });
    } catch (e) { next(e); }
});

router.get('/doctors', authenticate, async (req, res, next) => {
    const { data: doctors } = await supabase.from('doctors').select('id, specialization, bio, users:user_id(first_name, last_name)');
    const formatted = doctors.map(d => ({
        id: d.id, specialization: d.specialization, bio: d.bio,
        first_name: d.users?.first_name, last_name: d.users?.last_name
    }));
    res.json({ doctors: formatted });
});

module.exports = router;
