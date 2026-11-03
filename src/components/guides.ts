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
  },
} as const;
