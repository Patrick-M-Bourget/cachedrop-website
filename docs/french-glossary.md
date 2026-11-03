# French glossary

The terms and conventions the French pages at `/fr/` use (Decision 5). Claude drafted the French, and it ships as drafted (Decision 34); the owner can review it here at any time. Change a term here first, then in every page that uses it, and keep the French emails (#14) in step. Lines marked *Owner* are choices worth a look.

The target is Quebec French, following the Office québécois de la langue française (OQLF) where its usage differs from France's.

## Conventions

- **Address the reader as « vous ».** Same voice as the brand guide: plain, specific, calm. No exclamation marks.
- **Sentence case everywhere.** French has no Title Case: buttons, card titles and headings capitalize only the first word and proper nouns (« Télécharger la bêta gratuite », not « Télécharger la Bêta Gratuite »). Buttons are infinitives (« Envoyer », « Annuler »).
- **Punctuation (OQLF).** A non-breaking space before the colon (` :`). No space before `?`, `!` and `;`. Guillemets « » with non-breaking spaces inside. The apostrophe is the typographic `’`, as in the English pages.
- **Units.** `Go`, `Mo` (gigaoctet, mégaoctet) with a non-breaking space after the number: « 100 Go+ », « 500 Mo+ ».
- **Names stay as their owners write them.** CacheDrop, Mac, macOS, Xcode, DerivedData, node_modules, Docker, Homebrew, npm, Yarn, Premiere Pro, After Effects, Media Encoder, Final Cut Pro, Apple Silicon, Intel, Finder, Terminal. Commands, paths and file types are never translated.
- **macOS's own French names** for things the reader sees on their Mac: Corbeille, Données système, Réglages Système, dossier Téléchargements, dossier Applications.
- **The app itself is in English.** The homepage's app window shows the app as it ships, so it stays in English on the French page; only its accessible label is translated.
- **Menu paths in Xcode, Premiere Pro and Final Cut Pro** are given in English, as the menus read in an English install, because the French menu names couldn't be checked against the apps. *Owner: say if you'd rather have the French menu names.*
- **Prices** keep the number format the decisions use (« 29,99 », « 19,99 ») with the decimal comma and no currency symbol when the same number applies in every currency. With a symbol, it follows the number after a non-breaking space: « 19,99 $ », « 19,99 € ».
- **The app’s feature names stay in English** on the sale pages (Clean up, Applications uninstall, Settings → License), as they read in the app.
- **Addresses keep their English slugs** under `/fr/` (`/fr/clear-adobe-media-cache-mac/`), so every page's twin is its path with `/fr` in front. French titles, descriptions and headings carry the French search terms. *Owner: translated slugs (`/fr/vider-cache-adobe-mac/`) are possible later; they need a redirect for each.*

## Terms

| English | French | Note |
| --- | --- | --- |
| plug-in (audio) | plug-in, les plug-ins | Masculine. What producers say; OQLF's « module d’extension » is rare in studios. *Owner: check.* |
| DAW | STAN (station audionumérique) | *Owner: « DAW » is also common among Quebec producers.* |
| installer receipt | reçu de l’installateur | macOS's receipts in `/var/db/receipts`. |
| support files | fichiers de soutien | Files an installer adds beside the plug-in. |
| cache, caches | le cache, les caches | Masculine. OQLF's « antémémoire » is unknown to most readers. |
| clear (a cache) | vider | « Vider le cache de média Adobe ». |
| delete | supprimer | |
| Trash | Corbeille | macOS's name. Capitalized. |
| System Data | Données système | macOS's name in Storage settings. |
| storage cleaner | nettoyeur de stockage | « nettoyeur de stockage pour Mac ». |
| free up space | libérer de l’espace | Main search term with « nettoyer son Mac ». |
| build files, build output | fichiers de compilation, produits de compilation | |
| render files | fichiers de rendu | |
| media cache (Adobe) | cache de média | *Owner: check against Premiere Pro's French settings*; the term should match what a French install shows. |
| library (Final Cut Pro) | bibliothèque | |
| timeline (video) | montage | « vos montages » reads more naturally than « vos timelines ». |
| video editor (person) | monteur vidéo | |
| developer | développeur | |
| package cache | cache de paquets | |
| logs | journaux | |
| lockfile | fichier de verrouillage | |
| dangling images (Docker) | images orphelines | |
| break (a project) | briser | Quebec usage; France says « casser ». |
| build artifacts | artefacts de compilation | |
| scan | analyse | « en une seule analyse ». |
| Developer caches and build files (app category) | stays in English | The app’s own label, as it appears in the app. |
| ~/Library | dossier Bibliothèque | Finder's French name in prose; paths stay `~/Library/…`. |
| cookies | témoins | OQLF; the reader knows them as cookies too. |
| app | application | OQLF prefers it to « app ». |
| bug | bogue | OQLF. |
| feedback | avis | « Donner votre avis », « Donnez-nous votre avis ». |
| Provide Feedback / Give Fast Feedback | Donner votre avis | One label for both. |
| beta, public beta | bêta, bêta publique | With the accent; the nav tag reads BÊTA. |
| Download Free Beta | Télécharger la bêta gratuite | |
| Get Free Beta (nav) | Obtenir la bêta gratuite | |
| Download Free (nav, footer, pricing; Decision 44) | Télécharger gratuitement | Replaces the two beta labels above once pricing is live. |
| free to try | essai gratuit; vous pouvez l’essayer gratuitement | « Essai gratuit » as a label, the verb in a sentence. |
| Pricing (nav link, section) | Tarifs | Owner, 2026-11-02. |
| Try it free. Pay once. | Essayez-le gratuitement. Payez une seule fois. | The pricing section's title. |
| Buy a License (button) | Acheter une licence | |
| Already tried it? Buy a license | Vous l’avez déjà essayé? Achetez une licence | The download page's line. |
| Was $29.99, now $19.99 (spoken) | Prix régulier 29,99 $, maintenant 19,99 $ | What screen readers hear for the struck-through price. |
| the same number in each (currency) | le même montant dans chaque devise | |
| What’s included | Ce qui est inclus | |
| email (address) | courriel, adresse courriel | OQLF. |
| email (a message) | courriel | |
| spam folder | dossier de courrier indésirable | Apple Mail's name. |
| download link | lien de téléchargement | |
| unsubscribe | se désabonner | The page says « Désabonnement confirmé. », which avoids choosing a gender for « vous êtes désabonné(e) ». |
| Check your inbox | Vérifiez vos courriels | |
| disk image | image disque | |
| Locations & access (app section) | stays in English | The app’s own label. |
| repository (GitHub) | dépôt | |
| issue (GitHub) | ticket (issue) | |
| spam protection | protection contre les pourriels | « vérification antipourriel » for Turnstile. |
| Submit Feedback | Envoyer mon avis | Distinct from the form's « Envoyer le lien de téléchargement ». |
| news emails | courriels de nouvelles | |
| privacy policy | politique de confidentialité | |
| personal information | renseignements personnels | Law 25's term. |
| person in charge of the protection of personal information | responsable de la protection des renseignements personnels | Law 25 art. 3.1. |
| trademarks | marques de commerce | Canadian legal term. |
| Overview (footer link) | Aperçu | |
| system specs | caractéristiques du système | |
| macOS 14 or later | macOS 14 ou version ultérieure | |
| macOS 14 Sonoma and later / or later | macOS 14 Sonoma ou version ultérieure | |
| universal app (Apple Silicon and Intel) | application universelle | |
| terms of sale | conditions de vente | Decision 43. |
| refund policy | politique de remboursement | |
| license agreement | contrat de licence | French spells it « licence »; the English pages keep the app’s US spelling. |
| one-time (payment) | une seule fois | « Vous payez une seule fois. » |
| subscription | abonnement | |
| refund | remboursement, rembourser | |
| no questions asked | sans avoir à vous justifier | |
| chargeback | rétrofacturation | Followed by « contesté auprès de la banque » so it reads plainly. *Owner: check the term.* |
| revoke, revoked | révoquer, révoquée | |
| merchant of record, seller of record | vendeur inscrit sur votre reçu | Described rather than translated as a term. |
| checkout (page) | page de paiement | « lors du paiement » in running text. |
| sales tax, GST, QST, VAT | taxes de vente, TPS, TVQ, TVA | |
| personal use | usage personnel | |
| activation server | serveur d’activation | |
| on your honour | repose sur votre parole | |
| as is | tel quel | |
| Consumer Protection Act (Quebec) | Loi sur la protection du consommateur | The Act’s French title, capitalized as published. |
| Link support | soutien de Link | « support » is an anglicism in this sense. |
| upgrade (paid) | mise à niveau payante | |
| license, license key | licence, clé de licence | As in the license email (#64). |
| Resend License Key | Renvoyer la clé de licence | The resend page's button and footer link (Decision 42). |
