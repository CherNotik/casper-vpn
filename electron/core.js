// Разбор подписки и сборка конфига sing-box. Без зависимостей от Electron — можно тестировать отдельно.
const b64 = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function parseVless(link) {
  const u = new URL(link);
  const q = (k) => u.searchParams.get(k) || "";
  const security = q("security") || "none";
  const type = q("type") || "tcp";
  const o = {
    type: "vless", tag: "proxy",
    server: u.hostname.replace(/^\[|\]$/g, ""), server_port: Number(u.port || 443),
    uuid: decodeURIComponent(u.username),
    domain_resolver: "local",
  };
  if (q("flow")) o.flow = q("flow");
  if (security === "tls" || security === "reality") {
    o.tls = { enabled: true, server_name: q("sni") || q("host") || o.server };
    if (q("fp")) o.tls.utls = { enabled: true, fingerprint: q("fp") };
    if (q("alpn")) o.tls.alpn = q("alpn").split(",");
    if (q("allowInsecure") === "1") o.tls.insecure = true;
    if (security === "reality") o.tls.reality = { enabled: true, public_key: q("pbk"), short_id: q("sid") };
  }
  if (type === "ws") o.transport = { type: "ws", path: q("path") || "/", headers: q("host") ? { Host: q("host") } : undefined };
  else if (type === "grpc") o.transport = { type: "grpc", service_name: q("serviceName") };
  else if (type === "httpupgrade") o.transport = { type: "httpupgrade", path: q("path") || "/", host: q("host") || undefined };
  return o;
}

// Страна по эмодзи-флагу в названии сервера (🇳🇱 -> NL) и по названию
const NAMES = { NL: ["netherlands", "нидерланд", "holland"], DE: ["germany", "герман"], FI: ["finland", "финлянд"], AT: ["austria", "австри"], SE: ["sweden", "швец"], PL: ["poland", "польш"], US: ["usa", "united states", "сша"], GB: ["united kingdom", "британ", "london"], FR: ["france", "франц"], TR: ["turkey", "турц"], KZ: ["kazakh", "казах"], CH: ["switzerland", "швейцар"] };
function countryOf(name) {
  const cps = [...name].map((c) => c.codePointAt(0)).filter((c) => c >= 0x1f1e6 && c <= 0x1f1ff);
  if (cps.length >= 2) return String.fromCharCode(cps[0] - 0x1f1e6 + 65, cps[1] - 0x1f1e6 + 65);
  const n = name.toLowerCase();
  for (const [cc, keys] of Object.entries(NAMES)) if (keys.some((k) => n.includes(k))) return cc;
  return "??";
}
const cleanName = (n) => n.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "").replace(/^[\s|\-–]+/, "").trim() || n;

function parseSub(text) {
  let t = text.trim();
  if (!t.includes("://")) { try { t = b64(t); } catch (e) {} }
  const servers = [];
  for (const line of t.split(/\r?\n/)) {
    const l = line.trim();
    if (!l.startsWith("vless://")) continue;
    try {
      const o = parseVless(l);
      const raw = decodeURIComponent((l.split("#")[1] || o.server));
      servers.push({ id: o.server + ":" + o.server_port + ":" + o.uuid.slice(0, 8), name: cleanName(raw), cc: countryOf(raw), host: o.server, port: o.server_port, link: l });
    } catch (e) {}
  }
  return servers;
}

function parseUserInfo(h) { // заголовок subscription-userinfo: upload=..; download=..; total=..; expire=..
  const r = {};
  (h || "").split(";").forEach((p) => { const [k, v] = p.trim().split("="); if (k) r[k] = Number(v); });
  return { used: (r.upload || 0) + (r.download || 0), total: r.total || 0, expire: r.expire ? r.expire * 1000 : 0 };
}

function buildConfig(link, split) { // split: {enabled, apps:[exe names]}
  const proxy = parseVless(link);
  const apps = split && split.enabled ? split.apps || [] : null;
  const rules = [{ action: "sniff" }, { protocol: "dns", action: "hijack-dns" }, { ip_is_private: true, outbound: "direct" }];
  const dnsRules = [];
  if (apps) { rules.push({ process_name: apps, outbound: "proxy" }); dnsRules.push({ process_name: apps, server: "remote" }); }
  return {
    log: { level: "warn", timestamp: true },
    dns: {
      servers: [{ tag: "remote", type: "https", server: "1.1.1.1", detour: "proxy" }, { tag: "local", type: "local" }],
      rules: dnsRules, final: apps ? "local" : "remote",
    },
    inbounds: [{ type: "tun", tag: "tun-in", address: ["172.19.0.1/30"], auto_route: true, strict_route: true, stack: "mixed" }],
    outbounds: [proxy, { type: "direct", tag: "direct" }],
    route: { rules, final: apps ? "direct" : "proxy", auto_detect_interface: true, default_domain_resolver: "local" },
  };
}
module.exports = { parseSub, parseUserInfo, buildConfig, parseVless };
