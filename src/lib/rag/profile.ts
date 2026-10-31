import { INDIAN_STATES, type Profile } from "@/lib/eligibility/fields";

// Light profile extraction from the conversation. Held in the request only; never stored.

const STATE_ALIASES: Record<string, string> = {
  uttrakhand: "Uttarakhand", uttaranchal: "Uttarakhand", "उत्तराखंड": "Uttarakhand", "उत्तराखण्ड": "Uttarakhand",
  up: "Uttar Pradesh", "उत्तर प्रदेश": "Uttar Pradesh", mp: "Madhya Pradesh", "बिहार": "Bihar",
  "दिल्ली": "Delhi", "राजस्थान": "Rajasthan", "हिमाचल": "Himachal Pradesh", himachal: "Himachal Pradesh",
};

export function extractProfile(text: string): Profile {
  const t = text.toLowerCase();
  const p: Profile = {};

  for (const s of INDIAN_STATES) if (t.includes(s.toLowerCase())) p.state = s;
  if (!p.state) {
    for (const [alias, state] of Object.entries(STATE_ALIASES)) {
      const re = /^[a-z]+$/.test(alias) ? new RegExp(`\\b${alias}\\b`) : new RegExp(alias);
      if (re.test(t)) { p.state = state; break; }
    }
  }

  const age = t.match(/(\d{1,3})\s*(?:years?|yrs?|yr|saal|sal|varsh|वर्ष|साल)/) ?? t.match(/(?:age|umar|umr|उम्र)\D{0,6}(\d{1,3})/);
  if (age) { const n = Number(age[1]); if (n > 0 && n < 120) p.age = n; }

  if (/\b(student|studying|college|school|padh|padhai|b\.?tech|btech|diploma|graduation)\b|छात्र|पढ़/.test(t)) p.occupation = "student";
  if (/\b(farmer|kisan|kheti|farming)\b|किसान|खेती/.test(t)) { p.occupation = "farmer"; p.is_farmer = true; }

  if (/\b(girl|woman|female|ladki|beti|mahila|daughter)\b|लड़की|महिला|बेटी|छात्रा/.test(t)) p.gender = "female";
  else if (/\b(boy|man|male|ladka)\b|लड़का|पुरुष/.test(t)) p.gender = "male";

  if (/\b(class|kaksha)\s*(9|10)\b/.test(t)) p.education_level = "class_9_10";
  else if (/\b(class|kaksha)\s*(11|12)\b|12th|11th/.test(t)) p.education_level = "class_11_12";
  else if (/\b(diploma|polytechnic)\b/.test(t)) p.education_level = "diploma";
  else if (/\b(b\.?tech|btech|b\.?a|b\.?sc|b\.?com|graduation|undergraduate|ug)\b/.test(t)) p.education_level = "undergraduate";
  else if (/\b(m\.?tech|mtech|m\.?a|m\.?sc|post ?graduation|postgraduate|pg)\b/.test(t)) p.education_level = "postgraduate";

  const lakh = t.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|लाख)/);
  if (lakh && /(income|aay|aamdani|kamai|आय|कमाई|salary)/.test(t)) p.family_income_annual = Math.round(Number(lakh[1]) * 100000);

  if (/\b(disabled|disability|divyang|viklang)\b|दिव्यांग/.test(t)) p.has_disability = true;
  if (/\bbpl\b|गरीबी रेखा/.test(t)) p.is_bpl = true;
  return p;
}

/** Profile facts the assistant may want before recommending schemes. */
export function missingKeyFacts(p: Profile): string[] {
  const missing: string[] = [];
  if (!p.state) missing.push("state");
  if (p.age === undefined) missing.push("age");
  if (p.occupation === "student" && !p.education_level) missing.push("course or class");
  if (p.occupation === "student" && p.family_income_annual === undefined) missing.push("family income");
  return missing;
}
