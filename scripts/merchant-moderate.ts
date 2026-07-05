/**
 * Merchant moderation from the terminal — a lockout-proof fallback for the
 * Telegram approve/reject flow.
 *
 *   npm run merchant -- list                 # pending merchants
 *   npm run merchant -- list all             # every merchant + status
 *   npm run merchant -- approve <email|id>
 *   npm run merchant -- reject  <email|id>
 */
import "dotenv/config"
import { eq } from "drizzle-orm"
import { db, merchants } from "../db/index"

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

async function main() {
  const [cmd, arg] = process.argv.slice(2)

  if (cmd === "list") {
    const rows = await db
      .select({ id: merchants.id, email: merchants.email, name: merchants.name, status: merchants.status })
      .from(merchants)
    const filtered = arg === "all" ? rows : rows.filter((r) => r.status === "pending")
    if (filtered.length === 0) {
      console.log(arg === "all" ? "No merchants." : "No pending merchants.")
      return
    }
    for (const r of filtered) {
      console.log(`${r.status.padEnd(9)} ${r.email}${r.name ? ` (${r.name})` : ""}  ${r.id}`)
    }
    return
  }

  if (cmd === "approve" || cmd === "reject") {
    if (!arg) {
      console.error(`Usage: npm run merchant -- ${cmd} <email|id>`)
      process.exit(1)
    }
    const status = cmd === "approve" ? "approved" : "rejected"
    const [updated] = await db
      .update(merchants)
      .set({ status, updatedAt: new Date() })
      .where(looksLikeUuid(arg) ? eq(merchants.id, arg) : eq(merchants.email, arg.toLowerCase()))
      .returning({ email: merchants.email, status: merchants.status })
    if (!updated) {
      console.error(`No merchant matched "${arg}".`)
      process.exit(1)
    }
    console.log(`✅ ${updated.email} → ${updated.status}`)
    return
  }

  console.error("Commands: list [all] | approve <email|id> | reject <email|id>")
  process.exit(1)
}

await main()
process.exit(0)
