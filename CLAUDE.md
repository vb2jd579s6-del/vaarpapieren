# Werkafspraken voor Vaarpapieren

## Releases en pushen
- **Nooit pushen, taggen of een release uitbrengen zonder dat de gebruiker daar in zijn bericht
  expliciet om vraagt.** Ook niet "even snel" of als het klaar lijkt.
- Kleine wijzigingen krijgen geen eigen update: die worden alleen **lokaal gecommit** op de
  MacBook en gaan mee in een volgende, grotere release.
- De app in `/Applications` niet lokaal installeren of overschrijven tenzij de gebruiker erom
  vraagt; hij werkt bij via **Instellingen → Zoek naar updates**.
- Het versienummer pas verhogen bij het uitbrengen, op de drie plekken: `package.json`,
  `src-tauri/tauri.conf.json` en `src-tauri/Cargo.toml` (de huidige lokale versie mag al een
  nummer hoger zijn dan de laatste release, maar niet verder ophogen per kleine wijziging).
- Vóór pushen: `git fetch` en rebasen (de gebruiker past soms bestanden aan op GitHub, zoals de
  README), en controleren dat de activatiecode en de updatesleutel niet in de commits staan.

## Werkwijze
- Grote klussen met meerdere stappen: eerst een afvinklijst in `docs/plan-x.y.md`, elke stap
  apart committen en afvinken, zodat het werk niet verloren gaat als een sessie stopt.
- Code in het Engels, alle UI-tekst in `src/i18n/` in alle zes talen (nl, en, de, es, fr, tl).
- Na wijzigingen: `npx tsc --noEmit`, `npm test` en `cd src-tauri && cargo check`.
- Communicatie met de gebruiker in het Nederlands.
