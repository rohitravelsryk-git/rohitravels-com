import { sealSession } from "h3-v2";
const event = { req: new Request("http://localhost:8080/"), res: { headers: new Headers() },
  context: { sessions: { "rohi-admin": { id: "test-session", createdAt: Date.now(), data: { unlocked: true } } } } };
const sealed = await sealSession(event, { password: process.env.SESSION_SECRET, name: "rohi-admin", maxAge: 60*60*8 });
process.stdout.write(sealed + "\n");
