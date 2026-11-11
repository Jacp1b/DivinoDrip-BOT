const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const path = require('node:path');

const app = express();
app.use(express.json());

let sock;
let isWhatsAppConnected = false;
let reconnectTimer;
let isConnecting = false;

async function connectToWhatsApp() {
    if (isConnecting) return;
    isConnecting = true;

    try {
        const authDirectory = process.env.BAILEYS_AUTH_DIR
            || path.join(__dirname, 'auth_info_baileys');
        const { state, saveCreds } = await useMultiFileAuthState(authDirectory);

        const currentSocket = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['Ubuntu', 'Chrome', '22.04.4'],
            syncFullHistory: false,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: false
        });
        sock = currentSocket;

        currentSocket.ev.on('creds.update', saveCreds);

        if (!state.creds.registered) {
            const phoneNumber = '573114460450';

            setTimeout(async () => {
                if (sock !== currentSocket || state.creds.registered) return;
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
                if (sock === currentSocket) {
                    sock = undefined;
                    isWhatsAppConnected = false;
                }
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Conexión cerrada. Reconectando:', shouldReconnect);
                if (shouldReconnect && !reconnectTimer) {
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = undefined;
                        connectToWhatsApp().catch((error) => {
                            console.error('Error al reconectar con WhatsApp:', error);
                        });
                    }, 5000);
                }
            } else if (connection === 'open') {
                isWhatsAppConnected = true;
                console.log('¡Conectado exitosamente a WhatsApp con Baileys!');
            }
        });
    } finally {
        isConnecting = false;
    }
}

app.get('/health', (req, res) => {
    res.status(isWhatsAppConnected ? 200 : 503).json({
        status: isWhatsAppConnected ? 'connected' : 'disconnected'
    });
});

app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    if (typeof number !== 'string' || !/^\d{10,15}$/.test(number)
        || typeof message !== 'string' || message.trim() === '') {
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
    connectToWhatsApp().catch((error) => {
        console.error('Error al iniciar la conexión con WhatsApp:', error);
    });
});
   