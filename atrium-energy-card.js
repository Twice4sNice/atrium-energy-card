/*
 * Atrium Energiefluss (atrium-energy) v0.3.1
 * Teil der Atrium-Kartenfamilie: https://github.com/Twice4sNice/Atrium
 * MIT License
 */

const ATRIUM_CARDS_VERSION = "0.3.1";

const aEsc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Only accept simple CSS colours from configs (they end up inside style attributes). */
const safeColor = (v, fallback) =>
  typeof v === "string" && /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(v.trim()) ? v.trim() : fallback;

const OFFLINE = new Set(["unavailable", "unknown"]);
const TOGGLE_DOMAINS = new Set(["switch", "light", "fan", "input_boolean", "automation", "siren", "humidifier"]);
const OPENING_CLASSES = new Set(["door", "window", "opening", "garage_door"]);
const DOMAIN_ICONS = {
  switch: "mdi:power-socket-eu",
  light: "mdi:lightbulb-outline",
  fan: "mdi:fan",
  input_boolean: "mdi:toggle-switch-outline",
  automation: "mdi:robot-outline",
  script: "mdi:script-text-outline",
  binary_sensor: "mdi:checkbox-blank-circle-outline",
  cover: "mdi:window-shutter",
  lock: "mdi:lock",
  sensor: "mdi:eye-outline",
  climate: "mdi:thermostat",
};

const isTemplate = (v) => typeof v === "string" && /\[\[\[|\{\{|\{%/.test(v);
const plain = (v) => (typeof v === "string" && v.trim() && !isTemplate(v) ? v : undefined);

/* "RolladenSchlafzimmerLinks" / "Tasmota_Deko_Haustür" -> readable words. */
const pretty = (v) =>
  String(v || "")
    .replace(/_/g, " ")
    .replace(/([a-zäöüß0-9])([A-ZÄÖÜ])/g, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();

const lang = (hass) => hass?.locale?.language || hass?.language || "de";
const fmtNum = (hass, v, digits) =>
  Number(v).toLocaleString(lang(hass), { minimumFractionDigits: digits, maximumFractionDigits: digits });
const autoDigits = (v) => (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);

const fire = (node, type, detail) =>
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));

const firstEntity = (hass, domains, test = () => true) =>
  Object.keys(hass?.states || {}).find((id) => domains.includes(id.split(".")[0]) && test(hass.states[id]));

function runAction(el, hass, action, entityId) {
  const a = action || {};
  const kind = a.action || "more-info";
  if (kind === "none") return undefined;
  if (kind === "toggle") return hass.callService("homeassistant", "toggle", {}, { entity_id: entityId });
  if (kind === "more-info") return fire(el, "hass-more-info", { entityId: a.entity || entityId });
  if (kind === "navigate") {
    if (a.navigation_path) {
      history.pushState(null, "", a.navigation_path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    }
    return undefined;
  }
  if (kind === "url") {
    if (a.url_path) window.open(a.url_path, "_blank", "noopener");
    return undefined;
  }
  if (kind === "call-service" || kind === "perform-action") {
    const svc = a.perform_action || a.service;
    if (!svc || !svc.includes(".")) return undefined;
    const [domain, service] = svc.split(".");
    return hass.callService(domain, service, a.data || a.service_data || {}, a.target);
  }
  return undefined;
}

const BASE_CSS = `
:host{display:block;container-type:inline-size}
*{box-sizing:border-box}
button{font:inherit;color:inherit}
.c{background:var(--ha-card-background,var(--card-background-color,#1c1c1f));border:1px solid var(--ha-card-border-color,rgba(127,127,127,0.2));border-radius:var(--ha-card-border-radius,24px);box-shadow:var(--ha-card-box-shadow,none);padding:16px;color:var(--primary-text-color,#F5F5F7);height:100%;width:100%;display:flex;flex-direction:column;gap:12px;min-width:0}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.hd{display:flex;align-items:center;gap:12px;min-width:0}
.t{margin:0;font-size:15px;font-weight:700;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.s{margin:2px 0 0;font-size:12.5px;color:var(--secondary-text-color,#9A9AA3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ib{width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;flex:none;background:rgba(127,127,127,0.16);border:1px solid rgba(127,127,127,0.18);--mdc-icon-size:20px}
.off{color:#F5A623}
@container (max-width:200px){.c{padding:12px;gap:10px;border-radius:20px}.ib{width:34px;height:34px;--mdc-icon-size:18px}.t{font-size:14px}}
`;

class AtriumBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    if (!config) throw new Error("Konfiguration fehlt");
    this._config = this._normalize(config);
    if (this._hass) this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config || this._busy) return;
    if (!old || this._watch().some((id) => old.states[id] !== hass.states[id])) this._render();
  }

  get hass() {
    return this._hass;
  }

  _normalize(config) {
    return config;
  }

  _watch() {
    return [];
  }

  _st(id) {
    return id ? this._hass?.states[id] : undefined;
  }

  _name(id, override) {
    return override || pretty(this._st(id)?.attributes?.friendly_name) || id || "";
  }

  getCardSize() {
    return 3;
  }
}

/* ---------- atrium-energy: replaces power-flow-card-plus ---------- */

class AtriumEnergy extends AtriumBase {
  static getStubConfig(hass) {
    return { grid: { consumption: firstEntity(hass, ["sensor"], (s) => s.attributes.device_class === "power") || "" } };
  }

  _normalize(config) {
    const grid = config.grid || {};
    if (!grid.consumption && !config.solar && !(config.devices || []).length) {
      throw new Error("atrium-energy braucht Netz, Solar oder Geräte");
    }
    return { ...config, grid, devices: (config.devices || []).filter((d) => d && d.entity) };
  }

  _watch() {
    const c = this._config;
    return [c.grid.consumption, c.grid.production, c.solar, ...c.devices.map((d) => d.entity)].filter(Boolean);
  }

  getCardSize() {
    return 5;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 6 };
  }

  _watts(id) {
    const s = this._st(id);
    if (!s || OFFLINE.has(s.state)) return null;
    const v = parseFloat(s.state);
    if (!Number.isFinite(v)) return null;
    const unit = String(s.attributes.unit_of_measurement || "").trim().toLowerCase();
    if (unit === "kw") return v * 1000;
    if (unit === "mw") return v * 1000000;
    return v;
  }

  _fmt(w) {
    if (w == null) return "–";
    if (Math.abs(w) >= 1000) return `${fmtNum(this._hass, w / 1000, 2)} kW`;
    return `${fmtNum(this._hass, w, Math.abs(w) < 10 && w % 1 ? 1 : 0)} W`;
  }

  _render() {
    const c = this._config;
    const cons = c.grid.consumption ? this._watts(c.grid.consumption) : null;
    const prod = c.grid.production ? this._watts(c.grid.production) : null;
    const solar = c.solar ? this._watts(c.solar) : null;
    const home = cons == null && solar == null ? null : Math.max(0, (cons || 0) - (prod || 0) + (solar || 0));
    const solarNode = c.solar
      ? `<button class="nd ${solar == null ? "dash" : "sun"}" data-id="${aEsc(c.solar)}">
          <span class="ib"><ha-icon icon="mdi:solar-power-variant"></ha-icon></span>
          <span class="tx"><b>Solar</b><small class="${solar == null ? "off" : ""}">${solar == null ? "Nicht erreichbar" : this._fmt(solar)}</small></span></button>`
      : "";
    const gridNode = c.grid.consumption
      ? `<button class="nd ${cons == null ? "dash" : "grid"}" data-id="${aEsc(c.grid.consumption)}">
          <span class="ib"><ha-icon icon="mdi:transmission-tower"></ha-icon></span>
          <span class="tx"><b>${aEsc(plain(c.grid_name) || "Netz")}</b><small class="${cons == null ? "off" : ""}">${cons == null ? "Nicht erreichbar" : `${this._fmt(cons)} Bezug${c.grid.production ? ` · ${this._fmt(prod || 0)} Einspeisung` : ""}`}</small></span></button>`
      : "";
    const devices = c.devices
      .map((d) => {
        const w = this._watts(d.entity);
        return `<button class="dv" data-id="${aEsc(d.entity)}"><span class="hd"><ha-icon icon="${aEsc(plain(d.icon) || "mdi:power-plug-outline")}"></ha-icon><b>${aEsc(this._name(d.entity, plain(d.name)))}</b></span><span class="${w == null ? "off" : ""}">${w == null ? "Offline" : this._fmt(w)}</span></button>`;
      })
      .join("");
    const flowIn = (cons || 0) > 0 || (solar || 0) > 0;
    const flowOut = c.devices.some((d) => (this._watts(d.entity) || 0) > 1);
    this.shadowRoot.innerHTML = `<style>${BASE_CSS}
      .g{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px;align-items:center}
      .col{display:flex;flex-direction:column;gap:10px;min-width:0}
      .nd,.dv{width:100%;text-align:left;cursor:pointer;background:transparent}
      .nd{display:flex;align-items:center;gap:12px;padding:12px;border-radius:20px;border:1px solid rgba(127,127,127,0.2)}
      .nd .tx{min-width:0}
      .nd b{display:block;font-size:14px}
      .nd small{display:block;font-size:12px;color:var(--secondary-text-color,#9A9AA3)}
      .grid{border-color:rgba(47,107,255,0.4);background:rgba(47,107,255,0.1)}
      .grid small{color:#9DBBFF}
      .sun{border-color:rgba(240,163,92,0.45);background:rgba(240,163,92,0.1)}
      .sun small{color:#F5C26B}
      .dash{border-style:dashed}
      .hub{display:flex;flex-direction:column;align-items:center;gap:10px}
      .ln{width:100%;height:4px;border-radius:4px;background:repeating-linear-gradient(90deg,#2F6BFF 0 10px,transparent 10px 18px);background-size:18px 4px}
      .ln.run{animation:flow 1s linear infinite}
      .ln.idle{background:repeating-linear-gradient(90deg,rgba(127,127,127,0.35) 0 10px,transparent 10px 18px)}
      @keyframes flow{from{background-position:0 0}to{background-position:18px 0}}
      @media (prefers-reduced-motion:reduce){.ln.run{animation:none}}
      .home{width:136px;height:136px;border-radius:999px;border:3px solid #2F6BFF;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(47,107,255,0.18),transparent 70%);--mdc-icon-size:24px}
      .home b{font-size:24px;font-weight:800;letter-spacing:-.02em;margin-top:4px}
      .home small{font-size:11.5px;color:var(--secondary-text-color,#9A9AA3)}
      .dv{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:16px;border:0;background:rgba(127,127,127,0.1);font-size:13px;--mdc-icon-size:18px}
      .dv b{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dv>span:last-child{font-variant-numeric:tabular-nums;color:var(--secondary-text-color,#9A9AA3);white-space:nowrap}
      .nd:focus-visible,.dv:focus-visible{outline:2px solid #5B8CFF;outline-offset:2px}
      @container (max-width:420px){.ln{display:none}.home{width:112px;height:112px}.home b{font-size:20px}}
    </style>
    <div class="c">
      <div class="row"><div><p class="t">${aEsc(plain(c.name) || "Energiefluss")}</p><p class="s">Jetzt</p></div></div>
      <div class="g">
        <div class="col">${solarNode}${gridNode}</div>
        <div class="hub"><div class="ln ${flowIn ? "run" : "idle"}"></div>
          <div class="home"><ha-icon icon="mdi:home-outline"></ha-icon><b>${this._fmt(home)}</b><small>Haus</small></div>
          <div class="ln ${flowOut ? "run" : "idle"}" style="${devices ? "" : "visibility:hidden"}"></div></div>
        ${devices ? `<div class="col">${devices}</div>` : ""}
      </div>
    </div>`;
    this.shadowRoot.querySelectorAll("[data-id]").forEach((n) =>
      n.addEventListener("click", () => fire(this, "hass-more-info", { entityId: n.dataset.id }))
    );
  }
}


if (!customElements.get("atrium-energy")) customElements.define("atrium-energy", AtriumEnergy);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "atrium-energy")) window.customCards.push({ type: "atrium-energy", name: "Atrium Energiefluss", description: "Netz, Solar, Haus und Geräte", preview: true });
console.info("%c ATRIUM-ENERGY %c v0.3.1 ", "color:#fff;background:#2F6BFF;border-radius:4px 0 0 4px;padding:2px 4px", "color:#2F6BFF;background:#1c1c1f;border-radius:0 4px 4px 0;padding:2px 4px");
