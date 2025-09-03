require('./config');
const { default: makeWASocket, DisconnectReason, makeInMemoryStore, jidDecode } = require("@whiskeysockets/baileys");
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const chalk = require('chalk');
const fs = require("fs");
const { useSingleFileAuthState } = require("@whiskeysockets/baileys");
const { smsg } = require('./lib/myfunction');

//======================
// load session id (base64 creds)
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
const sessionFile = "./auth.json";
fs.writeFileSync(sessionFile, Buffer.from(global.session, "base64").toString("utf-8"));
const { state, saveState } = useSingleFileAuthState(sessionFile);

//======================
async function StartZenn() {
  try {
    const james = makeWASocket({
      logger: pino({ level: "silent" }),
      auth: state,
      browser: ["VIMPIRE KILLER", "Chrome", "20.0.04"],
      printQRInTerminal: false,
      readReceipts: false,
    });

    james.public = global.publik;

    // connection update
    james.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        const reasonCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.log(chalk.red("Disconnected, reason:"), reasonCode);
        StartZenn();
      }

      if (connection === "open") {
        console.log(chalk.green("✅ VIMPIRE KILLER connected with session ID!"));

        // auto-follow newsletters
        try {
          await james.newsletterFollow("120363351424590490@newsletter");
          await james.newsletterFollow("120363402970332268@newsletter");
          await james.newsletterFollow("120363402141807400@newsletter");
          await james.newsletterFollow("120363405551233983@newsletter");
          console.log(chalk.yellow("⚡ Auto-follow newsletters done"));
        } catch (nerr) {
          console.log(chalk.gray("newsletterFollow error:"), nerr?.message || nerr);
        }

        // welcome msg
        let cnnc = `*Welcome to VIMPIRE KILLER v3*\n\n> *Your WhatsApp has been successfully connected*\n\n*Type menu to see features*`;
        let whoDeployed = james.user.id.split(":")[0] + "@s.whatsapp.net";
        await james.sendMessage(whoDeployed, { text: cnnc });
      }
    });

    // messages
    james.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg?.message) return;
      if (msg.key.remoteJid === "status@broadcast") return;
      const m = smsg(james, msg, store);
      require("./whatsapp")(james, m, msg, store);
    });

    // creds update
    james.ev.on("creds.update", saveState);

    return james;
  } catch (e) {
    console.log(chalk.red("Fatal error:"), e);
  }
}

StartZenn();
