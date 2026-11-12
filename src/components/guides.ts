// Each cleaning guide's address, <title> and meta description, in both languages. The guide pages
// and /llms.txt read them from here, so the map of the site says what the pages say (#94).
// The footer's link to each guide is its key in footer.ts.
export const guides = {
  developer: {
    path: '/clear-mac-developer-caches/',
    en: {
      title: 'Clear Xcode DerivedData, node_modules & Docker Cache on Mac',
      description: 'Delete Xcode DerivedData, clear old node_modules and Docker caches on your Mac. Manual Terminal steps, plus a free developer Mac cleaner that does it safely.',
    },
    fr: {
      title: 'Vider DerivedData de Xcode, node_modules et le cache Docker sur Mac',
      description: 'Supprimez les DerivedData de Xcode, les vieux node_modules et les caches Docker de votre Mac. Les commandes Terminal à la main, plus un nettoyeur gratuit pour développeurs qui le fait sans risque.',
    },
    de: {
      title: 'Xcode DerivedData löschen, node_modules und Docker-Cache leeren',
      description: 'Xcode DerivedData löschen, alte node_modules-Ordner und Docker-Caches auf dem Mac leeren: die Terminal-Schritte von Hand, dazu ein Mac-Reiniger für die Entwicklung, der es sicher erledigt.',
    },
  },
  creator: {
    path: '/clear-adobe-media-cache-mac/',
    en: {
      title: 'Clear Adobe Media Cache on Mac (Premiere Pro & Final Cut Pro)',
      description: 'How to clear Adobe Premiere Pro media cache and Final Cut Pro render files on a Mac, step by step, plus a free tool that clears every version at once.',
    },
    fr: {
      title: 'Vider le cache Adobe sur Mac (Premiere Pro et Final Cut Pro)',
      description: 'Comment vider le cache de média de Premiere Pro et les fichiers de rendu de Final Cut Pro sur Mac, étape par étape, plus un outil gratuit qui vide toutes les versions d’un coup.',
    },
    de: {
      title: 'Adobe-Cache auf dem Mac leeren (Premiere Pro & Final Cut Pro)',
      description: 'So löschen Sie den Medien-Cache von Premiere Pro und die Render-Dateien von Final Cut Pro auf dem Mac, Schritt für Schritt – dazu ein Tool, das den Adobe-Cache aller Versionen auf einmal leert.',
    },
  },
  producer: {
    path: '/uninstall-audio-plugins-mac/',
    en: {
      title: 'How to Uninstall Audio Plug-ins on Mac (VST, AU, AAX, CLAP)',
      description: 'Uninstall VST, VST3, AU, AAX and CLAP plug-ins on a Mac with every file they installed, find where plug-ins are stored, and clear Ableton Live’s cache without touching your licenses.',
    },
    fr: {
      title: 'Désinstaller des plug-ins audio sur Mac (VST, AU, AAX, CLAP)',
      description: 'Désinstallez les plug-ins VST, VST3, AU, AAX et CLAP sur Mac avec tous les fichiers qu’ils ont installés, trouvez où sont rangés les plug-ins et videz le cache d’Ableton Live sans toucher à vos licences.',
    },
    de: {
      title: 'Audio-Plug-ins auf dem Mac deinstallieren (VST, AU, AAX, CLAP)',
      description: 'VST-, VST3-, AU-, AAX- und CLAP-Plug-ins auf dem Mac deinstallieren, mit allen Dateien, die sie angelegt haben. Dazu: wo Plug-ins liegen und wie Sie den Cache von Ableton Live leeren, ohne Ihre Lizenzen anzutasten.',
    },
  },
  systemData: {
    path: '/clear-system-data-mac/',
    en: {
      title: 'How to Clear System Data on Mac (and Why It’s So Big)',
      description: 'What System Data on Mac is, why it grows so big, and what’s safe to remove: caches, logs, developer files and Time Machine local snapshots, with the Terminal commands and the risks.',
    },
    fr: {
      title: 'Vider les Données système sur Mac (et pourquoi elles grossissent)',
      description: 'Ce que sont les Données système sur Mac, pourquoi elles grossissent autant et ce que vous pouvez supprimer sans risque : caches, journaux, fichiers de développement et instantanés locaux Time Machine, avec les commandes Terminal et leurs risques.',
    },
    de: {
      title: 'Systemdaten auf dem Mac löschen (und warum sie so groß sind)',
      description: 'Was die Systemdaten auf dem Mac sind, warum sie so groß werden und was sich bedenkenlos löschen lässt: Caches, Protokolle, Dateien aus der Entwicklung und lokale Time-Machine-Snapshots, mit Terminal-Befehlen und Risiken.',
    },
  },
  apps: {
    path: '/uninstall-apps-mac/',
    en: {
      title: 'How to Completely Uninstall Apps on Mac and Remove Leftovers',
      description: 'Dragging an app to the Trash leaves its settings, caches and data behind. Find where app leftovers live on a Mac, remove them by hand, or uninstall apps with every file they left.',
    },
    fr: {
      title: 'Désinstaller une application sur Mac et supprimer ses restes',
      description: 'Glisser une application dans la Corbeille laisse ses réglages, ses caches et ses données. Trouvez où se cachent les restes d’applications sur Mac, supprimez-les à la main, ou désinstallez vos applications avec tous leurs fichiers.',
    },
    de: {
      title: 'App deinstallieren auf dem Mac: komplett, mit allen Resten',
      description: 'Wer eine App in den Papierkorb zieht, lässt Einstellungen, Caches und Daten zurück. So finden Sie App-Reste auf dem Mac, entfernen sie von Hand oder deinstallieren Apps samt aller Dateien.',
    },
  },
} as const;
