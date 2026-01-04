const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const supabase = require('../config/supabaseClient');

router.get('/patients', authenticate, requireRole('doctor'), async (req, res, next) => {
    try {
        const { data: assignments } = await supabase.from('patient_doctor_assignments').select(`
            patient_id, patients:patient_id (id, onboarding_completed, users:user_id(first_name, last_name, email, phone_number))
        `).eq('doctor_id', req.user.doctorId).eq('status', 'active');

        const patients = await Promise.all(assignments.map(async (a) => {
             const { data: room } = await supabase.from('chat_rooms').select('id').eq('patient_id', a.patient_id).eq('doctor_id', req.user.doctorId).single();
             return {
                 patient_id: a.patient_id, first_name: a.patients.users.first_name, last_name: a.patients.users.last_name,
                 email: a.patients.users.email, phone_number: a.patients.users.phone_number, room_id: room?.id
             };
        }));
        res.json({ patients });
    } catch (e) { next(e); }
});

router.get('/patients/:patientId', authenticate, requireRole('doctor'), async (req, res, next) => {
    try {
        const { data: patientData } = await supabase.from('patients').select('*, users:user_id(first_name, last_name, email, phone_number)').eq('id', req.params.patientId).single();
        if (!patientData) return res.status(404).json({ message: 'Patient not found' });

        const { data: personal } = await supabase.from('onboarding_personal').select('*').eq('patient_id', req.params.patientId).single();
        const { data: medical } = await supabase.from('onboarding_medical').select('*').eq('patient_id', req.params.patientId).single();
        const { data: insurance } = await supabase.from('onboarding_insurance').select('*').eq('patient_id', req.params.patientId).single();

        res.json({ patient: {
            ...patientData, first_name: patientData.users.first_name, last_name: patientData.users.last_name,
            email: patientData.users.email, phone_number: patientData.users.phone_number,
            onboarding: { personal, medical: medical ? { ...medical, known_allergies: JSON.parse(medical.known_allergies), chronic_conditions: JSON.parse(medical.chronic_conditions) } : null, insurance }
        }});
    } catch (e) { next(e); }
});

module.exports = router;
