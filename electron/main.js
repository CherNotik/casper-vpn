const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
function create() {
  const w = new BrowserWindow({
    width: 460, height: 820, minWidth: 360, minHeight: 600,
    backgroundColor: "#15121d", autoHideMenuBar: true, title: "Casper VPN"
  });
  w.loadFile(path.join(__dirname, "..", "www", "index.html"));
  w.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}
app.whenReady().then(create);
app.on("window-all-closed", () => app.quit());
