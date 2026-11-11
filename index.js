const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');

const app = express();
app.use(express.json());

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false // Desactivamos el QR visual
    });

    sock.ev.on('creds.update', saveCreds);

    // Si la cuenta no está registrada aún, generamos el código de 8 dígitos
    if (!sock.authState.creds.registered) {
        // Escribe aquí tu número de WhatsApp con código de país (ejemplo Colombia: 57XXXXXXXXXX)
        const phoneNumber = '573001234567'; 
        
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log('==============================================');
                console.log(`TU CÓDIGO DE VINCULACIÓN ES: ${code}`);
                console.log('==============================================');
            } catch (err) {
                console.error('Error al solicitar código de vinculación:', err);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. Reconectando:', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('¡Conectado exitosamente a WhatsApp con Baileys!');
        }
    });
}

app.post('/send-message', async (req, res) => {
    const { number, message } = req.body; 
    if (!number || !message) {
        return res.status(400).json({ status: 'error', error: 'Faltan parámetros' });
    }
    try {
        const id = `${number}@s.whatsapp.net`;
        await sock.sendMessage(id, { text: message });
        res.json({ status: 'success', message: 'Mensaje enviado correctamente' });
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('Bot de Baileys activo para Divino Drip');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
    connectToWhatsApp();
});