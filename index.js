const axios = require("axios");
const cheerio = require("cheerio");
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");
const fs = require("fs");

require("dotenv").config();


if (!process.env.TELEGRAM_TOKEN) {
  throw new Error("TELEGRAM_TOKEN no está definido en el .env");
}

if (!process.env.TELEGRAM_CHAT_ID) {
  throw new Error("TELEGRAM_CHAT_ID no está definido en el .env");
}

if (!process.env.TRACKING_WEBSITE_URL) {
  throw new Error("TRACKING_WEBSITE_URL no está definido en el .env");
}

const URL = process.env.TRACKING_WEBSITE_URL || "";
const BOT_TOKEN = process.env.TELEGRAM_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const STATE_FILE = "estado.json";

async function getTrackingStatus() {
  const { data } = await axios.get(URL, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const $ = cheerio.load(data);

  const trackingTable = $("table.table.table-sm.table-hover").first();

  const lastRow = trackingTable.find("tbody tr").last();

  const fecha = lastRow.find("td").first().text().trim();
  const estado = lastRow.find("td").last().text().trim();

  return `📦  ${estado}\n📅  ${fecha.charAt(0).toUpperCase() + fecha.slice(1)}`;
}

async function checkTracking() {
  try {
    console.log("🔎 Consultando tracking...");

    const estadoActual = await getTrackingStatus();

    console.log("📦 Estado actual:", estadoActual);

    let estadoGuardado = null;

    if (fs.existsSync(STATE_FILE)) {
      const file = fs.readFileSync(STATE_FILE);
      estadoGuardado = JSON.parse(file).estado;
    }

    if (estadoActual !== estadoGuardado) {
      console.log("🚀 Cambio detectado!");

      await bot.sendMessage(
        CHAT_ID,
        `Actualización de tu pedido:\n\n${estadoActual}`
      );

      fs.writeFileSync(
        STATE_FILE,
        JSON.stringify({ estado: estadoActual })
      );
    } else {
      console.log("Sin cambios.");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// 🔥 COMANDO /check
bot.onText(/\/check/, async (msg) => {
  try {
    const chatId = msg.chat.id;

    await bot.sendMessage(chatId, "🔎 Consultando estado actual...");

    const estadoActual = await getTrackingStatus();

    await bot.sendMessage(
      chatId,
      `Estado actual del pedido:\n\n${estadoActual}`
    );

  } catch (error) {
    await bot.sendMessage(msg.chat.id, "❌ Error consultando el tracking.");
  }
});

cron.schedule("*/5 * * * *", async () => {
  await checkTracking();
});

checkTracking();
