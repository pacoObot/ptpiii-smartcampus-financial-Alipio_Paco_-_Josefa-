const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const references = [
  ['debts', 'studentId'], ['payments', 'studentId'],
  ['payments', 'confirmedById'], ['financial_status', 'studentId'],
  ['analysis_requests', 'studentId'], ['analysis_requests', 'resolvedById'],
  ['financial_notifications', 'studentId'],
];
async function main() {
  let invalid = 0;
  for (const [table, column] of references) {
    // Identifiers come exclusively from the fixed list above.
    const [result] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "${table}" f LEFT JOIN users u ON u.id = f."${column}" WHERE f."${column}" IS NOT NULL AND u.id IS NULL`
    );
    console.log(`${table}.${column}: ${result.count} referencias invalidas`);
    invalid += result.count;
  }
  if (invalid) throw new Error('Corrigir as referencias invalidas antes de aplicar a migracao.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
