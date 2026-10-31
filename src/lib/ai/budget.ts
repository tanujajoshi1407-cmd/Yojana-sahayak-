// Daily LLM call cap per server instance. In-memory: resets on restart and is
// per-instance on serverless. Move to Postgres/Redis for a shared limit.
let day = "";
let count = 0;

export function takeLlmBudget(limit = Number(process.env.DAILY_LLM_REQUEST_LIMIT ?? 500), now = new Date()): boolean {
  const today = now.toISOString().slice(0, 10);
  if (today !== day) { day = today; count = 0; }
  if (count >= limit) return false;
  count += 1;
  return true;
}

export function resetBudgetForTests() { day = ""; count = 0; }
