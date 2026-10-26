# Plan 1.3.0 — vaartijd, eisen per functie, agenda

Werkafspraak: elke stap apart committen zodra hij af en getest is, en het vinkje hier zetten.
Een nieuwe sessie gaat verder bij het eerste open vinkje. Versie pas verhogen bij het uitbrengen
(de app in Apps moet zichzelf kunnen updaten); de app lokaal NIET installeren zonder dat de
gebruiker erom vraagt.

## 1. Vaartijd bijhouden
- [x] Migratie `0003_sea_service.sql`: tabel `sea_service` (schip, type, IMO, functie,
      aanmonsteren, afmonsteren (leeg = nog aan boord), notities). Ook in `testDb.ts`.
- [x] `src/lib/db/seaService.ts`: lijst, toevoegen, bewerken, verwijderen.
- [x] `src/lib/domain/seaTime.ts` (getest): dagen per periode (inclusief begin- en einddag),
      overlappende periodes niet dubbel tellen, totaal, laatste 5 jaar, laatste 6 maanden,
      per functie en per scheepstype. Verlenging CoC (STCW I/11): 12 maanden (365 dagen) in de
      laatste 5 jaar.
- [x] Nieuw tabblad **Loopbaan** met onderdeel **Vaartijd**: lijst met periodes, formulier,
      totalen en voortgangsbalk naar 365 dagen.
- [x] Teksten in zes talen.

## 2. Eisen per functie
- [x] `src/lib/domain/requirements.ts` (getest): ingebouwde functieprofielen (o.a. matroos,
      stuurman/OOW, stuurman op tanker, kapitein, machinist, kok) met vereiste certificaten,
      elk met zoekwoorden om de documentklassen van de gebruiker te herkennen.
- [x] Controle: per eis geldig / verloopt binnenkort / verlopen / ontbreekt.
- [x] Onderdeel **Eisen per functie** in Loopbaan: functie kiezen (onthouden), checklist, en de
      melding dat dit indicatief is (eisen verschillen per vlagstaat en rederij).

## 3. Agenda-koppeling
- [x] `src/lib/calendar.ts` (getest): .ics met per actueel document een hele-dag-afspraak op de
      vervaldatum, herinneringen (VALARM) volgens de ingestelde drempels, vaste UID per versie.
- [x] Rust: .ics in de cache-map schrijven en openen met de standaard-agenda-app.
- [x] Knoppen: "Naar agenda" in het vergrote document en "Alle vervaldatums naar agenda" in het
      Overzicht.

## 4. Export/import
- [ ] Exportformaat versie 2 met `seaService` en de gekozen functie; versie 1 blijft importeerbaar.

## 5. Afronden
- [ ] Alle tests, build, README (functies per platform), committen. Niet pushen of uitbrengen
      zonder dat de gebruiker erom vraagt.
