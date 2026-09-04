import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

async function handler(name, service) {
  const source = await readFile(
    new URL(`../supabase/functions/${name}/index.ts`, import.meta.url),
    "utf8",
  );
  const stripped = source.replace(/^import .*;\r?\n/gm, "");
  const { outputText } = ts.transpileModule(stripped, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  let serve;
  vm.runInNewContext(outputText, {
    Deno: {
      serve: (fn) => {
        serve = fn;
      },
    },
    createClient: () => service,
    supabaseEnv: () => ({
      url: "https://example.invalid",
      secretKey: "test",
      publishableKey: "test",
    }),
    corsHeaders: {},
    json: (body, status = 200) => new Response(JSON.stringify(body), { status }),
    requestIp: () => "192.0.2.1",
    sha256: async () => "a".repeat(64),
    crypto,
    Response,
  });
  return serve;
}
const post = (body) =>
  new Request("https://example.invalid", {
    method: "POST",
    headers: { authorization: "Bearer test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
function inviteService({ role = "owner", allowed = true, error = null, signed = true } = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      getUser: async () => ({ data: { user: signed ? { id: "verified-owner" } : null } }),
      admin: {
        inviteUserByEmail: async () => {
          calls.push("invite");
          return { error: null };
        },
      },
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: allowed, error };
    },
    from: (name) => {
      calls.push(name);
      if (name === "user_profiles")
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: { is_active: true, access_level: role } }) }),
          }),
        };
      return {
        insert: () => ({
          select: () => ({ single: async () => ({ data: { id: "exemption" }, error: null }) }),
        }),
      };
    },
  };
}
test("invite rejects unauthenticated, non-owner and invalid method", async () => {
  for (const options of [
    { signed: false },
    { role: "admin" },
    { role: "staff" },
    { role: "customer" },
  ]) {
    const service = inviteService(options),
      run = await handler("invite-user", service);
    assert.equal(
      (await run(post({ email: "person@example.com" }))).status,
      options.signed === false ? 401 : 403,
    );
    assert.ok(!service.calls.some((x) => typeof x === "object"));
  }
  const service = inviteService(),
    run = await handler("invite-user", service);
  assert.equal((await run(new Request("https://example.invalid"))).status, 405);
});
test("invite quota blocks before exemption or Auth, database failure fails closed", async () => {
  for (const [options, status] of [
    [{ allowed: false }, 429],
    [{ error: { message: "offline" } }, 503],
  ]) {
    const service = inviteService(options),
      run = await handler("invite-user", service);
    assert.equal((await run(post({ email: "person@example.com" }))).status, status);
    assert.ok(!service.calls.includes("registration_invite_exemptions"));
    assert.ok(!service.calls.includes("invite"));
  }
});
test("invite reserves verified actor, ignoring spoofed body identity", async () => {
  const service = inviteService(),
    run = await handler("invite-user", service);
  assert.equal(
    (await run(post({ email: "person@example.com", owner_id: "attacker", access_level: "owner" })))
      .status,
    200,
  );
  const call = service.calls.find((x) => typeof x === "object");
  assert.equal(call.name, "reserve_invite_budget");
  assert.equal(call.args.owner_id, "verified-owner");
  assert.ok(service.calls.indexOf(call) < service.calls.indexOf("invite"));
});
test("registration reservation denial/error cannot reach Auth", async () => {
  for (const [data, error, status] of [
    [null, null, 429],
    [null, { message: "offline" }, 503],
  ]) {
    let signups = 0;
    const run = await handler("register-account", {
      rpc: async () => ({ data, error }),
      auth: {
        signUp: async () => {
          signups++;
        },
      },
    });
    assert.equal(
      (
        await run(
          post({
            fullName: "Test",
            email: "test@example.com",
            password: "test-password",
            deviceId: "device",
          }),
        )
      ).status,
      status,
    );
    assert.equal(signups, 0);
  }
});
test("registration passes reserved correlation and CAPTCHA only to Auth", async () => {
  let payload;
  const service = {
    rpc: async () => ({ data: "reserved-id", error: null }),
    auth: {
      signUp: async (body) => {
        payload = body;
        return { data: { user: { identities: [] } }, error: null };
      },
    },
    from: () => ({ update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }),
  };
  const run = await handler("register-account", service);
  const response = await run(
    post({
      fullName: "Test",
      email: "test@example.com",
      password: "test-password",
      deviceId: "device",
      captchaToken: "one-use",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(payload.options.data.registration_attempt_id, "reserved-id");
  assert.equal(payload.options.captchaToken, "one-use");
  assert.ok(!(await response.text()).includes("reserved-id"));
});
test("static migration contract: atomic counters, direct-write guards and private grants", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260904020000_harden_abuse_protection.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /on conflict \(action, subject, window_seconds\) do update/);
  assert.match(sql, /before insert on public.messages/);
  assert.match(sql, /before insert on public.service_orders/);
  assert.match(sql, /before insert or update or delete on public.user_profiles/);
  assert.match(sql, /new.access_level = 'owner' and old.access_level <> 'owner'/);
  assert.match(
    sql,
    /actor is null or pitgarage_private.current_access_level\(\) is distinct from 'owner'/,
  );
  assert.match(
    sql,
    /revoke all on function public.reserve_invite_budget\(uuid\) from public, anon, authenticated/,
  );
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.doesNotMatch(sql, /public.calendar_events/);
});
