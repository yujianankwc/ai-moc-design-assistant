import { randomBytes } from "node:crypto";

function generateInviteCode(prefix = "MOC-BETA", segmentLength = 6) {
  const raw = randomBytes(6).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const segment = raw.slice(0, Math.max(4, segmentLength));
  return `${prefix}-${segment}`;
}

const countArg = Number(process.argv[2] || "10");
const count = Number.isFinite(countArg) && countArg > 0 ? Math.min(200, Math.floor(countArg)) : 10;

const codes = new Set();
while (codes.size < count) {
  codes.add(generateInviteCode());
}

console.log("生成的邀请码：");
for (const code of codes) {
  console.log(code);
}

console.log("\n可直接粘贴到 .env.local：");
console.log(`INVITE_CODES=${Array.from(codes).join(",")}`);

