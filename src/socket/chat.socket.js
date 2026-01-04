const supabase = require('../config/supabaseClient');
const { verifyToken } = require('../config/jwt');

const chatSocket = (io, socket) => {
  let userId, userRole, patientId, doctorId;

  socket.on('authenticate', async ({ token }) => {
    try {
      if (!token) return socket.emit('error', 'Token required');
      const decoded = verifyToken(token);
      userId = decoded.userId; userRole = decoded.role; patientId = decoded.patientId; doctorId = decoded.doctorId;

      await supabase.from('user_online_status').upsert({ user_id: userId, is_online: true, last_seen: new Date() }, { onConflict: 'user_id' });

      let rooms = [];
      if (userRole === 'patient') {
          const { data } = await supabase.from('chat_rooms').select('id').eq('patient_id', patientId);
          rooms = data || [];
      } else {
          const { data } = await supabase.from('chat_rooms').select('id').eq('doctor_id', doctorId);
          rooms = data || [];
      }

      rooms.forEach(r => socket.join(`room_${r.id}`));
      socket.emit('authenticated', 'Success');
    } catch (e) { socket.emit('error', 'Auth failed'); }
  });

  socket.on('join_room', ({ roomId }) => {
      socket.join(`room_${roomId}`);
      socket.emit('joined_room', { roomId });
  });

  socket.on('send_message', async ({ roomId, message }) => {
      if (!userId) return socket.emit('error', 'Not authenticated');
      
      const { data: msg } = await supabase.from('chat_messages').insert({
          room_id: roomId, sender_id: userId, sender_role: userRole, message
      }).select().single();

      const { data: user } = await supabase.from('users').select('first_name, last_name, email').eq('id', userId).single();
      
      io.to(`room_${roomId}`).emit('new_message', {
          ...msg, first_name: user.first_name, last_name: user.last_name, email: user.email
      });
  });

  socket.on('disconnect', async () => {
      if (userId) await supabase.from('user_online_status').update({ is_online: false, last_seen: new Date() }).eq('user_id', userId);
  });
};

module.exports = chatSocket;
