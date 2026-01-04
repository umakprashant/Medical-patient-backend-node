const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const supabase = require('../config/supabaseClient');

router.get('/room', authenticate, async (req, res, next) => {
    try {
        if (req.user.role === 'patient') {
            const { data: p } = await supabase.from('patients').select('assigned_doctor_id').eq('id', req.user.patientId).single();
            if (!p?.assigned_doctor_id) return res.status(404).json({ message: 'No doctor assigned' });

            let { data: room } = await supabase.from('chat_rooms').select('id').eq('patient_id', req.user.patientId).eq('doctor_id', p.assigned_doctor_id).single();
            if (!room) {
                const { data: newRoom } = await supabase.from('chat_rooms').insert({ patient_id: req.user.patientId, doctor_id: p.assigned_doctor_id }).select().single();
                room = newRoom;
            }

            const { data: doc } = await supabase.from('doctors').select('id, specialization, users:user_id(first_name, last_name)').eq('id', p.assigned_doctor_id).single();
            res.json({ room: { ...room, doctor: { ...doc, first_name: doc.users.first_name, last_name: doc.users.last_name } } });
        } else if (req.user.role === 'doctor') {
            const { data: assignments } = await supabase.from('patient_doctor_assignments').select('patient_id, patients:patient_id(users:user_id(first_name, last_name, email))').eq('doctor_id', req.user.doctorId).eq('status', 'active');
            
            const patients = await Promise.all(assignments.map(async (a) => {
                const { data: room } = await supabase.from('chat_rooms').select('id').eq('patient_id', a.patient_id).eq('doctor_id', req.user.doctorId).single();
                return {
                    patient_id: a.patient_id, first_name: a.patients.users.first_name, last_name: a.patients.users.last_name,
                    email: a.patients.users.email, room_id: room?.id
                };
            }));
            res.json({ patients });
        }
    } catch (e) { next(e); }
});

router.get('/rooms/:roomId/messages', authenticate, async (req, res, next) => {
    try {
        const { data: messages } = await supabase.from('chat_messages').select('*, users:sender_id(first_name, last_name)').eq('room_id', req.params.roomId).order('created_at', { ascending: true });
        
        await supabase.from('chat_messages').update({ read_at: new Date() }).eq('room_id', req.params.roomId).neq('sender_id', req.user.userId).is('read_at', null);

        const formatted = messages.map(m => ({ ...m, first_name: m.users?.first_name, last_name: m.users?.last_name }));
        res.json({ messages: formatted });
    } catch (e) { next(e); }
});

router.get('/unread-count', authenticate, async (req, res, next) => {
    try {
        let count = 0;
        let rooms = [];
        if (req.user.role === 'patient') {
            const { data } = await supabase.from('chat_rooms').select('id').eq('patient_id', req.user.patientId);
            rooms = data || [];
        } else {
             const { data } = await supabase.from('chat_rooms').select('id').eq('doctor_id', req.user.doctorId);
             rooms = data || [];
        }

        if (rooms.length > 0) {
            const { count: c } = await supabase.from('chat_messages').select('id', { count: 'exact', head: true }).in('room_id', rooms.map(r => r.id)).neq('sender_id', req.user.userId).is('read_at', null);
            count = c || 0;
        }
        res.json({ unreadCount: count });
    } catch (e) { next(e); }
});

module.exports = router;
