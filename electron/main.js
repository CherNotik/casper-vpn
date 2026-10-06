const { app, BrowserWindow, shell, ipcMain } = require("electron");
const { spawn, execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");
const core = require("./core");

let child = null, lastLog = "";
const singbox = () => app.isPackaged
  ? path.join(process.resourcesPath, "bin", "sing-box.exe")
  : path.join(__dirname, "..", "bin", "sing-box.exe");

function create() {
  const w = new BrowserWindow({
    width: 460, height: 820, minWidth: 360, minHeight: 600,
    backgroundColor: "#15121d", autoHideMenuBar: true, title: "Casper VPN",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true },
  });
  w.loadFile(path.join(__dirname, "..", "www", "index.html"));
  w.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

// Подписка: запрос идёт из приложения, поэтому ограничения браузера (CORS) не мешают
ipcMain.handle("sub:fetch", async (_e, url) => {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "v2rayN/6.45" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { ok: false, error: "HTTP " + r.status };
    const servers = core.parseSub(await r.text());
    let title = r.headers.get("profile-title") || "";
    if (title.startsWith("base64:")) title = Buffer.from(title.slice(7), "base64").toString("utf8");
    return { ok: true, servers, info: core.parseUserInfo(r.headers.get("subscription-userinfo")), title };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});

// Пинг = время установки TCP-соединения с сервером
ipcMain.handle("ping", (_e, host, port) => new Promise((res) => {
  const t0 = Date.now(), s = net.connect({ host, port, timeout: 2500 });
  s.on("connect", () => { s.destroy(); res(Date.now() - t0); });
  s.on("timeout", () => { s.destroy(); res(-1); });
  s.on("error", () => res(-1));
}));

function stop() { if (child) { try { child.kill(); } catch (e) {} child = null; } }

ipcMain.handle("vpn:connect", async (_e, link, split) => {
  stop();
  try {
    const exe = singbox();
    if (!fs.existsSync(exe)) return { ok: false, error: "нет sing-box.exe" };
    const cfg = path.join(app.getPath("userData"), "config.json");
    fs.writeFileSync(cfg, JSON.stringify(core.buildConfig(link, split)));
    lastLog = "";
    child = spawn(exe, ["run", "-c", cfg, "-D", app.getPath("userData")], { windowsHide: true });
    const add = (d) => { lastLog = (lastLog + d.toString()).slice(-600); };
    child.stdout.on("data", add); child.stderr.on("data", add);
    return await new Promise((res) => {
      const c = child;
      c.on("exit", () => { if (child === c) child = null; res({ ok: false, error: lastLog.trim().split("\n").pop() || "ядро остановилось" }); });
      setTimeout(() => { if (child === c) res({ ok: true }); }, 3000);
    });
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle("vpn:disconnect", () => { stop(); return { ok: true }; });

// Список приложений: те, что сейчас открыты (имена процессов)
ipcMain.handle("apps:list", () => new Promise((res) => {
  execFile("powershell", ["-NoProfile", "-Command",
    "Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object -ExpandProperty ProcessName -Unique"],
    { windowsHide: true }, (err, out) => res(err ? [] : out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)));
}));

app.whenReady().then(create);
app.on("before-quit", stop);
app.on("window-all-closed", () => { stop(); app.quit(); });
