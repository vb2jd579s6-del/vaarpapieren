# Vaarpapieren

Desktop-app om maritieme documenten en certificaten bij te houden: STCW-certificaten, vaarbevoegdheid, zeevaartmedische keuring, monsterboek, paspoort en dergelijke. Per document zie je wanneer het is afgegeven en wanneer het verloopt. Als een vervaldatum dichtbij komt, krijg je een melding in het meldingencentrum van macOS of Windows, ook als het venster dicht is.

- Volledig offline: geen accounts, geen servers, geen externe API's.
- Gegevens staan lokaal in SQLite. Bestanden worden als kopie in de app-datamap bewaard.
- Oude versies blijven altijd bewaard. De app verwijdert nooit iets automatisch.
- Stack: Tauri 2, React, TypeScript en Vite.

## Installeren (voor ontwikkeling)

Nodig:

| | macOS (Apple Silicon) | Windows |
|---|---|---|
| Node.js | 20 of nieuwer | 20 of nieuwer |
| Rust | stable, 1.90 of nieuwer (`rustup`) | stable, 1.90 of nieuwer (`rustup`, MSVC-toolchain) |
| Overig | Xcode Command Line Tools (`xcode-select --install`) | Microsoft C++ Build Tools ("Desktop development with C++") en WebView2. WebView2 zit standaard in Windows 10 en 11. |

Zie ook de [Tauri-voorwaarden](https://tauri.app/start/prerequisites/).

Daarna, in de projectmap:

```bash
npm install
```

## Ontwikkelen

```bash
npm run tauri dev     # start de app met hot reload; de eerste keer duurt het compileren een paar minuten
npm test              # Vitest: domeinlogica, database (op de echte migratie) en opslaan/bewerken/verwijderen
npm run test:watch    # idem, opnieuw bij elke wijziging
cd src-tauri && cargo test --lib   # Rust-tests
```

Goed om te weten:

- **Venster sluiten verbergt de app alleen.** De app blijft draaien in de menubalk (macOS) of het systeemvak (Windows). Echt afsluiten doe je via het icoon → **Afsluiten**, of met Cmd+Q op macOS.
- Draait de app al, dan opent een tweede start het bestaande venster.
- Zonder de Tauri-runtime werkt de frontend niet. `npm run dev` opent wel de pagina in een browser, maar de database en bestanden doen het daar niet.

### Projectindeling

```
src/
  components/          herbruikbare UI (kaart, tabel, dialogen, formuliervelden)
  pages/               Splash, Overview, Add, Settings
  i18n/nl.ts           ALLE UI-tekst (ook het tray-menu en de meldingen)
  lib/domain/          pure, geteste logica: datums, status, drempels, versies, formulieren, meldingsplanning
  lib/db/              SQLite-repositories (zelfde SQL in app en tests)
  lib/files/           bestanden kiezen/kopiëren/openen (via Rust-commands)
  lib/notifications/   controle, versturen, klik op melding
  lib/documents.ts     opslaan/bewerken/verwijderen in de juiste volgorde, met terugdraaien
  styles/              thema (licht/donker volgens systeem)
src-tauri/
  migrations/          SQL-migraties (draaien automatisch bij het openen van de database)
  src/lib.rs           tray, venstergedrag, 6-uurs-timer, klik op melding, plugins
  src/files.rs         kopiëren naar de app-datamap, openen, verwijderen
```

**App-icoon:** de bron is `src-tauri/icons/source/app-icon.svg`, met het schild en het schip uit het Tharsis-logo nagetekend als vector. Na een wijziging maak je alle formaten opnieuw:

```bash
cd src-tauri/icons/source
swift render.swift app-icon.svg app-icon.png 1024
swift render.swift tray-template.svg ../tray-template.png 64
cd ../../.. && npx tauri icon src-tauri/icons/source/app-icon.png && rm -r src-tauri/icons/android src-tauri/icons/ios
```

De menubalk op macOS gebruikt `tray-template.png`: een zwart sjabloon dat macOS zelf kleurt voor een lichte of donkere menubalk. Windows toont het gekleurde app-icoon in het systeemvak. Toont het Dock nog het oude icoon, voer dan `killall Dock` uit.

**Vertalen:** kopieer `src/i18n/nl.ts` naar bijvoorbeeld `en.ts`, vertaal de teksten en kies de taal in `src/i18n/index.ts`. TypeScript controleert dan of er geen tekst ontbreekt.

### Waar staan de gegevens?

| | Map |
|---|---|
| macOS | `~/Library/Application Support/nl.tharsis.vaarpapieren/` |
| Windows | `%APPDATA%\nl.tharsis.vaarpapieren\` |

In die map staan `vaarpapieren.db` (de database) en `files/` (de kopieën van je documenten). De map staat ook onder Instellingen → Gegevens. Een back-up maken is deze map kopiëren terwijl de app is afgesloten.

## Bouwen

```bash
npm run tauri build
```

De installatiebestanden komen in `src-tauri/target/release/bundle/`:

| Platform | Resultaat |
|---|---|
| macOS | `macos/Vaarpapieren.app` en `dmg/Vaarpapieren_<versie>_aarch64.dmg` |
| Windows | `nsis/Vaarpapieren_<versie>_x64-setup.exe` en `msi/Vaarpapieren_<versie>_x64_en-US.msi` |

Alleen de `.app` bouwen gaat sneller: `npm run tauri build -- --bundles app`.

Een Windows-build maak je op een Windows-pc. Kruiselings bouwen vanaf macOS wordt niet ondersteund.

**Niet ondertekend:** de builds zijn niet ondertekend.

- **macOS:** de eerste keer opent de app niet met dubbelklikken. Gebruik rechtsklik → **Open** en bevestig, of ga naar Systeeminstellingen → Privacy en beveiliging → **Toch openen**.
- **Windows:** SmartScreen toont "Onbekende uitgever". Kies **Meer informatie** → **Toch uitvoeren**.

## Meldingen testen

Zo werken meldingen:

- De app controleert bij het opstarten, daarna elke 6 uur, en als je **Nu controleren** kiest in het tray-menu of in Instellingen.
- Standaarddrempels zijn 90, 60, 30, 14, 7 en 1 dag(en) vóór de vervaldatum, plus de vervaldag zelf. Je past ze aan in Instellingen.
- Elke drempel wordt per versie één keer gemeld, en alleen voor de actuele versie van een document. Valt een document al binnen meerdere drempels, dan krijg je één melding.
- Verander je de vervaldatum van een versie, dan beginnen de drempels voor die versie opnieuw.
- Een klik op een melding opent het venster bij dat document. Het document wordt omlijnd en in beeld gescrold.

### Snel testen

1. Voeg een document toe dat over een paar dagen verloopt, bijvoorbeeld over 5 dagen.
2. Kies Instellingen → **Nu controleren**. Je krijgt één melding: "Verloopt over 5 dagen, op …".
3. Kies nog eens **Nu controleren**. Er komt geen tweede melding.
4. Klik op de melding. Het venster opent bij dat document.

Instellingen → **Testmelding versturen** controleert alleen of meldingen doorkomen, zonder documenten.

Om dezelfde drempels opnieuw te testen, maak je het meldingslogboek leeg terwijl de app is afgesloten:

```bash
sqlite3 ~/Library/Application\ Support/nl.tharsis.vaarpapieren/vaarpapieren.db "DELETE FROM notification_log"
```

Je kunt ook de vervaldatum van het testdocument aanpassen.

### macOS

- **Test met een gebouwde app, niet met `tauri dev`.** In dev-modus is de app geen echte `.app`-bundel. Meldingen komen dan soms niet door, of van een andere afzender. Ook klikken op een melding is daar niet betrouwbaar.
  ```bash
  npm run tauri build -- --bundles app
  open src-tauri/target/release/bundle/macos/Vaarpapieren.app
  ```
- De eerste melding laat macOS om toestemming vragen. Komt er niets: ga naar Systeeminstellingen → **Meldingen** → **Vaarpapieren** en zet "Sta meldingen toe" aan. Kies als stijl "Banners" of "Meldingen".
- Staat een focusmodus aan, zoals Niet storen, dan verschijnen meldingen alleen in het meldingencentrum.
- Klikken op een melding werkt ook als het venster verborgen is: het venster komt dan naar voren.

### Windows

- **Test met de geïnstalleerde app** (via de `-setup.exe` of `.msi`). De installer registreert de app in het Startmenu. Pas dan toont Windows meldingen met de naam Vaarpapieren. In `tauri dev` komen meldingen soms niet door, of onder een andere naam.
- Kijk bij Instellingen → Systeem → **Meldingen** of meldingen voor Vaarpapieren aan staan, en of "Niet storen" uit staat.
- Klikken werkt zolang de melding op het scherm staat. Is hij al naar het Actiecentrum verschoven, dan geeft Windows de klik niet aan de app door. Open de app dan via het systeemvak.
- Autostart zet een item onder Instellingen → Apps → **Opstarten**.

### Achtergrond en autostart controleren

1. Sluit het venster. Het icoon blijft in de menubalk of het systeemvak staan.
2. Open het tray-menu → **Openen**. Het venster komt terug.
3. Zet Instellingen → **Automatisch starten bij inloggen** aan. Na opnieuw inloggen start Vaarpapieren zonder venster, alleen met het icoon, en controleert hij direct op verloop.
   - macOS: zichtbaar onder Systeeminstellingen → Algemeen → **Inloggen**.
   - In dev-modus registreert autostart het dev-programma. Zet het na het testen weer uit, en test autostart met een gebouwde of geïnstalleerde app.

## Bekende beperkingen

- De 6-uurs-controle draait zolang de app draait, ook met een verborgen venster. Tijd waarin de computer slaapt telt niet mee. Na het ontwaken kan het dus tot 6 uur wakkere tijd duren voordat de volgende automatische controle komt. Een herstart of **Nu controleren** controleert direct.
- Windows is geschreven volgens de Tauri-documentatie, maar niet op een Windows-pc getest. Loop de stappen hierboven op Windows na.
