export type ChatLanguage = "en" | "hi" | "hinglish";

const DEVANAGARI = /[\u0900-\u097F]/;
// Romanised Hindi grammar words (not scheme names like "kisan", which English users type too).
const HINGLISH_WORDS = new Set([
  "hai", "hain", "hu", "hoon", "mujhe", "mujhko", "mera", "meri", "mere", "kya", "kaise", "kaun",
  "kaunsi", "konsi", "chahiye", "ke", "liye", "ki", "ka", "se", "nahi", "nahin", "batao", "bataiye",
  "milega", "milegi", "sakta", "sakti", "kahan", "kab", "aur", "bhi", "hamara", "humara", "karna",
  "karein", "karu", "saal", "mai", "main", "kitna", "kitni", "wala", "wali", "paisa",
]);

export function detectLanguage(text: string): ChatLanguage {
  if (DEVANAGARI.test(text)) return "hi";
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const hits = words.filter((w) => HINGLISH_WORDS.has(w)).length;
  if (hits >= 2 || (hits === 1 && words.length <= 4)) return "hinglish";
  return "en";
}
