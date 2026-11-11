const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');

const app = express();
app.use(express.json());

let sock;
let isWhatsAppConnected = false;
let reconnectTimer;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const currentSocket = makeWASocket({
        auth: state,
        printQRInTerminal: false // Desactivamos el QR visual
    });
    sock = currentSocket;

    currentSocket.ev.on('creds.update', saveCreds);

    // Si la cuenta no está registrada aún, generamos el código de 8 dígitos por consola
    if (!currentSocket.authState.creds.registered) {
        const phoneNumber = '573114460450'; // Tu número configurado
        
        setTimeout(async () => {
            try {
                const code = await currentSocket.requestPairingCode(phoneNumber);
                console.log('==============================================');
                console.log(`TU CÓDIGO DE VINCULACIÓN ES: ${code}`);
                console.log('==============================================');
            } catch (err) {
                console.error('Error al solicitar código de vinculación:', err);
            }
        }, 3000);
    }

    currentSocket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. Reconectando:', shouldReconnect);
            isWhatsAppConnected = false;
            if (shouldReconnect) {
                if (reconnectTimer) clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(() => connectToWhatsApp(), 5000);
            }
        } else if (connection === 'open') {
            console.log('¡Conectado exitosamente a WhatsApp con Baileys!');
            isWhatsAppConnected = true;
        }
    });
}

app.post('/send-message', async (req, res) => {
    const { number, message } = req.body; 
    if (!number || !message) {
        return res.status(400).json({ status: 'error', error: 'Faltan parámetros' });
    }
    if (!isWhatsAppConnected || !sock) {
        return res.status(503).json({ status: 'error', error: 'El bot de WhatsApp aún no está conectado.' });
    }
    try {
        const id = `${number}@s.whatsapp.net`;
        await sock.sendMessage(id, { text: message });
        res.json({ status: 'success', message: 'Mensaje enviado correctamente' });
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
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

   