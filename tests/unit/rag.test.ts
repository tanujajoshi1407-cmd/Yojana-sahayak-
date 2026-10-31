import { describe, expect, it } from "vitest";
import { detectLanguage } from "@/lib/rag/language";
import { searchTokens, toTsQuery } from "@/lib/rag/normalize";
import { extractProfile, missingKeyFacts } from "@/lib/rag/profile";

describe("detectLanguage", () => {
  it.each([
    ["Which scholarships are available for girls?", "en"],
    ["How to apply for PM Kisan", "en"],
    ["किसानों के लिए कौन सी योजनाएं हैं?", "hi"],
    ["mujhe scholership chahiye uttrakhand se hu", "hinglish"],
    ["pension kaise milegi", "hinglish"],
    ["Documents for Ayushman Bharat card", "en"],
  ])("%s -> %s", (text, lang) => expect(detectLanguage(text)).toBe(lang));
});

describe("searchTokens", () => {
  it("keeps typo tokens for trigram matching and drops Hinglish stopwords", () => {
    const t = searchTokens("mujhe scholership chahiye uttrakhand se hu");
    expect(t).toContain("scholership");
    expect(t).toContain("uttrakhand");
    expect(t).not.toContain("mujhe");
  });
  it("maps Hindi words to English keywords", () => {
    expect(searchTokens("किसानों के लिए कौन सी योजनाएं हैं?")).toContain("farmer");
    expect(searchTokens("mahila ke liye loan")).toEqual(expect.arrayContaining(["women", "loan"]));
  });
  it("neutralises SQL and tsquery syntax", () => {
    const t = searchTokens("'; DROP TABLE \"Scheme\"; -- & | ! :*");
    expect(t.join(" ")).not.toMatch(/['";&|!:*-]/);
    expect(toTsQuery(t)).toMatch(/^([a-z0-9\u0900-\u097F]+:\*)( \| [a-z0-9\u0900-\u097F]+:\*)*$/);
  });
  it("returns nothing for empty or symbol-only input", () => {
    expect(searchTokens("   ")).toEqual([]);
    expect(toTsQuery(searchTokens("<<>>"))).toBe("");
  });
});

describe("extractProfile", () => {
  it("reads state alias, student, gender, age and income", () => {
    const p = extractProfile("main 19 saal ki ladki hu, uttrakhand se, btech kar rahi, family income 2 lakh");
    expect(p).toMatchObject({ state: "Uttarakhand", age: 19, gender: "female", occupation: "student", education_level: "undergraduate", family_income_annual: 200000 });
  });
  it("reads a Hindi farmer message", () => {
    expect(extractProfile("मैं उत्तराखंड का किसान हूँ")).toMatchObject({ state: "Uttarakhand", is_farmer: true, occupation: "farmer" });
  });
  it("lists missing key facts for a vague question", () => {
    expect(missingKeyFacts(extractProfile("Am I eligible for any scheme?"))).toEqual(["state", "age"]);
  });
});
