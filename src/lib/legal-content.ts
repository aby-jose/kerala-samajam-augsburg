/**
 * Default wording for the six legal documents, in German and English.
 *
 * German is the binding version — the association is registered in Germany
 * and an authority reading the Impressum expects German. English is the
 * courtesy translation for the membership.
 *
 * These are seeded into the database once and are then owned by the admin
 * panel; editing them there never touches this file. `{{placeholders}}` are
 * facts only the committee knows (register number, board, address) and are
 * filled in from Settings → Organisation, so replacing a treasurer is a
 * settings edit rather than a new document version.
 *
 * NOT LEGAL ADVICE. These drafts follow standard German practice for a
 * Verein and describe what this application actually does, but they should be
 * reviewed by a lawyer before go-live.
 */

import { LegalContent, LegalSlug } from "./legal-schema";

export interface LegalSeed {
  slug: LegalSlug;
  requiresConsent: boolean;
  de: LegalContent;
  en: LegalContent;
}

// =========================================================================
// 1. Impressum  —  § 5 DDG, § 18 Abs. 2 MStV
// =========================================================================

const imprintDe: LegalContent = {
  title: "Impressum",
  lead: "Anbieterkennzeichnung nach § 5 DDG und § 18 Abs. 2 MStV.",
  sections: [
    {
      id: "angaben",
      heading: "Angaben gemäß § 5 DDG",
      body: `**{{legal.entityName}}**
{{legal.street}}
{{legal.postalCode}} {{legal.city}}
{{legal.country}}

Rechtsform: {{legal.legalForm}}`,
    },
    {
      id: "vertretung",
      heading: "Vertretungsberechtigter Vorstand",
      body: `Der Verein wird gemäß § 26 BGB vertreten durch:

{{legal.boardMembers}}`,
    },
    {
      id: "register",
      heading: "Registereintrag",
      body: `Eingetragen im Vereinsregister.

- Registergericht: {{legal.registerCourt}}
- Registernummer: {{legal.registerNumber}}`,
    },
    {
      id: "kontakt",
      heading: "Kontakt",
      body: `- E-Mail: {{site.email}}
- Telefon: {{site.phone}}
- Kontaktformular: [{{site.url}}/contact]({{site.url}}/contact)`,
    },
    {
      id: "umsatzsteuer",
      heading: "Umsatzsteuer-Identifikationsnummer",
      body: `Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: {{legal.vatId}}

Sofern hier kein Eintrag ausgewiesen ist, verfügt der Verein über keine Umsatzsteuer-Identifikationsnummer.`,
    },
    {
      id: "verantwortlich",
      heading: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV",
      body: `{{legal.responsiblePerson}}
{{legal.responsiblePersonAddress}}`,
    },
    {
      id: "streitbeilegung",
      heading: "Verbraucherstreitbeilegung",
      body: `Die Europäische Kommission hat den Betrieb ihrer Plattform zur Online-Streitbeilegung (OS-Plattform) zum 20. Juli 2025 eingestellt. Ein Verweis auf diese Plattform entfällt daher.

Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle im Sinne des Verbraucherstreitbeilegungsgesetzes (VSBG) teilzunehmen.

Anliegen und Beschwerden richten Sie bitte unmittelbar an {{site.email}} — wir bemühen uns, jedes Anliegen unbürokratisch zu klären.`,
    },
    {
      id: "haftung-inhalte",
      heading: "Haftung für Inhalte",
      body: `Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.

Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden entsprechender Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.`,
    },
    {
      id: "haftung-links",
      heading: "Haftung für Links",
      body: `Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.

Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.`,
    },
    {
      id: "urheberrecht",
      heading: "Urheberrecht",
      body: `Die durch die Betreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.

Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.`,
    },
    {
      id: "bildnachweise",
      heading: "Bildnachweise",
      body: `Fotografien von Vereinsveranstaltungen stammen von Mitgliedern und ehrenamtlichen Fotograf:innen des Vereins. Wenn Sie auf einem veröffentlichten Bild abgebildet sind und dessen Entfernung wünschen, genügt eine formlose Nachricht an {{site.email}}; wir entfernen das Bild ohne Angabe von Gründen.`,
    },
  ],
};

const imprintEn: LegalContent = {
  title: "Imprint",
  lead: "Provider identification pursuant to § 5 DDG and § 18 (2) MStV.",
  sections: [
    {
      id: "angaben",
      heading: "Information pursuant to § 5 DDG",
      body: `**{{legal.entityName}}**
{{legal.street}}
{{legal.postalCode}} {{legal.city}}
{{legal.country}}

Legal form: {{legal.legalForm}}`,
    },
    {
      id: "vertretung",
      heading: "Authorised board",
      body: `The association is represented pursuant to § 26 BGB by:

{{legal.boardMembers}}`,
    },
    {
      id: "register",
      heading: "Register entry",
      body: `Entered in the register of associations (Vereinsregister).

- Registering court: {{legal.registerCourt}}
- Registration number: {{legal.registerNumber}}`,
    },
    {
      id: "kontakt",
      heading: "Contact",
      body: `- Email: {{site.email}}
- Telephone: {{site.phone}}
- Contact form: [{{site.url}}/contact]({{site.url}}/contact)`,
    },
    {
      id: "umsatzsteuer",
      heading: "VAT identification number",
      body: `VAT identification number pursuant to § 27 a of the German VAT Act: {{legal.vatId}}

Where no number is shown, the association does not hold a VAT identification number.`,
    },
    {
      id: "verantwortlich",
      heading: "Responsible for content pursuant to § 18 (2) MStV",
      body: `{{legal.responsiblePerson}}
{{legal.responsiblePersonAddress}}`,
    },
    {
      id: "streitbeilegung",
      heading: "Consumer dispute resolution",
      body: `The European Commission discontinued its Online Dispute Resolution (ODR) platform on 20 July 2025, so no link to that platform is provided.

We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board within the meaning of the German Consumer Dispute Resolution Act (VSBG).

Please address any concerns or complaints directly to {{site.email}} — we aim to resolve every matter informally.`,
    },
    {
      id: "haftung-inhalte",
      heading: "Liability for content",
      body: `As a service provider we are responsible for our own content on these pages under general law, pursuant to § 7 (1) DDG. Under §§ 8 to 10 DDG, however, we are not obliged to monitor transmitted or stored third-party information, or to investigate circumstances that indicate unlawful activity.

Obligations to remove or block the use of information under general law remain unaffected. Liability in this respect is only possible from the point at which we become aware of a specific infringement. Upon becoming aware of such infringements we will remove the content concerned without delay.`,
    },
    {
      id: "haftung-links",
      heading: "Liability for links",
      body: `Our offering contains links to external third-party websites over whose content we have no influence. We therefore cannot accept any liability for that third-party content. The respective provider or operator of the linked pages is always responsible for their content.

The linked pages were checked for possible legal infringements at the time of linking. No unlawful content was apparent at that time. Upon becoming aware of any infringement we will remove such links without delay.`,
    },
    {
      id: "urheberrecht",
      heading: "Copyright",
      body: `Content and works on these pages created by the operators are subject to German copyright law. Reproduction, adaptation, distribution and any form of exploitation beyond the limits of copyright require the written consent of the respective author or creator.

Downloads and copies of this page are permitted for private, non-commercial use only.`,
    },
    {
      id: "bildnachweise",
      heading: "Image credits",
      body: `Photographs of association events are taken by members and volunteer photographers of the association. If you appear in a published image and would like it removed, an informal message to {{site.email}} is enough — we will remove it without requiring a reason.`,
    },
  ],
};

// =========================================================================
// 2. Datenschutzerklärung  —  Art. 12–14 GDPR
// =========================================================================

const privacyDe: LegalContent = {
  title: "Datenschutzerklärung",
  lead: "Wie wir personenbezogene Daten verarbeiten, auf welcher Rechtsgrundlage, und welche Rechte Sie haben.",
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Verantwortlicher",
      body: `Verantwortlicher im Sinne des Art. 4 Nr. 7 DSGVO ist:

**{{legal.entityName}}**
{{legal.street}}
{{legal.postalCode}} {{legal.city}}
{{legal.country}}

E-Mail: {{site.email}}
Vertreten durch: {{legal.boardMembers}}`,
    },
    {
      id: "datenschutzbeauftragter",
      heading: "2. Datenschutzbeauftragter",
      body: `{{legal.dpoName}}
{{legal.dpoEmail}}

Ist an dieser Stelle keine Person benannt, hat der Verein keinen Datenschutzbeauftragten bestellt. Sie erreichen uns in Datenschutzfragen in diesem Fall unmittelbar unter {{site.email}}.`,
    },
    {
      id: "grundsaetze",
      heading: "3. Grundsätze",
      body: `Wir sind ein ehrenamtlich geführter Kulturverein, kein kommerzieller Anbieter. Wir verarbeiten personenbezogene Daten ausschließlich, soweit dies für den Vereinsbetrieb erforderlich ist.

- Wir verkaufen keine Daten und geben sie nicht zu Werbezwecken weiter.
- Wir setzen kein Tracking, keine Werbenetzwerke und keine Profilbildung ein.
- Wir erheben nur die Daten, die für den jeweiligen Zweck erforderlich sind.`,
    },
    {
      id: "hosting",
      heading: "4. Hosting und Server-Logfiles",
      body: `Diese Website wird bei {{legal.hostingProvider}} gehostet. Die Datenbank wird bei MongoDB Atlas betrieben.

Beim Aufruf der Website werden automatisch Informationen im Server-Logfile erfasst, die Ihr Browser übermittelt:

- IP-Adresse
- Datum und Uhrzeit der Anfrage
- aufgerufene Seite und übertragene Datenmenge
- Referrer-URL
- Browsertyp und Betriebssystem

Diese Daten sind technisch erforderlich, um die Website auszuliefern und ihre Stabilität und Sicherheit zu gewährleisten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und funktionsfähigen Angebot). Eine Zusammenführung dieser Daten mit anderen Datenquellen findet nicht statt.

**Schriftarten:** Die verwendeten Schriften (Manrope, Newsreader) werden beim Erstellen der Website lokal eingebunden und von unserem eigenen Server ausgeliefert. Beim Aufruf der Seite wird **keine Verbindung zu Google-Servern** aufgebaut und es wird keine IP-Adresse an Google übertragen.`,
    },
    {
      id: "mitgliedskonto",
      heading: "5. Nutzerkonto und Registrierung",
      body: `Für die Anlage eines Kontos verarbeiten wir Name, E-Mail-Adresse und ein von Ihnen gewähltes, ausschließlich als kryptografischer Hash gespeichertes Passwort. Optional können Sie Telefonnummer, Anschrift, Geburtsdatum, Beruf, ein Profilbild und einen Kurztext hinterlegen.

Zur Bestätigung Ihrer E-Mail-Adresse versenden wir einen einmaligen Bestätigungslink.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Durchführung des Nutzungsverhältnisses). Freiwillige Zusatzangaben beruhen auf Ihrer Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO und können jederzeit im Profil geändert oder gelöscht werden.`,
    },
    {
      id: "mitgliedschaft",
      heading: "6. Mitgliedschaft und Beiträge",
      body: `Für die Mitgliedschaft verarbeiten wir zusätzlich die gewählte Beitragsart, Beginn und Ende der Mitgliedschaft, den Zahlungsstatus sowie — je nach Tarif — Angaben zu Familienmitgliedern oder einen Studiennachweis.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Mitgliedschaftsverhältnis) sowie Art. 6 Abs. 1 lit. c DSGVO für die steuer- und handelsrechtlich vorgeschriebene Aufbewahrung von Zahlungsbelegen.`,
    },
    {
      id: "veranstaltungen",
      heading: "7. Veranstaltungsanmeldung und Tickets",
      body: `Bei der Anmeldung zu einer Veranstaltung verarbeiten wir Name, E-Mail-Adresse, optional die Telefonnummer sowie die Zahl der begleitenden Personen. Wir erzeugen daraus ein Ticket mit einer eindeutigen Ticketnummer und einem QR-Code und erfassen beim Einlass den Zeitpunkt des Check-ins.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Durchführung des Teilnahmevertrags).`,
    },
    {
      id: "zahlungen",
      heading: "8. Zahlungsabwicklung",
      body: `Online-Zahlungen wickeln wir über **Stripe Payments Europe, Ltd.**, Dublin, Irland ab.

Sie werden dazu auf eine von Stripe betriebene Bezahlseite weitergeleitet. Ihre Zahlungsdaten — insbesondere vollständige Kartennummern — werden ausschließlich von Stripe verarbeitet und gelangen **zu keinem Zeitpunkt in unsere Systeme**. Auf dieser Website ist kein Zahlungs-Skript von Stripe eingebunden; es werden hier folglich auch keine Stripe-Cookies gesetzt.

Wir erhalten von Stripe lediglich die Vorgangsnummer, den Betrag, die Währung und den Zahlungsstatus.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Aufbewahrungspflichten). Es gilt zusätzlich die Datenschutzerklärung von Stripe.`,
    },
    {
      id: "email",
      heading: "9. E-Mail-Versand",
      body: `Für Systemnachrichten (Bestätigungslinks, Tickets, Rechnungen, Passwort-Zurücksetzung) nutzen wir einen externen E-Mail-Dienstleister. Übermittelt werden dabei Ihre E-Mail-Adresse, Ihr Name und der Inhalt der jeweiligen Nachricht.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit die Nachricht der Vertragserfüllung dient, im Übrigen Art. 6 Abs. 1 lit. f DSGVO.`,
    },
    {
      id: "kontaktformular",
      heading: "10. Kontaktformular",
      body: `Wenn Sie uns über das Kontaktformular schreiben, verarbeiten wir Name, E-Mail-Adresse, Betreff und Nachrichtentext, um Ihre Anfrage zu beantworten. Zur Abwehr automatisierter Einsendungen setzen wir eine einfache, selbst betriebene Sicherheitsabfrage ein; externe Dienste wie reCAPTCHA kommen nicht zum Einsatz.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) bzw. Art. 6 Abs. 1 lit. b DSGVO, wenn Ihre Anfrage der Anbahnung eines Vertrags dient.`,
    },
    {
      id: "galerie",
      heading: "11. Fotogalerie und Bildrechte",
      body: `Wir veröffentlichen Fotos und Videos von Vereinsveranstaltungen. Die Medien werden bei **Cloudinary** gespeichert und von dort ausgeliefert.

Die Veröffentlichung von Bildnissen stützen wir auf Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 22 KUG) bzw. — bei Aufnahmen von Versammlungen und Aufzügen im Sinne des § 23 Abs. 1 Nr. 3 KUG — auf unser berechtigtes Interesse an der Dokumentation des Vereinslebens (Art. 6 Abs. 1 lit. f DSGVO).

**Sie können der Veröffentlichung jederzeit widersprechen.** Eine formlose Nachricht an {{site.email}} mit einem Hinweis auf das betreffende Bild genügt; wir entfernen es ohne Angabe von Gründen. Dies gilt ausdrücklich auch für Personen, die kein Konto bei uns haben.

Angemeldete Mitglieder können außerdem eigene Fotos zu Alben beitragen. Diese werden vor der Veröffentlichung durch den Vorstand geprüft.`,
    },
    {
      id: "gesichtserkennung",
      heading: "12. Gesichtserkennung (besondere Kategorie personenbezogener Daten)",
      body: `Die Galerie bietet eine Funktion an, mit der Sie Fotos finden können, auf denen Sie abgebildet sind.

Dabei werden aus Gesichtern auf Galeriebildern mathematische Merkmalsvektoren berechnet und gespeichert. Solche Vektoren sind **biometrische Daten zur eindeutigen Identifizierung einer natürlichen Person** und damit eine besondere Kategorie personenbezogener Daten im Sinne des Art. 9 Abs. 1 DSGVO.

**Rechtsgrundlage ist ausschließlich Ihre ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO.** Diese Einwilligung wird gesondert eingeholt und ist nicht Bestandteil der allgemeinen Zustimmung zu dieser Datenschutzerklärung.

Im Einzelnen:

- Das Referenzfoto, das Sie zur Suche hochladen oder aufnehmen, wird **ausschließlich in Ihrem Browser** verarbeitet und nicht an uns übertragen.
- Wenn Sie ein Gesichtsprofil in Ihrem Konto speichern, wird der daraus berechnete Merkmalsvektor bei uns gespeichert, bis Sie ihn löschen.
- Zu Galeriebildern gespeicherte Merkmalsvektoren werden gelöscht, wenn das jeweilige Bild gelöscht wird.
- Die für die Analyse benötigten Erkennungsmodelle werden beim Öffnen der Funktion von einem öffentlichen Code-Repository (GitHub, betrieben von der GitHub Inc., einem Unternehmen von Microsoft) nachgeladen. Dabei wird Ihre IP-Adresse technisch bedingt an diesen Anbieter übermittelt.

**Widerruf:** Sie können die Einwilligung jederzeit in Ihrem Profil unter „Datenschutz & Einwilligungen“ widerrufen. Der Widerruf löscht Ihr Gesichtsprofil unverzüglich und wirkt für die Zukunft; die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt.

Wenn Sie der biometrischen Verarbeitung von Bildern, auf denen Sie abgebildet sind, generell widersprechen möchten, schreiben Sie uns an {{site.email}}.`,
    },
    {
      id: "cookies",
      heading: "13. Cookies und lokale Speicherung",
      body: `Wir setzen nur solche Cookies ein, die für den Betrieb der Website erforderlich sind, sowie — nach Ihrer Einwilligung — Cookies für Komfortfunktionen.

Das Speichern von Informationen auf Ihrem Endgerät und der Zugriff darauf richten sich nach § 25 TDDDG. Für unbedingt erforderliche Cookies gilt die Ausnahme des § 25 Abs. 2 Nr. 2 TDDDG; alle übrigen setzen wir erst nach Ihrer Einwilligung.

Eine vollständige Aufstellung finden Sie in unserer [Cookie-Richtlinie]({{site.url}}/legal/cookies). Ihre Auswahl können Sie jederzeit über den Link „Cookie-Einstellungen“ im Seitenfuß ändern oder widerrufen.`,
    },
    {
      id: "empfaenger",
      heading: "14. Empfänger und Auftragsverarbeiter",
      body: `Wir geben Daten nur weiter, soweit dies zur Erbringung unserer Leistungen erforderlich ist. Mit allen Dienstleistern bestehen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO.

- **Cloudinary** — Speicherung und Auslieferung von Bildern und Videos
- **Stripe Payments Europe, Ltd.** — Zahlungsabwicklung
- **MongoDB Atlas** — Datenbankbetrieb
- **{{legal.hostingProvider}}** — Hosting der Anwendung
- E-Mail-Dienstleister — Versand von Systemnachrichten

Darüber hinaus geben wir Daten weiter, wenn wir gesetzlich dazu verpflichtet sind, etwa gegenüber Finanzbehörden.`,
    },
    {
      id: "drittland",
      heading: "15. Übermittlung in Drittländer",
      body: `Einzelne der genannten Dienstleister verarbeiten Daten auch in den USA.

Die Übermittlung erfolgt auf Grundlage des Angemessenheitsbeschlusses der Europäischen Kommission vom 10. Juli 2023 zum EU-US Data Privacy Framework, soweit der jeweilige Anbieter zertifiziert ist, und im Übrigen auf Grundlage der Standardvertragsklauseln der EU-Kommission gemäß Art. 46 Abs. 2 lit. c DSGVO.

Trotz dieser Garantien lässt sich nicht vollständig ausschließen, dass US-Behörden auf übermittelte Daten zugreifen.`,
    },
    {
      id: "speicherdauer",
      heading: "16. Speicherdauer",
      body: `Wir löschen personenbezogene Daten, sobald der Zweck entfällt und keine gesetzliche Aufbewahrungspflicht entgegensteht.

- **Kontodaten:** bis zur Löschung des Kontos
- **Veranstaltungsanmeldungen:** bis zu 24 Monate nach der Veranstaltung
- **Zahlungs- und Rechnungsbelege:** 10 Jahre gemäß § 147 AO und § 257 HGB
- **Einwilligungsnachweise:** für die Dauer der Nachweispflicht nach Art. 5 Abs. 2 DSGVO
- **Server-Logfiles:** in der Regel 30 Tage
- **Gesichtsprofile:** bis zum Widerruf der Einwilligung
- **Kontaktanfragen:** bis zu 12 Monate nach abschließender Bearbeitung

**Wichtig zum Löschungsrecht:** Zahlungs- und Rechnungsbelege unterliegen einer gesetzlichen Aufbewahrungsfrist, die dem Löschungsanspruch vorgeht. Wenn Sie die Löschung Ihres Kontos verlangen, anonymisieren wir daher Ihr Profil und Ihre Kontaktdaten und bewahren ausschließlich die steuerlich erforderlichen Belege für die Dauer der Frist auf. Diese Belege werden für keinen anderen Zweck mehr verwendet.`,
    },
    {
      id: "rechte",
      heading: "17. Ihre Rechte",
      body: `Sie haben jederzeit das Recht auf:

- **Auskunft** über die zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO)
- **Berichtigung** unrichtiger Daten (Art. 16 DSGVO)
- **Löschung** (Art. 17 DSGVO)
- **Einschränkung der Verarbeitung** (Art. 18 DSGVO)
- **Datenübertragbarkeit** in einem gängigen Format (Art. 20 DSGVO)
- **Widerspruch** gegen die Verarbeitung (Art. 21 DSGVO)
- **Widerruf erteilter Einwilligungen** mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)

Angemeldete Mitglieder können Auskunft, Datenexport, Widerruf von Einwilligungen und Löschungsantrag unmittelbar im Profil unter „Datenschutz & Einwilligungen“ ausüben. Alle übrigen Anliegen richten Sie bitte an {{site.email}}.

Der Widerruf einer Einwilligung ist genauso einfach wie ihre Erteilung.`,
    },
    {
      id: "widerspruch",
      heading: "18. Widerspruchsrecht nach Art. 21 DSGVO",
      body: `Soweit wir Daten auf Grundlage berechtigter Interessen nach Art. 6 Abs. 1 lit. f DSGVO verarbeiten, haben Sie das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit Widerspruch einzulegen.

Wir verarbeiten die betroffenen Daten dann nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe nachweisen, die Ihre Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.`,
    },
    {
      id: "beschwerde",
      heading: "19. Beschwerderecht bei der Aufsichtsbehörde",
      body: `Unbeschadet anderweitiger Rechtsbehelfe steht Ihnen ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde zu, insbesondere in dem Mitgliedstaat Ihres Aufenthaltsorts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes.

Die für uns zuständige Aufsichtsbehörde ist:

{{legal.supervisoryAuthority}}`,
    },
    {
      id: "automatisiert",
      heading: "20. Keine automatisierte Entscheidungsfindung",
      body: `Eine automatisierte Entscheidungsfindung einschließlich Profiling mit rechtlicher Wirkung Ihnen gegenüber im Sinne des Art. 22 DSGVO findet nicht statt.

Die Gesichtssuche in der Galerie ist ein von Ihnen selbst ausgelöster Suchvorgang. Sie führt zu keiner Entscheidung über Sie, sondern zeigt Ihnen lediglich Bilder an.`,
    },
    {
      id: "sicherheit",
      heading: "21. Datensicherheit",
      body: `Die Übertragung erfolgt durchgängig verschlüsselt über TLS. Passwörter werden ausschließlich als Hash gespeichert. Der Zugriff auf Verwaltungsfunktionen ist auf Vorstandsmitglieder mit eigenem Zugang beschränkt.`,
    },
    {
      id: "aenderungen",
      heading: "22. Änderungen dieser Datenschutzerklärung",
      body: `Wir passen diese Erklärung an, wenn sich unsere Verarbeitung oder die Rechtslage ändert. Die jeweils gültige Fassung ist mit einer Versionsnummer und einem Stand gekennzeichnet.

**Bei wesentlichen Änderungen bitten wir angemeldete Mitglieder bei ihrem nächsten Besuch erneut um Zustimmung** und stellen dabei dar, was sich geändert hat.`,
    },
  ],
};

const privacyEn: LegalContent = {
  title: "Privacy Policy",
  lead: "How we process personal data, on what legal basis, and what rights you have.",
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Controller",
      body: `The controller within the meaning of Art. 4 (7) GDPR is:

**{{legal.entityName}}**
{{legal.street}}
{{legal.postalCode}} {{legal.city}}
{{legal.country}}

Email: {{site.email}}
Represented by: {{legal.boardMembers}}`,
    },
    {
      id: "datenschutzbeauftragter",
      heading: "2. Data protection officer",
      body: `{{legal.dpoName}}
{{legal.dpoEmail}}

If no person is named here, the association has not appointed a data protection officer. In that case please contact us on data protection matters directly at {{site.email}}.`,
    },
    {
      id: "grundsaetze",
      heading: "3. Principles",
      body: `We are a volunteer-run cultural association, not a commercial provider. We process personal data only to the extent necessary to run the association.

- We do not sell data and do not pass it on for advertising purposes.
- We use no tracking, no ad networks and no profiling.
- We collect only the data required for the purpose at hand.`,
    },
    {
      id: "hosting",
      heading: "4. Hosting and server log files",
      body: `This website is hosted with {{legal.hostingProvider}}. The database runs on MongoDB Atlas.

When you access the site, information transmitted by your browser is automatically recorded in a server log file:

- IP address
- date and time of the request
- page requested and volume of data transferred
- referrer URL
- browser type and operating system

This data is technically necessary to deliver the website and to ensure its stability and security. The legal basis is Art. 6 (1) (f) GDPR (legitimate interest in a secure, functioning service). This data is not combined with other sources.

**Fonts:** the typefaces used (Manrope, Newsreader) are bundled at build time and served from our own server. **No connection to Google servers** is made when you load a page, and no IP address is transmitted to Google.`,
    },
    {
      id: "mitgliedskonto",
      heading: "5. User account and registration",
      body: `To create an account we process your name, email address and a password you choose, which is stored solely as a cryptographic hash. You may optionally add a telephone number, address, date of birth, occupation, profile picture and a short biography.

We send a one-time confirmation link to verify your email address.

The legal basis is Art. 6 (1) (b) GDPR (performance of the user relationship). Optional additional details rest on your consent under Art. 6 (1) (a) GDPR and can be changed or deleted in your profile at any time.`,
    },
    {
      id: "mitgliedschaft",
      heading: "6. Membership and fees",
      body: `For membership we additionally process the plan chosen, the start and end of membership, payment status and — depending on the plan — details of family members or proof of student status.

The legal basis is Art. 6 (1) (b) GDPR (membership relationship) and Art. 6 (1) (c) GDPR for the retention of payment records required by tax and commercial law.`,
    },
    {
      id: "veranstaltungen",
      heading: "7. Event registration and tickets",
      body: `When you register for an event we process your name, email address, optionally your telephone number, and the number of accompanying guests. We generate a ticket with a unique ticket number and QR code, and record the time of check-in at the door.

The legal basis is Art. 6 (1) (b) GDPR (performance of the attendance contract).`,
    },
    {
      id: "zahlungen",
      heading: "8. Payment processing",
      body: `Online payments are handled by **Stripe Payments Europe, Ltd.**, Dublin, Ireland.

You are redirected to a payment page operated by Stripe. Your payment details — in particular full card numbers — are processed exclusively by Stripe and **never reach our systems**. No Stripe payment script is embedded on this website, so no Stripe cookies are set here either.

From Stripe we receive only the transaction reference, amount, currency and payment status.

The legal basis is Art. 6 (1) (b) GDPR (performance of a contract) and Art. 6 (1) (c) GDPR (statutory retention). Stripe's own privacy policy applies in addition.`,
    },
    {
      id: "email",
      heading: "9. Email delivery",
      body: `For system messages (confirmation links, tickets, invoices, password resets) we use an external email service provider. Your email address, name and the content of the message are transmitted.

The legal basis is Art. 6 (1) (b) GDPR where the message serves to perform a contract, and otherwise Art. 6 (1) (f) GDPR.`,
    },
    {
      id: "kontaktformular",
      heading: "10. Contact form",
      body: `If you write to us via the contact form we process your name, email address, subject and message in order to answer your enquiry. To deter automated submissions we use a simple, self-hosted security check; external services such as reCAPTCHA are not used.

The legal basis is Art. 6 (1) (a) GDPR (consent), or Art. 6 (1) (b) GDPR where your enquiry relates to entering into a contract.`,
    },
    {
      id: "galerie",
      heading: "11. Photo gallery and image rights",
      body: `We publish photos and videos of association events. Media is stored on and delivered from **Cloudinary**.

Publication of a person's likeness rests on your consent (Art. 6 (1) (a) GDPR, § 22 KUG) or — for images of gatherings within the meaning of § 23 (1) no. 3 KUG — on our legitimate interest in documenting the life of the association (Art. 6 (1) (f) GDPR).

**You may object to publication at any time.** An informal message to {{site.email}} identifying the image is sufficient; we will remove it without requiring a reason. This expressly applies to people who do not hold an account with us.

Signed-in members may also contribute their own photos to albums. These are reviewed by the board before publication.`,
    },
    {
      id: "gesichtserkennung",
      heading: "12. Face recognition (special category of personal data)",
      body: `The gallery offers a feature that lets you find photos you appear in.

To do so, mathematical feature vectors are computed from faces in gallery images and stored. Such vectors are **biometric data for the purpose of uniquely identifying a natural person**, and therefore a special category of personal data within the meaning of Art. 9 (1) GDPR.

**The legal basis is exclusively your explicit consent under Art. 9 (2) (a) GDPR.** This consent is obtained separately and is not part of general agreement to this privacy policy.

In detail:

- The reference photo you upload or take for a search is processed **entirely in your browser** and is not transmitted to us.
- If you save a face profile to your account, the resulting feature vector is stored with us until you delete it.
- Feature vectors stored for gallery images are deleted when the image itself is deleted.
- The recognition models needed for the analysis are fetched from a public code repository (GitHub, operated by GitHub Inc., a Microsoft company) when you open the feature. This necessarily transmits your IP address to that provider.

**Withdrawal:** you can withdraw this consent at any time in your profile under "Privacy & consent". Withdrawal deletes your face profile immediately and takes effect for the future; the lawfulness of processing carried out beforehand is unaffected.

If you wish to object generally to biometric processing of images you appear in, please write to {{site.email}}.`,
    },
    {
      id: "cookies",
      heading: "13. Cookies and local storage",
      body: `We use only those cookies necessary to operate the website, plus — with your consent — cookies for convenience features.

Storing information on and accessing information from your device is governed by § 25 TDDDG. Strictly necessary cookies fall under the exemption in § 25 (2) no. 2 TDDDG; everything else is set only after you consent.

A full list is available in our [Cookie Policy]({{site.url}}/legal/cookies). You can change or withdraw your choice at any time via the "Cookie settings" link in the footer.`,
    },
    {
      id: "empfaenger",
      heading: "14. Recipients and processors",
      body: `We share data only where necessary to provide our services. Data processing agreements under Art. 28 GDPR are in place with all providers.

- **Cloudinary** — storage and delivery of images and video
- **Stripe Payments Europe, Ltd.** — payment processing
- **MongoDB Atlas** — database operation
- **{{legal.hostingProvider}}** — application hosting
- Email service provider — delivery of system messages

Beyond this we disclose data where we are legally obliged to do so, for example to tax authorities.`,
    },
    {
      id: "drittland",
      heading: "15. Transfers to third countries",
      body: `Some of the providers named above also process data in the United States.

Transfers take place on the basis of the European Commission's adequacy decision of 10 July 2023 concerning the EU-US Data Privacy Framework, where the provider concerned is certified, and otherwise on the basis of the Commission's Standard Contractual Clauses pursuant to Art. 46 (2) (c) GDPR.

Despite these safeguards, access to transferred data by US authorities cannot be entirely ruled out.`,
    },
    {
      id: "speicherdauer",
      heading: "16. Retention periods",
      body: `We delete personal data once its purpose has ceased and no statutory retention obligation applies.

- **Account data:** until the account is deleted
- **Event registrations:** up to 24 months after the event
- **Payment and invoice records:** 10 years pursuant to § 147 AO and § 257 HGB
- **Consent records:** for as long as the accountability obligation under Art. 5 (2) GDPR applies
- **Server log files:** generally 30 days
- **Face profiles:** until consent is withdrawn
- **Contact enquiries:** up to 12 months after the matter is closed

**Important note on erasure:** payment and invoice records are subject to a statutory retention period that overrides the right to erasure. If you request deletion of your account we therefore anonymise your profile and contact details and retain only the records required for tax purposes for the duration of that period. Those records are not used for any other purpose.`,
    },
    {
      id: "rechte",
      heading: "17. Your rights",
      body: `You have the right at any time to:

- **Access** the data held about you (Art. 15 GDPR)
- **Rectification** of inaccurate data (Art. 16 GDPR)
- **Erasure** (Art. 17 GDPR)
- **Restriction of processing** (Art. 18 GDPR)
- **Data portability** in a common format (Art. 20 GDPR)
- **Object** to processing (Art. 21 GDPR)
- **Withdraw consent** with effect for the future (Art. 7 (3) GDPR)

Signed-in members can exercise access, data export, withdrawal of consent and a deletion request directly in their profile under "Privacy & consent". For anything else please write to {{site.email}}.

Withdrawing consent is as easy as giving it.`,
    },
    {
      id: "widerspruch",
      heading: "18. Right to object under Art. 21 GDPR",
      body: `Where we process data on the basis of legitimate interests under Art. 6 (1) (f) GDPR, you have the right to object at any time on grounds relating to your particular situation.

We will then no longer process the data concerned unless we can demonstrate compelling legitimate grounds that override your interests, rights and freedoms, or the processing serves to establish, exercise or defend legal claims.`,
    },
    {
      id: "beschwerde",
      heading: "19. Right to lodge a complaint",
      body: `Without prejudice to any other remedy, you have the right to lodge a complaint with a data protection supervisory authority, in particular in the Member State of your residence, place of work or the place of the alleged infringement.

The authority competent for us is:

{{legal.supervisoryAuthority}}`,
    },
    {
      id: "automatisiert",
      heading: "20. No automated decision-making",
      body: `No automated decision-making, including profiling, producing legal effects concerning you within the meaning of Art. 22 GDPR takes place.

The gallery face search is a search you initiate yourself. It produces no decision about you; it simply shows you images.`,
    },
    {
      id: "sicherheit",
      heading: "21. Data security",
      body: `All transmission is encrypted end to end via TLS. Passwords are stored only as hashes. Access to administrative functions is restricted to board members with individual credentials.`,
    },
    {
      id: "aenderungen",
      heading: "22. Changes to this privacy policy",
      body: `We update this policy when our processing or the legal position changes. The version in force is marked with a version number and a date.

**Where changes are material we ask signed-in members to agree again on their next visit**, and set out what has changed.`,
    },
  ],
};

// =========================================================================
// 3. Nutzungsbedingungen
// =========================================================================

const termsDe: LegalContent = {
  title: "Nutzungsbedingungen",
  lead: "Die Regeln für die Nutzung dieser Website, der Mitgliedschaft und der Galerie.",
  sections: [
    {
      id: "geltungsbereich",
      heading: "1. Geltungsbereich",
      body: `Diese Nutzungsbedingungen gelten für die Nutzung der Website {{site.url}} sowie aller darüber angebotenen Leistungen des {{legal.entityName}}.

Mit der Registrierung eines Kontos, der Anmeldung zu einer Veranstaltung oder dem Abschluss einer Mitgliedschaft erkennen Sie diese Bedingungen an.`,
    },
    {
      id: "verein",
      heading: "2. Über den Verein",
      body: `{{legal.entityName}} ist ein ehrenamtlich geführter, im Vereinsregister eingetragener Kulturverein mit Sitz in {{legal.city}}. Zweck des Vereins ist die Pflege der keralesischen Kultur und die Förderung des Zusammenhalts der malayalischen Gemeinschaft in und um Augsburg.

Maßgeblich für die Mitgliedschaft im Verein im vereinsrechtlichen Sinne ist die Satzung. Diese Nutzungsbedingungen regeln ausschließlich die Nutzung dieser Website.`,
    },
    {
      id: "konto",
      heading: "3. Nutzerkonto",
      body: `Für bestimmte Funktionen ist ein Konto erforderlich. Dabei gilt:

- Ihre Angaben müssen zutreffend und aktuell sein.
- Zugangsdaten sind vertraulich zu behandeln und nicht weiterzugeben.
- Pro Person ist ein Konto zulässig.
- Ein Anspruch auf Anlage eines Kontos besteht nicht.

Bei Verstößen gegen diese Bedingungen können wir ein Konto vorübergehend sperren oder löschen. Vor einer Sperrung informieren wir Sie, sofern dies nicht aus Sicherheitsgründen unmöglich ist.`,
    },
    {
      id: "mitgliedschaft",
      heading: "4. Mitgliedschaft und Beiträge",
      body: `Mitgliedschaften werden für die jeweils angegebene Laufzeit abgeschlossen. Die Höhe des Beitrags, der Leistungsumfang und die Laufzeit ergeben sich aus der Beschreibung des jeweiligen Tarifs zum Zeitpunkt des Abschlusses.

Der Vertrag kommt zustande, wenn wir Ihre Anmeldung bestätigen. Bei Barzahlung oder Überweisung wird die Mitgliedschaft erst nach Bestätigung des Zahlungseingangs durch den Vorstand aktiv.

Verbrauchern steht ein gesetzliches Widerrufsrecht zu; Einzelheiten finden Sie in unserer [Widerrufsbelehrung]({{site.url}}/legal/withdrawal).`,
    },
    {
      id: "veranstaltungen",
      heading: "5. Veranstaltungen und Tickets",
      body: `Mit der Anmeldung zu einer Veranstaltung erwerben Sie einen Anspruch auf Teilnahme für die angegebene Personenzahl. Tickets enthalten eine eindeutige Nummer und sind nicht zur Weitergabe an Dritte bestimmt.

Wir behalten uns vor, eine Veranstaltung abzusagen oder zu verlegen. In diesem Fall erstatten wir bereits gezahlte Entgelte vollständig. Weitergehende Ansprüche bestehen nur bei Vorsatz oder grober Fahrlässigkeit.

Für Veranstaltungen, die für einen bestimmten Termin vorgesehen sind, besteht nach § 312g Abs. 2 Nr. 9 BGB **kein** Widerrufsrecht.`,
    },
    {
      id: "preise",
      heading: "6. Preise und Zahlung",
      body: `Alle Preise verstehen sich in Euro und als Endpreise. Als gemeinnütziger Verein weisen wir keine Umsatzsteuer gesondert aus, soweit keine Umsatzsteuerpflicht besteht.

Zahlungen sind per Karte über unseren Zahlungsdienstleister Stripe, per Überweisung oder — wo angeboten — in bar möglich. Vor Abschluss eines zahlungspflichtigen Vorgangs zeigen wir Ihnen den Gesamtbetrag deutlich an; die Bestellung wird ausdrücklich über eine als zahlungspflichtig gekennzeichnete Schaltfläche ausgelöst.`,
    },
    {
      id: "inhalte",
      heading: "7. Von Nutzern eingestellte Inhalte",
      body: `Mitglieder können Fotos und Videos zu Alben beitragen. Mit dem Hochladen versichern Sie, dass

- Sie die erforderlichen Rechte an dem Material besitzen,
- abgebildete Personen mit der Veröffentlichung einverstanden sind, und
- das Material keine Rechte Dritter verletzt.

Sie räumen uns ein einfaches, räumlich unbeschränktes und unentgeltliches Recht ein, das Material auf dieser Website und in den Kanälen des Vereins zu veröffentlichen. Sie bleiben Inhaber Ihrer Rechte und können die Entfernung jederzeit verlangen.

Beiträge werden vor der Veröffentlichung durch den Vorstand geprüft. Wir können Inhalte ohne Angabe von Gründen ablehnen oder entfernen.`,
    },
    {
      id: "verhalten",
      heading: "8. Verhaltensregeln",
      body: `Untersagt sind insbesondere:

- rechtswidrige, beleidigende, diskriminierende oder belästigende Inhalte
- das Hochladen von Bildern Dritter ohne deren Einverständnis
- Versuche, unbefugt auf Konten oder Verwaltungsfunktionen zuzugreifen
- automatisiertes Auslesen der Website sowie Maßnahmen, die den Betrieb beeinträchtigen
- kommerzielle Werbung ohne vorherige Absprache`,
    },
    {
      id: "verfuegbarkeit",
      heading: "9. Verfügbarkeit",
      body: `Die Website wird ehrenamtlich betrieben. Wir bemühen uns um einen durchgängigen Betrieb, schulden jedoch keine bestimmte Verfügbarkeit. Wartungsarbeiten und Störungen können zu vorübergehenden Unterbrechungen führen.`,
    },
    {
      id: "haftung",
      heading: "10. Haftung",
      body: `Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.

Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung einer wesentlichen Vertragspflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung Sie regelmäßig vertrauen dürfen; in diesem Fall ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt.

Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt.`,
    },
    {
      id: "kuendigung",
      heading: "11. Laufzeit und Beendigung",
      body: `Sie können Ihr Nutzerkonto jederzeit löschen lassen. Eine laufende Mitgliedschaft endet zum Ende der vereinbarten Laufzeit; sie kann über das Profil oder durch Nachricht an {{site.email}} gekündigt werden.

Zur Löschung von Konten beachten Sie bitte den Abschnitt zur Speicherdauer in unserer [Datenschutzerklärung]({{site.url}}/legal/privacy): gesetzliche Aufbewahrungspflichten für Zahlungsbelege bleiben bestehen.`,
    },
    {
      id: "aenderungen",
      heading: "12. Änderungen dieser Bedingungen",
      body: `Wir können diese Bedingungen anpassen, wenn dies aufgrund geänderter Rechtslage, geänderter Rechtsprechung oder einer Änderung unseres Angebots erforderlich wird.

**Bei wesentlichen Änderungen bitten wir Sie bei Ihrem nächsten Besuch erneut um Zustimmung** und weisen dabei darauf hin, was sich geändert hat. Wenn Sie nicht zustimmen möchten, können Sie Ihr Konto löschen lassen.`,
    },
    {
      id: "recht",
      heading: "13. Anwendbares Recht",
      body: `Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.

Sind Sie Verbraucher, gilt diese Rechtswahl nur, soweit dadurch der Schutz nicht entzogen wird, der Ihnen durch zwingende Bestimmungen des Rechts Ihres gewöhnlichen Aufenthaltsstaats gewährt wird. Für Verbraucher bleibt der gesetzliche Gerichtsstand unberührt.`,
    },
  ],
};

const termsEn: LegalContent = {
  title: "Terms of Use",
  lead: "The rules for using this website, membership and the gallery.",
  sections: [
    {
      id: "geltungsbereich",
      heading: "1. Scope",
      body: `These terms govern use of the website {{site.url}} and all services offered through it by {{legal.entityName}}.

By registering an account, signing up for an event or taking out a membership you accept these terms.`,
    },
    {
      id: "verein",
      heading: "2. About the association",
      body: `{{legal.entityName}} is a volunteer-run cultural association registered in the German register of associations, based in {{legal.city}}. Its purpose is to nurture Keralan culture and foster the Malayali community in and around Augsburg.

Membership of the association in the legal sense is governed by its statutes (Satzung). These terms govern only the use of this website.`,
    },
    {
      id: "konto",
      heading: "3. User account",
      body: `Some features require an account. The following applies:

- Your details must be accurate and kept up to date.
- Credentials are confidential and must not be shared.
- One account per person.
- There is no entitlement to the creation of an account.

We may temporarily suspend or delete an account for breach of these terms. We will notify you before any suspension unless security reasons make that impossible.`,
    },
    {
      id: "mitgliedschaft",
      heading: "4. Membership and fees",
      body: `Memberships run for the stated term. The fee, the benefits included and the term follow from the description of the plan at the time you sign up.

The contract is formed when we confirm your application. Where payment is by cash or bank transfer, membership becomes active only once the board confirms receipt.

Consumers have a statutory right of withdrawal; see our [Right of Withdrawal]({{site.url}}/legal/withdrawal) for details.`,
    },
    {
      id: "veranstaltungen",
      heading: "5. Events and tickets",
      body: `Registering for an event entitles you to attend for the number of people stated. Tickets carry a unique number and are not intended for transfer to third parties.

We reserve the right to cancel or reschedule an event. In that case we refund any fees already paid in full. Further claims exist only in cases of intent or gross negligence.

For events scheduled for a specific date there is **no** right of withdrawal, pursuant to § 312g (2) no. 9 BGB.`,
    },
    {
      id: "preise",
      heading: "6. Prices and payment",
      body: `All prices are in euros and are final prices. As a non-profit association we do not show VAT separately where no VAT liability arises.

Payment is possible by card via our payment provider Stripe, by bank transfer, or — where offered — in cash. Before any payable step we show the total amount clearly, and the order is placed via a button expressly marked as carrying an obligation to pay.`,
    },
    {
      id: "inhalte",
      heading: "7. User-contributed content",
      body: `Members may contribute photos and videos to albums. By uploading you confirm that

- you hold the necessary rights to the material,
- the people shown agree to publication, and
- the material infringes no third-party rights.

You grant us a non-exclusive, territorially unrestricted, royalty-free right to publish the material on this website and in the association's channels. You retain ownership of your rights and may request removal at any time.

Contributions are reviewed by the board before publication. We may decline or remove content without giving reasons.`,
    },
    {
      id: "verhalten",
      heading: "8. Rules of conduct",
      body: `The following are prohibited in particular:

- unlawful, abusive, discriminatory or harassing content
- uploading images of other people without their agreement
- attempting to gain unauthorised access to accounts or administrative functions
- automated scraping of the site, and any action that impairs its operation
- commercial advertising without prior agreement`,
    },
    {
      id: "verfuegbarkeit",
      heading: "9. Availability",
      body: `The website is run by volunteers. We aim for continuous operation but do not owe any particular level of availability. Maintenance and faults may cause temporary interruptions.`,
    },
    {
      id: "haftung",
      heading: "10. Liability",
      body: `We are liable without limitation for intent and gross negligence, and for damage arising from injury to life, body or health.

In cases of ordinary negligence we are liable only for breach of a material contractual obligation — one whose fulfilment makes proper performance of the contract possible in the first place and on whose observance you may regularly rely — and in that case liability is limited to the foreseeable damage typical of the contract.

Liability under the German Product Liability Act remains unaffected.`,
    },
    {
      id: "kuendigung",
      heading: "11. Term and termination",
      body: `You may have your user account deleted at any time. A running membership ends at the end of the agreed term; it can be cancelled via your profile or by message to {{site.email}}.

Regarding account deletion, please note the retention section of our [Privacy Policy]({{site.url}}/legal/privacy): statutory retention obligations for payment records continue to apply.`,
    },
    {
      id: "aenderungen",
      heading: "12. Changes to these terms",
      body: `We may amend these terms where required by a change in the law, in case law, or in our offering.

**Where changes are material we ask you to agree again on your next visit**, indicating what has changed. If you do not wish to agree, you may have your account deleted.`,
    },
    {
      id: "recht",
      heading: "13. Governing law",
      body: `The law of the Federal Republic of Germany applies, excluding the UN Convention on Contracts for the International Sale of Goods.

If you are a consumer, this choice of law applies only in so far as it does not deprive you of the protection afforded by mandatory provisions of the law of your country of habitual residence. For consumers the statutory place of jurisdiction remains unaffected.`,
    },
  ],
};

// =========================================================================
// 4. Widerrufsbelehrung  —  § 312g BGB, Art. 246a EGBGB
// =========================================================================

const withdrawalDe: LegalContent = {
  title: "Widerrufsbelehrung",
  lead: "Ihr gesetzliches Widerrufsrecht als Verbraucher, und wie Sie es ausüben.",
  sections: [
    {
      id: "widerrufsrecht",
      heading: "Widerrufsrecht",
      body: `Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.

Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.

Um Ihr Widerrufsrecht auszuüben, müssen Sie uns

**{{legal.entityName}}**
{{legal.street}}
{{legal.postalCode}} {{legal.city}}
{{legal.country}}
E-Mail: {{site.email}}

mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.

Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.`,
    },
    {
      id: "folgen",
      heading: "Folgen des Widerrufs",
      body: `Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist.

Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.

Haben Sie verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.`,
    },
    {
      id: "ausnahmen",
      heading: "Ausnahmen vom Widerrufsrecht",
      body: `Das Widerrufsrecht besteht nach § 312g Abs. 2 BGB unter anderem **nicht** bei Verträgen

- zur Erbringung von Dienstleistungen im Zusammenhang mit Freizeitbetätigungen, wenn der Vertrag für die Erbringung einen spezifischen Termin oder Zeitraum vorsieht (§ 312g Abs. 2 Nr. 9 BGB).

**Das betrifft insbesondere Anmeldungen zu unseren Veranstaltungen**, da diese jeweils für einen bestimmten Termin vorgesehen sind. Für Veranstaltungstickets besteht daher kein gesetzliches Widerrufsrecht.

Für **Mitgliedschaften** besteht das Widerrufsrecht dagegen uneingeschränkt.

Unabhängig von der Rechtslage bemühen wir uns bei Verhinderung um eine kulanzweise Lösung. Schreiben Sie uns dazu an {{site.email}}.`,
    },
    {
      id: "muster",
      heading: "Muster-Widerrufsformular",
      body: `(Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und senden Sie es zurück.)

An
**{{legal.entityName}}**
{{legal.street}}
{{legal.postalCode}} {{legal.city}}
E-Mail: {{site.email}}

Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*)

— Bestellt am (*) / erhalten am (*)
— Name des/der Verbraucher(s)
— Anschrift des/der Verbraucher(s)
— Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)
— Datum

(*) Unzutreffendes streichen.`,
    },
  ],
};

const withdrawalEn: LegalContent = {
  title: "Right of Withdrawal",
  lead: "Your statutory right of withdrawal as a consumer, and how to exercise it.",
  sections: [
    {
      id: "widerrufsrecht",
      heading: "Right of withdrawal",
      body: `You have the right to withdraw from this contract within fourteen days without giving any reason.

The withdrawal period is fourteen days from the day the contract is concluded.

To exercise your right of withdrawal you must inform us

**{{legal.entityName}}**
{{legal.street}}
{{legal.postalCode}} {{legal.city}}
{{legal.country}}
Email: {{site.email}}

by means of a clear statement (for example a letter sent by post or an email) of your decision to withdraw from this contract. You may use the model withdrawal form below, though it is not obligatory.

To meet the withdrawal deadline it is sufficient for you to send your communication concerning the exercise of the right of withdrawal before the withdrawal period has expired.

*This is a translation for convenience. The German version is the legally binding text.*`,
    },
    {
      id: "folgen",
      heading: "Effects of withdrawal",
      body: `If you withdraw from this contract, we shall reimburse to you all payments received from you, including the costs of delivery (with the exception of the supplementary costs resulting from your choice of a type of delivery other than the least expensive type of standard delivery offered by us), without undue delay and in any event not later than fourteen days from the day on which we are informed about your decision to withdraw from this contract.

We will carry out such reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of such reimbursement.

If you requested that the provision of services begin during the withdrawal period, you shall pay us an amount which is in proportion to what has been provided until you have communicated to us your withdrawal from this contract, in comparison with the full coverage of the contract.`,
    },
    {
      id: "ausnahmen",
      heading: "Exceptions to the right of withdrawal",
      body: `Pursuant to § 312g (2) BGB the right of withdrawal does **not** apply, among others, to contracts

- for the provision of services related to leisure activities where the contract provides for a specific date or period of performance (§ 312g (2) no. 9 BGB).

**This applies in particular to registrations for our events**, since each is scheduled for a specific date. There is therefore no statutory right of withdrawal for event tickets.

For **memberships**, by contrast, the right of withdrawal applies in full.

Regardless of the legal position, we try to find a goodwill solution if you are prevented from attending. Please write to {{site.email}}.`,
    },
    {
      id: "muster",
      heading: "Model withdrawal form",
      body: `(Complete and return this form only if you wish to withdraw from the contract.)

To
**{{legal.entityName}}**
{{legal.street}}
{{legal.postalCode}} {{legal.city}}
Email: {{site.email}}

I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods (*) / for the provision of the following service (*)

— Ordered on (*) / received on (*)
— Name of consumer(s)
— Address of consumer(s)
— Signature of consumer(s) (only if this form is notified on paper)
— Date

(*) Delete as appropriate.`,
    },
  ],
};

// =========================================================================
// 5. Cookie-Richtlinie  —  § 25 TDDDG
// =========================================================================

const cookiesDe: LegalContent = {
  title: "Cookie-Richtlinie",
  lead: "Jedes Cookie, das diese Website setzt — und wofür.",
  sections: [
    {
      id: "was",
      heading: "Was Cookies sind",
      body: `Cookies sind kleine Textdateien, die eine Website auf Ihrem Gerät ablegt. Sie ermöglichen es unter anderem, Sie zwischen zwei Seitenaufrufen wiederzuerkennen — zum Beispiel, damit Sie nach der Anmeldung angemeldet bleiben.`,
    },
    {
      id: "rechtsgrundlage",
      heading: "Rechtsgrundlage",
      body: `Das Speichern von Informationen auf Ihrem Endgerät und der Zugriff darauf richten sich nach § 25 TDDDG.

Für unbedingt erforderliche Cookies gilt die Ausnahme des § 25 Abs. 2 Nr. 2 TDDDG — sie werden ohne Einwilligung gesetzt, weil die Website ohne sie nicht funktioniert. Alle übrigen Cookies setzen wir erst, nachdem Sie eingewilligt haben. Die anschließende Verarbeitung stützt sich auf Art. 6 Abs. 1 lit. a DSGVO.`,
    },
    {
      id: "kein-tracking",
      heading: "Kein Tracking, keine Werbung",
      body: `Wir möchten das ausdrücklich festhalten:

- Wir setzen **keine** Analyse- oder Statistikdienste ein (kein Google Analytics, kein Matomo, keine Pixel).
- Wir setzen **keine** Werbe- oder Retargeting-Netzwerke ein.
- Es findet **keine** geräteübergreifende Verfolgung und keine Profilbildung statt.
- Auf dieser Website ist **kein** Zahlungs-Skript eingebunden; bei einer Zahlung werden Sie auf die Seiten von Stripe weitergeleitet, wo deren eigene Bestimmungen gelten.
- Schriftarten werden lokal ausgeliefert, es besteht keine Verbindung zu Google Fonts.

Die Auswahl „Nur notwendige" ist daher eine vollwertige Option: Die Website funktioniert damit uneingeschränkt.`,
    },
    {
      id: "notwendig",
      heading: "Notwendige Cookies",
      body: `Diese Cookies sind für den Betrieb erforderlich und können nicht abgewählt werden.

- **ksa-public.session-token** — hält Ihre Anmeldung aufrecht. Laufzeit: Sitzung bzw. bis zum Abmelden.
- **ksa-public.csrf-token** — schützt Formulare vor Angriffen durch Dritte (CSRF). Laufzeit: Sitzung.
- **ksa-public.callback-url** — merkt sich die Seite, zu der nach der Anmeldung zurückgekehrt wird. Laufzeit: Sitzung.
- **ksa-admin.session-token**, **ksa-admin.csrf-token**, **ksa-admin.callback-url** — dieselben Funktionen für den Verwaltungsbereich. Nur für Vorstandsmitglieder.
- **ksa_consent** — speichert genau diese Cookie-Auswahl, damit wir Sie nicht bei jedem Besuch erneut fragen. Laufzeit: 12 Monate.

Sämtliche dieser Cookies werden von uns selbst gesetzt (First-Party) und enthalten keine Werbekennungen.`,
    },
    {
      id: "funktional",
      heading: "Funktionale Cookies (einwilligungspflichtig)",
      body: `Diese Cookies speichern Einstellungen, die den Gebrauch bequemer machen — etwa eine bevorzugte Sprachauswahl auf den Rechtsseiten oder ein eingeklapptes Menü.

Sie sind für den Betrieb nicht erforderlich und werden nur nach Ihrer Einwilligung gesetzt.`,
    },
    {
      id: "medien",
      heading: "Medieninhalte (einwilligungspflichtig)",
      body: `Bilder und Videos der Galerie werden über **Cloudinary** ausgeliefert. Beim Abruf eines Mediums wird Ihre IP-Adresse technisch bedingt an Cloudinary übermittelt; der Anbieter kann dabei Informationen auf Ihrem Gerät speichern.

Wenn Sie diese Kategorie ablehnen, funktioniert die Website weiterhin; Galerieinhalte werden dann erst nach ausdrücklicher Bestätigung geladen.`,
    },
    {
      id: "verwalten",
      heading: "Einwilligung ändern oder widerrufen",
      body: `Ihre Auswahl können Sie jederzeit über den Link **„Cookie-Einstellungen"** im Seitenfuß aufrufen und ändern.

Der Widerruf ist damit genauso einfach wie die Erteilung. Er wirkt für die Zukunft; die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt.`,
    },
    {
      id: "browser",
      heading: "Cookies im Browser löschen",
      body: `Unabhängig von unserer Auswahl können Sie Cookies in den Einstellungen Ihres Browsers jederzeit ansehen, einzeln oder vollständig löschen und ihr künftiges Setzen einschränken. Werden alle Cookies gelöscht, müssen Sie sich erneut anmelden und die Cookie-Auswahl erneut treffen.`,
    },
  ],
};

const cookiesEn: LegalContent = {
  title: "Cookie Policy",
  lead: "Every cookie this website sets — and what it is for.",
  sections: [
    {
      id: "was",
      heading: "What cookies are",
      body: `Cookies are small text files a website stores on your device. Among other things they allow you to be recognised between page loads — for example so that you stay signed in after logging in.`,
    },
    {
      id: "rechtsgrundlage",
      heading: "Legal basis",
      body: `Storing information on, and accessing information from, your device is governed by § 25 TDDDG.

Strictly necessary cookies fall under the exemption in § 25 (2) no. 2 TDDDG — they are set without consent because the website does not work without them. All other cookies are set only after you consent. The subsequent processing rests on Art. 6 (1) (a) GDPR.`,
    },
    {
      id: "kein-tracking",
      heading: "No tracking, no advertising",
      body: `We want to state this plainly:

- We use **no** analytics or statistics services (no Google Analytics, no Matomo, no pixels).
- We use **no** advertising or retargeting networks.
- There is **no** cross-device tracking and no profiling.
- **No** payment script is embedded on this site; when you pay you are redirected to Stripe's own pages, where their terms apply.
- Fonts are served locally; no connection is made to Google Fonts.

"Essential only" is therefore a fully functional choice: the website works without restriction.`,
    },
    {
      id: "notwendig",
      heading: "Essential cookies",
      body: `These are required to operate the site and cannot be switched off.

- **ksa-public.session-token** — keeps you signed in. Duration: session / until sign-out.
- **ksa-public.csrf-token** — protects forms against cross-site request forgery. Duration: session.
- **ksa-public.callback-url** — remembers the page to return to after signing in. Duration: session.
- **ksa-admin.session-token**, **ksa-admin.csrf-token**, **ksa-admin.callback-url** — the same functions for the administration area. Board members only.
- **ksa_consent** — stores this very cookie choice, so we do not have to ask again on every visit. Duration: 12 months.

All of these are set by us (first-party) and contain no advertising identifiers.`,
    },
    {
      id: "funktional",
      heading: "Functional cookies (consent required)",
      body: `These store preferences that make the site more convenient — such as a preferred language on the legal pages, or a collapsed menu.

They are not required for operation and are set only with your consent.`,
    },
    {
      id: "medien",
      heading: "Media content (consent required)",
      body: `Gallery images and video are delivered via **Cloudinary**. Retrieving a media file necessarily transmits your IP address to Cloudinary, and the provider may store information on your device.

If you decline this category the website still works; gallery content is then loaded only after you explicitly confirm.`,
    },
    {
      id: "verwalten",
      heading: "Changing or withdrawing consent",
      body: `You can open and change your choice at any time via the **"Cookie settings"** link in the footer.

Withdrawal is therefore as easy as giving consent. It takes effect for the future; the lawfulness of processing carried out beforehand is unaffected.`,
    },
    {
      id: "browser",
      heading: "Deleting cookies in your browser",
      body: `Independently of our banner you can view, delete individually or entirely, and restrict the future setting of cookies in your browser settings at any time. If you delete all cookies you will need to sign in again and make your cookie choice again.`,
    },
  ],
};

// =========================================================================
// 6. Barrierefreiheitserklärung  —  BFSG
// =========================================================================

const accessibilityDe: LegalContent = {
  title: "Erklärung zur Barrierefreiheit",
  lead: "Wie zugänglich diese Website ist, wo sie es noch nicht ist, und wie Sie uns das melden.",
  sections: [
    {
      id: "geltungsbereich",
      heading: "Geltungsbereich",
      body: `Diese Erklärung gilt für die Website {{site.url}} des {{legal.entityName}}.

Wir bemühen uns, unser Angebot für alle Menschen nutzbar zu machen — unabhängig von Behinderung, Alter oder verwendeter Technik.`,
    },
    {
      id: "stand",
      heading: "Stand der Vereinbarkeit",
      body: `Wir orientieren uns an den Web Content Accessibility Guidelines (WCAG) 2.1 auf Konformitätsstufe AA sowie an der europäischen Norm EN 301 549.

Diese Website ist mit den genannten Anforderungen **teilweise vereinbar**. Die nachstehend genannten Einschränkungen sind uns bekannt und werden schrittweise behoben.`,
    },
    {
      id: "einschraenkungen",
      heading: "Bekannte Einschränkungen",
      body: `- Nicht alle Bilder in der Galerie verfügen über beschreibende Alternativtexte. Fotos werden von ehrenamtlichen Mitgliedern beigetragen; wir ergänzen Beschreibungen fortlaufend.
- Einzelne Animationen und Übergänge lassen sich derzeit nicht vollständig über die Systemeinstellung „Bewegung reduzieren" abschalten.
- Bei einzelnen dekorativen Elementen kann der Farbkontrast unter dem Zielwert von 4,5:1 liegen.
- Hochgeladene PDF-Dokumente (etwa Tickets und Rechnungen) sind nicht durchgängig barrierefrei ausgezeichnet.

Wenn Sie auf eine Barriere stoßen, die hier nicht aufgeführt ist, teilen Sie uns das bitte mit — die Liste ist ausdrücklich nicht abschließend.`,
    },
    {
      id: "feedback",
      heading: "Feedback und Kontakt",
      body: `Sie erreichen uns bei Barrieren, mit Verbesserungsvorschlägen oder mit der Bitte um eine Information in zugänglicher Form unter:

E-Mail: {{site.email}}
Kontaktformular: [{{site.url}}/contact]({{site.url}}/contact)

Wir bestätigen den Eingang und melden uns in der Regel innerhalb von zwei Wochen mit einer Einschätzung zurück.`,
    },
    {
      id: "bfsg",
      heading: "Hinweis zum Barrierefreiheitsstärkungsgesetz",
      body: `Das Barrierefreiheitsstärkungsgesetz (BFSG) gilt seit dem 28. Juni 2025 unter anderem für Dienstleistungen im elektronischen Geschäftsverkehr gegenüber Verbraucherinnen und Verbrauchern.

Für Kleinstunternehmen im Sinne des § 3 Nr. 6 BFSG — weniger als 10 Beschäftigte und höchstens 2 Mio. Euro Jahresumsatz bzw. Jahresbilanzsumme — gilt bei der Erbringung von Dienstleistungen eine Ausnahme nach § 3 Abs. 3 BFSG. Der Verein wird ausschließlich ehrenamtlich betrieben und dürfte diese Voraussetzungen erfüllen.

Unabhängig davon halten wir Barrierefreiheit für richtig und verfolgen die oben genannten Ziele freiwillig.`,
    },
    {
      id: "erstellung",
      heading: "Erstellung dieser Erklärung",
      body: `Diese Erklärung beruht auf einer Selbstbewertung durch den Verein. Sie wird bei wesentlichen Änderungen der Website überprüft und fortgeschrieben.`,
    },
  ],
};

const accessibilityEn: LegalContent = {
  title: "Accessibility Statement",
  lead: "How accessible this website is, where it is not yet, and how to tell us.",
  sections: [
    {
      id: "geltungsbereich",
      heading: "Scope",
      body: `This statement applies to the website {{site.url}} of {{legal.entityName}}.

We aim to make our offering usable by everyone — regardless of disability, age or the technology they use.`,
    },
    {
      id: "stand",
      heading: "Conformance status",
      body: `We work towards the Web Content Accessibility Guidelines (WCAG) 2.1 at conformance level AA and the European standard EN 301 549.

This website is **partially conformant** with those requirements. The limitations listed below are known to us and are being addressed step by step.`,
    },
    {
      id: "einschraenkungen",
      heading: "Known limitations",
      body: `- Not every gallery image has a descriptive alternative text. Photos are contributed by volunteer members; we are adding descriptions on an ongoing basis.
- Some animations and transitions cannot yet be fully disabled via the "reduce motion" system setting.
- Colour contrast on some decorative elements may fall below the 4.5:1 target.
- Uploaded PDF documents (such as tickets and invoices) are not consistently tagged for accessibility.

If you encounter a barrier that is not listed here, please tell us — this list is expressly not exhaustive.`,
    },
    {
      id: "feedback",
      heading: "Feedback and contact",
      body: `Please contact us about barriers, with suggestions for improvement, or to request information in an accessible format:

Email: {{site.email}}
Contact form: [{{site.url}}/contact]({{site.url}}/contact)

We acknowledge receipt and normally come back to you with an assessment within two weeks.`,
    },
    {
      id: "bfsg",
      heading: "Note on the German Accessibility Act (BFSG)",
      body: `The German Accessibility Strengthening Act (BFSG) has applied since 28 June 2025 to, among other things, services in electronic commerce provided to consumers.

Micro-enterprises within the meaning of § 3 no. 6 BFSG — fewer than 10 employees and no more than EUR 2 million in annual turnover or balance sheet total — benefit from an exemption under § 3 (3) BFSG when providing services. The association is run entirely by volunteers and is likely to meet those criteria.

Regardless of that, we consider accessibility to be the right thing to do and pursue the goals above voluntarily.`,
    },
    {
      id: "erstellung",
      heading: "Preparation of this statement",
      body: `This statement is based on a self-assessment by the association. It is reviewed and updated whenever the website changes materially.`,
    },
  ],
};

// =========================================================================

export const LEGAL_SEEDS: LegalSeed[] = [
  { slug: "imprint", requiresConsent: false, de: imprintDe, en: imprintEn },
  { slug: "privacy", requiresConsent: true, de: privacyDe, en: privacyEn },
  { slug: "terms", requiresConsent: true, de: termsDe, en: termsEn },
  { slug: "withdrawal", requiresConsent: true, de: withdrawalDe, en: withdrawalEn },
  { slug: "cookies", requiresConsent: false, de: cookiesDe, en: cookiesEn },
  {
    slug: "accessibility",
    requiresConsent: false,
    de: accessibilityDe,
    en: accessibilityEn,
  },
];

export function getSeedFor(slug: LegalSlug): LegalSeed | undefined {
  return LEGAL_SEEDS.find((s) => s.slug === slug);
}
