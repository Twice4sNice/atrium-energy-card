# Atrium Energiefluss

Energiefluss mit Netzbezug, Einspeisung, Solar, Hausverbrauch und einzelnen Geräten. Ersetzt power-flow-card-plus für die gängigen Fälle.

Teil der Atrium-Kartenfamilie. Die [Atrium-Integration](https://github.com/Twice4sNice/Atrium) bringt diese Karte bereits mit; dieses Repo ist für alle, die nur die Karte in einem normalen Dashboard nutzen wollen.

## Installation

**HACS:** HACS → Benutzerdefinierte Repositories → `https://github.com/Twice4sNice/atrium-energy-card` mit Typ *Dashboard* hinzufügen, dann „Atrium Energiefluss“ installieren.

**Manuell:** `atrium-energy-card.js` nach `/config/www/` kopieren und unter Einstellungen → Dashboards → Ressourcen als `/local/atrium-energy-card.js` (JavaScript-Modul) eintragen.

Ist die Atrium-Integration installiert, ist keine zusätzliche Ressource nötig.

## Konfiguration

```yaml
type: custom:atrium-energy
name: Energiefluss
grid:
  consumption: sensor.netz_bezug
  production: sensor.netz_einspeisung   # optional
solar: sensor.pv_leistung                # optional
devices:                                 # optional
  - entity: sensor.waschmaschine_power
    name: Waschmaschine
    icon: mdi:washing-machine
```

Die Karte erscheint auch in der Kartenauswahl des Dashboard-Editors.

## Ersetzt

`power-flow-card-plus`: Atrium übersetzt bestehende Konfigurationen dieser Karte automatisch.

## Lizenz

MIT
