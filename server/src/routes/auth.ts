import argon2 from "argon2";
import { Router } from "express";

import { prisma } from "../db.js";
import { currentUser, publicUser } from "../middleware/auth.js";
import { logOperation } from "../services/logging.js";

export const authRouter = Router();

authRouter.get("/me", async (req, res) => {
  const user = await currentUser(req);
  res.json({ user: user ? publicUser(user) : null });
});

authRouter.post("/register", async (req, res) => {
  const username = String(req.body.username ?? "").trim();
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const confirmPassword = String(req.body.confirmPassword ?? "");

  if (username.length < 3 || password.length < 8 || password !== confirmPassword || !email.includes("@")) {
    res.status(400).json({ error: "Use a valid email, 3+ character username, and matching 8+ character passwords." });
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] }
  });
  if (existing) {
    res.status(400).json({ error: "Username or email is already registered." });
    return;
  }

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: "user",
      status: "active"
    }
  });
  req.session.userId = user.userId;
  await logOperation({ userId: user.userId, operationType: "Register", operationStatus: "Success", message: "User registered." });
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const username = String(req.body.username ?? "").trim();
  const password = String(req.body.password ?? "");
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !(await argon2.verify(user.passwordHash, password))) {
    await logOperation({
      userId: user?.userId ?? null,
      operationType: "Login",
      operationStatus: "Failed",
      message: "Invalid credentials."
    });
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  if (user.status !== "active") {
    await logOperation({
      userId: user.userId,
      operationType: "Login",
      operationStatus: "Failed",
      message: "Blocked or inactive account."
    });
    res.status(403).json({ error: "This account is not active." });
    return;
  }

  req.session.userId = user.userId;
  await logOperation({ userId: user.userId, operationType: "Login", operationStatus: "Success", message: "User logged in." });
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

