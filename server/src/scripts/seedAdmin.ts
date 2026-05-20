import argon2 from "argon2";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { prisma } from "../db.js";

async function main() {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) {
    args.set(process.argv[index], process.argv[index + 1]);
  }

  const username = args.get("--username") ?? "admin";
  const email = args.get("--email") ?? "admin@example.com";
  let password = args.get("--password") ?? process.env.ADMIN_PASSWORD;

  if (!password) {
    const rl = readline.createInterface({ input, output });
    password = await rl.question("Admin password: ");
    rl.close();
  }

  if (password.length < 8) {
    throw new Error("Admin password must be at least 8 characters.");
  }

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      email: email.toLowerCase(),
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: "admin",
      status: "active"
    },
    create: {
      username,
      email: email.toLowerCase(),
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: "admin",
      status: "active"
    }
  });

  console.log(`Admin ready: ${user.username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

