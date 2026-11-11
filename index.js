const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('--- ESCANEA ESTE CÓDIGO QR EN LOS LOGS DE RENDER ---');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. Reconectando:', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('¡Conectado exitosamente a WhatsApp con Baileys!');
        }
    });
}

// Endpoint para recibir las peticiones POST desde PHP (InfinityFree)
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body; 
    
    if (!number || !message) {
        return res.status(400).json({ status: 'error', error: 'Faltan parámetros: number o message' });
    }

    try {
        const id = `${number}@s.whatsapp.net`;
        await sock.sendMessage(id, { text: message });
        res.json({ status: 'success', message: 'Mensaje enviado correctamente' });
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

// Ruta de estado para verificar que el servicio web está activo
app.get('/', (req, res) => {
    res.send('Bot de Baileys activo y funcionando para Divino Drip');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
    connectToWhatsApp();
});