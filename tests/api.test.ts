import argon2 from "argon2";
import request from "supertest";

import { createApp } from "../server/src/app";
import { prisma } from "../server/src/db";
import { pngBytes } from "./helpers";

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("api integration", () => {
  beforeEach(async () => {
    await prisma.operationLog.deleteMany();
    await prisma.stegoFile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.operationLog.deleteMany();
    await prisma.stegoFile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it("registers, embeds, downloads, extracts, and logs wrong passwords", async () => {
    const app = await createApp();
    const agent = request.agent(app);

    await agent
      .post("/api/auth/register")
      .send({ username: "alice", email: "alice@example.com", password: "password123", confirmPassword: "password123" })
      .expect(201);

    const embed = await agent
      .post("/api/stego/embed")
      .field("secretText", "classified text")
      .field("stegoPassword", "extract-key")
      .attach("coverFile", pngBytes(), { filename: "cover.png", contentType: "image/png" })
      .expect(201);

    const fileId = embed.body.file.stegoFileId;
    const download = await agent.get(`/api/stego/files/${fileId}/download`).expect(200);

    await agent
      .post("/api/stego/extract")
      .field("stegoPassword", "wrong")
      .attach("stegoFile", download.body, { filename: "stego.png", contentType: "image/png" })
      .expect(400);

    const goodExtract = await agent
      .post("/api/stego/extract")
      .field("stegoPassword", "extract-key")
      .attach("stegoFile", download.body, { filename: "stego.png", contentType: "image/png" })
      .expect(200);

    expect(goodExtract.body.text).toBe("classified text");
    const denied = await prisma.operationLog.findFirst({ where: { operationStatus: "Access Denied" } });
    expect(denied).toBeTruthy();
  });

  it("allows admins to manage users and rejects non-admins", async () => {
    const app = await createApp();
    const userAgent = request.agent(app);
    await userAgent
      .post("/api/auth/register")
      .send({ username: "bob", email: "bob@example.com", password: "password123", confirmPassword: "password123" })
      .expect(201);
    await userAgent.get("/api/admin/users").expect(403);
    await userAgent.get("/api/admin/logs").expect(403);

    const dashboard = await userAgent.get("/api/dashboard").expect(200);
    expect(dashboard.body.files).toEqual([]);
    expect(dashboard.body.recentLogs).toBeUndefined();

    await prisma.user.create({
      data: {
        username: "admin",
        email: "admin@example.com",
        passwordHash: await argon2.hash("password123", { type: argon2.argon2id }),
        role: "admin",
        status: "active"
      }
    });

    const adminAgent = request.agent(app);
    await request(app).get("/api/admin/logs").expect(401);
    await adminAgent.post("/api/auth/login").send({ username: "admin", password: "password123" }).expect(200);
    const users = await adminAgent.get("/api/admin/users").expect(200);
    const bob = users.body.users.find((user: { username: string }) => user.username === "bob");
    await adminAgent.patch("/api/admin/users/not-a-number/status").send({ status: "blocked" }).expect(400);
    await adminAgent.patch("/api/admin/users/999999/status").send({ status: "blocked" }).expect(404);
    await adminAgent.patch(`/api/admin/users/${bob.userId}/status`).send({ status: "blocked" }).expect(200);
    const logs = await adminAgent.get("/api/admin/logs").expect(200);
    expect(Array.isArray(logs.body.logs)).toBe(true);

    await userAgent.post("/api/auth/login").send({ username: "bob", password: "password123" }).expect(403);
  });
});
