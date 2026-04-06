import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { Bot, InputFile } from "grammy";
import axios from "axios";
import * as dotenv from "dotenv";
import { parseTxt, generateHtml, htmlToTxt } from "./src/utils";

dotenv.config();

const API_ID = process.env.API_ID;
const API_HASH = process.env.API_HASH;
const BOT_TOKEN = process.env.BOT_TOKEN;
const LOG_CHANNEL = process.env.LOG_CHANNEL;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is missing in environment variables.");
}

const bot = new Bot(BOT_TOKEN || "");

const h2tPending = new Set<number>();

// Ensure directories exist
const downloadsDir = path.join(process.cwd(), "downloads");
const outputsDir = path.join(process.cwd(), "outputs");
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir);

async function silentLog(ctx: any, mode: string, filePath: string, fileName: string) {
  if (!LOG_CHANNEL) return;
  try {
    const user = ctx.from;
    const uname = user?.username ? `@${user.username}` : `id:${user?.id}`;
    await bot.api.sendDocument(LOG_CHANNEL, new InputFile(filePath, fileName), {
      caption: `#${mode}\nFrom: ${uname} (\`${user?.id}\`)\nFile: \`${fileName}\``,
      disable_notification: true,
      parse_mode: "Markdown",
    });
  } catch (e) {
    console.warn("silentLog failed:", e);
  }
}

bot.command("start", (ctx) => {
  return ctx.reply(
    "👋 **HTML ↔ TXT Converter Bot**\n\n" +
    "**TXT → HTML** _(automatic)_\n" +
    "Just send any `.txt` file — it converts automatically.\n" +
    "Optional: use `/t2h` before sending.\n\n" +
    "**HTML → TXT**\n" +
    "Send `/h2t`, then send your `.html` file.\n\n" +
    "Supports ALL formats — with or without `[Subject]` brackets, " +
    "pipe-separated titles, base64 URLs, tab-based HTML, and more.\n\n" +
    "Type /help for details.",
    { parse_mode: "Markdown" }
  );
});

bot.command("help", (ctx) => {
  return ctx.reply(
    "**📖 Supported TXT Formats**\n\n" +
    "**Format A** — with `[Subject]` brackets:\n" +
    "```\n" +
    "[Batch Thumbnail] My Batch : https://img.jpg\n" +
    "[Advance]  Algebra_Class_1 : https://video.m3u8\n" +
    "[Arithmetic]  Ratio_Sheet : https://file.pdf\n" +
    "```\n\n" +
    "**Format B** — pipe-separated, no brackets:\n" +
    "```\n" +
    "Class-01 | Eng | Introduction : https://video.m3u8\n" +
    "Voice Detecting Errors : https://file.pdf\n" +
    "Class-27 | Adjective : https://youtube.com/embed/...\n" +
    "```\n\n" +
    "**Commands:**\n" +
    "`/t2h` — TXT → HTML _(optional, auto works too)_\n" +
    "`/h2t` — HTML → TXT",
    { parse_mode: "Markdown" }
  );
});

bot.command("t2h", (ctx) => {
  h2tPending.delete(ctx.from?.id || 0);
  return ctx.reply("✅ **TXT → HTML mode**\n\nSend your `.txt` file now.", { parse_mode: "Markdown" });
});

bot.command("h2t", (ctx) => {
  if (ctx.from) h2tPending.add(ctx.from.id);
  return ctx.reply("✅ **HTML → TXT mode**\n\nSend your `.html` file now.", { parse_mode: "Markdown" });
});

bot.on("message:document", async (ctx) => {
  const uid = ctx.from?.id || 0;
  const doc = ctx.message.document;
  const fileName = doc.file_name || "file";
  const fileNameLower = fileName.toLowerCase();

  let mode: "t2h" | "h2t";
  if (fileNameLower.endsWith(".html") && h2tPending.has(uid)) {
    mode = "h2t";
  } else if (fileNameLower.endsWith(".txt")) {
    mode = "t2h";
  } else if (fileNameLower.endsWith(".html")) {
    return ctx.reply("⚠️ Send `/h2t` first, then your `.html` file.", { parse_mode: "Markdown" });
  } else {
    return ctx.reply("⚠️ Only `.txt` or `.html` files are accepted.");
  }

  const status = await ctx.reply("⏳ Downloading...");
  let dlPath = "";

  try {
    const file = await ctx.getFile();
    dlPath = path.join(downloadsDir, fileName);
    const response = await axios.get(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`, { responseType: "stream" });
    const writer = fs.createWriteStream(dlPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(null));
      writer.on("error", reject);
    });

    await bot.api.editMessageText(ctx.chat.id, status.message_id, "📨 Logging...");
    await silentLog(ctx, mode.toUpperCase(), dlPath, fileName);

    await bot.api.editMessageText(ctx.chat.id, status.message_id, "⚙️ Converting...");
    const raw = fs.readFileSync(dlPath, "utf-8");
    const base = fileName.split(".").slice(0, -1).join(".");

    if (mode === "t2h") {
      const [batchName, subjects] = parseTxt(raw, fileName);
      const templatePath = path.join(process.cwd(), "subject_template.html");
      const template = fs.readFileSync(templatePath, "utf-8");
      const html = generateHtml(batchName, subjects, template);

      const outName = `${base}.html`;
      const outPath = path.join(outputsDir, outName);
      fs.writeFileSync(outPath, html);

      const vCount = (html.match(/class="video-item"/g) || []).length;
      const pCount = (html.match(/class="pdf-item"/g) || []).length;
      const oCount = (html.match(/class="other-item"/g) || []).length;

      await bot.api.editMessageText(ctx.chat.id, status.message_id, "📤 Uploading HTML...");
      await ctx.replyWithDocument(new InputFile(outPath, outName), {
        caption: `✅ **TXT → HTML Done!**\n\n📚 Batch: \`${batchName}\`\n📹 Videos: \`${vCount}\`\n📄 PDFs: \`${pCount}\`\n📁 Others: \`${oCount}\`\n🗂 File: \`${outName}\``,
        parse_mode: "Markdown",
      });
    } else {
      h2tPending.delete(uid);
      const [batchName, txt] = htmlToTxt(raw);

      const outName = `${base}.txt`;
      const outPath = path.join(outputsDir, outName);
      fs.writeFileSync(outPath, txt);

      const lines = txt.split("\n").filter(l => l.trim());
      const vCount = lines.filter(l => l.includes(".m3u8") || l.includes(".mp4") || l.includes("youtube")).length;
      const pCount = lines.filter(l => l.toLowerCase().includes(".pdf") || l.toLowerCase().includes("class-attachment")).length;

      await bot.api.editMessageText(ctx.chat.id, status.message_id, "📤 Uploading TXT...");
      await ctx.replyWithDocument(new InputFile(outPath, outName), {
        caption: `✅ **HTML → TXT Done!**\n\n📚 Batch: \`${batchName}\`\n📹 Videos: \`${vCount}\`\n📄 PDFs: \`${pCount}\`\n📝 Lines: \`${lines.length}\`\n🗂 File: \`${outName}\``,
        parse_mode: "Markdown",
      });
    }

    await bot.api.deleteMessage(ctx.chat.id, status.message_id);
  } catch (e: any) {
    console.error(e);
    await bot.api.editMessageText(ctx.chat.id, status.message_id, `❌ **Error:** \`${e.message || String(e)}\``, { parse_mode: "Markdown" });
  } finally {
    if (dlPath && fs.existsSync(dlPath)) fs.unlinkSync(dlPath);
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", bot: "running" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    bot.start().catch(err => console.error("Bot failed to start:", err));
  });
}

startServer();
