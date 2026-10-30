/**
 * Validation rules shared by the public Contact and "Book with us" forms
 * (client-side for instant feedback, server-side so they can't be bypassed).
 */

/* ── Full name ─────────────────────────────────────────────────────────── */

/**
 * Letter words separated by single spaces; a `.`, `'` or `-` may join/end words
 * ("J. R. Nair", "Mary-Ann", "D'Souza"). Rejects symbols, digits and names made
 * of punctuation such as "John@@" or "--".
 */
const NAME_RE = /^[A-Za-z]+(?:[.'-]?\s?[A-Za-z]+)*\.?$/;

export const NAME_ERROR = 'Enter a valid full name (letters and spaces only, no numbers or symbols)';

export function validateFullName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) return 'Full name is required';
  if (name.replace(/[^A-Za-z]/g, '').length < 2) return NAME_ERROR;
  if (!NAME_RE.test(name)) return NAME_ERROR;
  return null;
}

/* ── Email ─────────────────────────────────────────────────────────────── */

/**
 * Practical email format: local part of letters/digits and . _ % + - (no
 * leading/trailing/double dots); domain labels may not start or end with a
 * hyphen; TLD is 2+ letters.
 */
const EMAIL_RE =
  /^(?!\.)(?!.*\.\.)[A-Za-z0-9._%+-]{1,64}(?<!\.)@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

/** Real domains of common mail providers — look-alikes (gmail-m.com, gmial.com…) are rejected. */
const PROVIDERS: Record<string, string[]> = {
  gmail: ['gmail.com', 'googlemail.com'],
  yahoo: ['yahoo.com', 'yahoo.co.in', 'yahoo.in', 'yahoo.co.uk', 'ymail.com'],
  hotmail: ['hotmail.com', 'hotmail.co.uk', 'hotmail.in'],
  outlook: ['outlook.com', 'outlook.in'],
  icloud: ['icloud.com'],
  rediffmail: ['rediffmail.com'],
};
const PROVIDER_TYPOS: Record<string, string> = {
  gmial: 'gmail', gamil: 'gmail', gmai: 'gmail', gmal: 'gmail', gnail: 'gmail', gmaill: 'gmail',
  yaho: 'yahoo', yahooo: 'yahoo', yhoo: 'yahoo',
  hotmal: 'hotmail', hotmial: 'hotmail', hotmai: 'hotmail',
  outlok: 'outlook', outook: 'outlook',
  iclod: 'icloud', icoud: 'icloud',
};

export const EMAIL_ERROR = 'Please enter a valid email address';

export function validateEmailAddress(value: string): string | null {
  const email = value.trim();
  if (!email) return 'Email address is required';
  if (!EMAIL_RE.test(email)) return EMAIL_ERROR;

  const domain = (email.split('@')[1] ?? '').toLowerCase();
  const firstLabel = domain.split('.')[0] ?? '';
  for (const [provider, domains] of Object.entries(PROVIDERS)) {
    // e.g. "gmail-m.com", "gmail.con", "my-gmail.com" — looks like Gmail but isn't
    if (firstLabel.includes(provider) && !domains.includes(domain)) {
      return `${EMAIL_ERROR} — did you mean @${domains[0]}?`;
    }
  }
  const typo = PROVIDER_TYPOS[firstLabel.replace(/-/g, '')];
  if (typo) return `${EMAIL_ERROR} — did you mean @${PROVIDERS[typo]?.[0] ?? `${typo}.com`}?`;
  return null;
}

/* ── Inappropriate language ────────────────────────────────────────────── */

/** Matched as whole words (plus common plural/verb endings), case-insensitive. */
const BAD_WORDS = [
  // English: sexual terms and profanity
  'porn', 'porno', 'pornography', 'sex', 'sexy', 'xxx',
  'nude', 'nudes', 'boobs', 'boob', 'dick', 'cock',
  'pussy', 'penis', 'vagina', 'fuck', 'fucker', 'fucking',
  'motherfucker', 'shit', 'bullshit', 'bitch', 'bastard',
  'asshole', 'arsehole', 'cunt', 'slut', 'whore', 'hooker',
  'rape', 'rapist', 'horny', 'blowjob', 'handjob', 'milf',
  'nsfw', 'onlyfans', 'wtf', 'stfu', 'dumbass', 'dipshit',
  'jackass', 'dickhead', 'piss off', 'son of a bitch',

  // Malayalam / Manglish
  'chutiya', 'chutiye', 'myre', 'myru', 'my**',
  'punda', 'pundachi', 'thevidiya', 'thevidiyaal',
  'koothi', 'koothichi', 'kundan', 'kundi',
  'poorimone', 'poori', 'thayoli', 'thayoli',
  'thendi', 'nayinte mon', 'nayinte mole',
  'patti', 'pattiye', 'pulayaadi', 'kalla patti',
  'kunna', 'kambi', 'kambi katha', 'vedi',
  'mandan', 'mandi', 'pottan', 'myre poda',
  'madarchod', 'behenchod', 'bhenchod', 'bhosdike',
  'gandu', 'randi', 'harami', 'lund', 'loda', 'lavda',

  // Malayalam script: common abusive/sexual terms
  'മൈര്', 'മൈരൻ', 'പുണ്ട', 'പുണ്ടച്ചി', 'തായോളി',
  'തേവിടിശ്ശി', 'കൂത്തി', 'കുണ്ണ', 'കുണ്ടി',
  'പൂറി', 'പൂറി മോനെ', 'നായിന്റെ മോൻ',
  'നായിന്റെ മോളെ', 'പട്ടി', 'തെണ്ടി',
  'മണ്ടൻ', 'പൊട്ടൻ', 'വെടി',

  // Tamil / Tanglish
  'thevdiya', 'thevidiya', 'otha', 'otha dei',
  'punda', 'pundai', 'sunni', 'soothu', 'koothi',
  'mayiru', 'otha poda', 'omala', 'loosu',
  'porambokku', 'thayoli', 'naaye', 'punda mavan',

  // Tamil script
  'தேவடியா', 'புண்டை', 'சுன்னி', 'சூத்து',
  'மயிரு', 'ஒத்த', 'நாயே', 'பொறம்போக்கு',

  // Hindi / Hinglish
  'madarchod', 'behenchod', 'bhenchod', 'chutiya',
  'chutiyapa', 'gaand', 'gandu', 'bhosdike',
  'bhosdiwale', 'randi', 'harami', 'kamina',
  'kamini', 'saala', 'saali', 'lund', 'loda',
  'lavda', 'gaand mara', 'gaand phati',

  // Hindi script
  'मादरचोद', 'बहनचोद', 'चूतिया', 'भोसड़ीके',
  'गांडू', 'रंडी', 'हरामी', 'कमीना', 'कमीनी',
  'लंड', 'लौड़ा', 'गांड',

  // Kannada / Kanglish
  'bolimaga', 'bolimaklu', 'soole', 'sule maga',
  'thika', 'thika muchkond', 'yavva', 'sunni maga',

  // Kannada script
  'ಬೋಳಿಮಗ', 'ಸೂಳೆ', 'ತಿಕ', 'ಸೂಳೆಮಗ',

  // Telugu / Tenglish
  'lanja', 'donga lanja', 'modda', 'dengey',
  'vedhava', 'erripuka', 'kojja',

  // Telugu script
  'లంజ', 'మొడ్డ', 'దెంగేయ్', 'వెధవ', 'కొజ్జా',

  // Common internet insults
  'idiot', 'moron', 'retard', 'loser', 'trash',
  'scumbag', 'dumbfuck', 'piece of shit'
];

/** Escapes regex symbols (e.g. "my**") and lets phrases match any run of spaces. */
function toPattern(word: string) {
  return word
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
}

// De-duplicated and longest first, so phrases win over the single words inside them
const BAD_WORD_PATTERNS = Array.from(new Set(BAD_WORDS.map((w) => w.toLowerCase().trim())))
  .filter(Boolean)
  .sort((a, b) => b.length - a.length)
  .map(toPattern);

// `\b` only understands ASCII letters, so Unicode-aware boundaries are used instead —
// otherwise words in Malayalam, Tamil, Hindi, Kannada or Telugu script never match.
const BAD_WORD_RE = new RegExp(
  `(?<![\\p{L}\\p{M}\\p{N}])(?:${BAD_WORD_PATTERNS.join('|')})(?:s|es|ed|ing|er|ers)?(?![\\p{L}\\p{M}\\p{N}])`,
  'iu'
);

/** Light de-obfuscation so "p0rn", "s.e.x" or "f*ck" are still caught. */
function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4|@/g, 'a')
    .replace(/5|\$/g, 's')
    .replace(/(?<=\w)[.*_-](?=\w)/g, '');
}

export function containsBadWords(text: string | null | undefined): boolean {
  if (!text) return false;
  return BAD_WORD_RE.test(text) || BAD_WORD_RE.test(normalise(text));
}

export function badWordsError(field: string) {
  return `${field} contains inappropriate language. Please remove it and keep the message respectful.`;
}

/* ── Masking for staff views ───────────────────────────────────────────── */

const BAD_WORD_RE_GLOBAL = new RegExp(BAD_WORD_RE.source, 'giu');

const DEOBFUSCATE: Record<string, string> = {
  '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', $: 's',
};
const JOINER = /[.*_-]/;
const WORD_CHAR = /\w/;

/**
 * Same de-obfuscation as normalise(), but remembers which original characters each
 * output character came from, so a match in the normalised text can be masked in
 * the original.
 */
function normaliseWithMap(text: string) {
  const chars = Array.from(text);
  const offsets: number[] = [];
  let pos = 0;
  for (const ch of chars) {
    offsets.push(pos);
    pos += ch.length;
  }
  const mapped = (ch: string) => DEOBFUSCATE[ch] ?? ch.toLowerCase();

  let out = '';
  const map: [number, number][] = [];
  chars.forEach((ch, i) => {
    const start = offsets[i]!;
    const end = start + ch.length;
    const prevOut = out.slice(-1);
    const next = chars[i + 1];
    // "s.e.x", "f*ck": drop separators between word characters
    if (JOINER.test(ch) && WORD_CHAR.test(prevOut) && next !== undefined && WORD_CHAR.test(mapped(next))) return;
    const m = mapped(ch);
    for (let k = 0; k < m.length; k++) map.push([start, end]);
    out += m;
  });
  return { out, map };
}

/**
 * Replaces inappropriate words with asterisks (e.g. "f*ck off" -> "**** off").
 * Customers may submit any text and it is stored unchanged; staff screens show
 * this masked version.
 */
export function maskBadWords<T extends string | null | undefined>(text: T): T {
  if (!text) return text;
  const ranges: [number, number][] = [];

  for (const m of text.matchAll(BAD_WORD_RE_GLOBAL)) {
    ranges.push([m.index!, m.index! + m[0].length]);
  }
  const { out, map } = normaliseWithMap(text);
  for (const m of out.matchAll(BAD_WORD_RE_GLOBAL)) {
    const first = map[m.index!];
    const last = map[m.index! + m[0].length - 1];
    if (first && last) ranges.push([first[0], last[1]]);
  }
  if (ranges.length === 0) return text;

  let result = '';
  let pos = 0;
  for (const ch of Array.from(text)) {
    const masked = !/\s/.test(ch) && ranges.some(([s, e]) => pos >= s && pos < e);
    result += masked ? '*' : ch;
    pos += ch.length;
  }
  return result as T;
}
