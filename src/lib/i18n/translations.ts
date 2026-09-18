export type SupportedLanguage = 'en' | 'hi' | 'ml';

export const translations = {
  en: {
    nav_home: 'Home',
    nav_packages: 'Packages',
    nav_destinations: 'Destinations',
    nav_offers: 'Offers',
    nav_gallery: 'Gallery',
    nav_blog: 'Blog',
    nav_about: 'About',
    nav_contact: 'Contact',
    nav_login: 'Log in',
    nav_book_with_us: 'Book with us',
    nav_view_all_destinations: 'View all destinations',
    nav_my_bookings: 'My bookings',
    nav_change_password: 'Change password',
    nav_log_out: 'Log out',

    hero_tagline: 'Explore without the guesswork',
    hero_search_placeholder: 'Where to?',

    home_why_us_eyebrow: 'Why us',
    home_why_us_title: 'Trip planning without the guesswork',

    home_how_it_works_eyebrow: 'How it works',
    home_how_it_works_title: 'From first message to boarding pass',

    home_blog_eyebrow: 'From the blog',
    home_blog_title: 'Travel notes & guides',

    home_cta_title: 'Ready to start planning?',
    home_cta_body: "Tell us what you have in mind — we'll take it from there.",

    footer_explore: 'Explore',
    footer_company: 'Company',
  },
  hi: {
    nav_home: 'होम',
    nav_packages: 'पैकेज',
    nav_destinations: 'गंतव्य',
    nav_offers: 'ऑफर',
    nav_gallery: 'गैलरी',
    nav_blog: 'ब्लॉग',
    nav_about: 'हमारे बारे में',
    nav_contact: 'संपर्क करें',
    nav_login: 'लॉग इन करें',
    nav_book_with_us: 'हमारे साथ बुक करें',
    nav_view_all_destinations: 'सभी गंतव्य देखें',
    nav_my_bookings: 'मेरी बुकिंग',
    nav_change_password: 'पासवर्ड बदलें',
    nav_log_out: 'लॉग आउट',

    hero_tagline: 'बिना अनुमान लगाए यात्रा की खोज करें',
    hero_search_placeholder: 'कहाँ जाना है?',

    home_why_us_eyebrow: 'हमें क्यों चुनें',
    home_why_us_title: 'बिना किसी अनुमान के यात्रा योजना',

    home_how_it_works_eyebrow: 'यह कैसे काम करता है',
    home_how_it_works_title: 'पहले संदेश से बोर्डिंग पास तक',

    home_blog_eyebrow: 'ब्लॉग से',
    home_blog_title: 'यात्रा नोट्स और गाइड',

    home_cta_title: 'योजना शुरू करने के लिए तैयार हैं?',
    home_cta_body: 'हमें बताएं कि आपके मन में क्या है — बाकी हम संभाल लेंगे।',

    footer_explore: 'एक्सप्लोर करें',
    footer_company: 'कंपनी',
  },
  ml: {
    nav_home: 'ഹോം',
    nav_packages: 'പാക്കേജുകൾ',
    nav_destinations: 'ലക്ഷ്യസ്ഥാനങ്ങൾ',
    nav_offers: 'ഓഫറുകൾ',
    nav_gallery: 'ഗാലറി',
    nav_blog: 'ബ്ലോഗ്',
    nav_about: 'ഞങ്ങളെക്കുറിച്ച്',
    nav_contact: 'ബന്ധപ്പെടുക',
    nav_login: 'ലോഗിൻ ചെയ്യുക',
    nav_book_with_us: 'ഞങ്ങളോടൊപ്പം ബുക്ക് ചെയ്യുക',
    nav_view_all_destinations: 'എല്ലാ ലക്ഷ്യസ്ഥാനങ്ങളും കാണുക',
    nav_my_bookings: 'എൻ്റെ ബുക്കിംഗുകൾ',
    nav_change_password: 'പാസ്‌വേഡ് മാറ്റുക',
    nav_log_out: 'ലോഗ് ഔട്ട്',

    hero_tagline: 'ഊഹിക്കാതെ യാത്ര പര്യവേക്ഷണം ചെയ്യുക',
    hero_search_placeholder: 'എവിടേക്ക്?',

    home_why_us_eyebrow: 'ഞങ്ങളെ തിരഞ്ഞെടുക്കുന്നത് എന്തുകൊണ്ട്',
    home_why_us_title: 'ഊഹമില്ലാതെ യാത്രാ ആസൂത്രണം',

    home_how_it_works_eyebrow: 'ഇത് എങ്ങനെ പ്രവർത്തിക്കുന്നു',
    home_how_it_works_title: 'ആദ്യ സന്ദേശം മുതൽ ബോർഡിംഗ് പാസ് വരെ',

    home_blog_eyebrow: 'ബ്ലോഗിൽ നിന്ന്',
    home_blog_title: 'യാത്രാ കുറിപ്പുകളും ഗൈഡുകളും',

    home_cta_title: 'ആസൂത്രണം ആരംഭിക്കാൻ തയ്യാറാണോ?',
    home_cta_body: 'നിങ്ങളുടെ മനസ്സിലുള്ളത് ഞങ്ങളോട് പറയുക — ബാക്കി ഞങ്ങൾ നോക്കിക്കൊള്ളാം.',

    footer_explore: 'പര്യവേക്ഷണം ചെയ്യുക',
    footer_company: 'കമ്പനി',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
