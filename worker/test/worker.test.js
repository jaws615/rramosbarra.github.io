import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const origin = "https://jaws615.github.io";

function request(path, body, options = {}) {
    return new Request(`https://worker.example${path}`, {
        method: options.method || "POST",
        headers: {
            Origin: options.origin || origin,
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

function makeEnv(overrides = {}) {
    const env = {
        SITE_ORIGIN: origin,
        AI_MODEL: "test-model",
        MAX_OUTPUT_TOKENS: "320",
        CHAT_RATE_LIMITER: { limit: async () => ({ success: true }) },
        CONTACT_RATE_LIMITER: { limit: async () => ({ success: true }) },
        AI: {
            run: async (_model, input) => {
                env.lastMessages = input.messages;
                return { response: "Renzo has 20+ years of technology experience." };
            }
        },
        TURNSTILE_SECRET_KEY: "test-secret",
        TURNSTILE_EXPECTED_HOSTNAME: "jaws615.github.io",
        DB: {
            prepare: (sql) => ({
                bind: (...values) => ({
                    run: async () => {
                        env.lastInsert = { sql, values };
                        return { success: true };
                    }
                })
            })
        },
        ...overrides
    };
    return env;
}

test("chat uses resume facts, caps follow-up context, and returns CORS headers", async () => {
    const env = makeEnv();
    const history = Array.from({ length: 6 }, (_, index) => [
        { role: "user", content: `Question ${index + 1}` },
        { role: "assistant", content: `Answer ${index + 1}` }
    ]).flat();
    const response = await worker.fetch(request("/api/chat", {
        question: "How long has Renzo worked in technology?",
        history
    }), env);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.match((await response.json()).answer, /20\+/);
    assert.equal(env.lastMessages.length, 14);
    assert.equal(env.lastMessages[0].role, "system");
    assert.match(env.lastMessages[0].content, /20\+ years/);
});

test("chat rejects invalid origins before calling AI", async () => {
    const env = makeEnv();
    const response = await worker.fetch(request("/api/chat", { question: "Hello" }, {
        origin: "https://attacker.example"
    }), env);

    assert.equal(response.status, 403);
    assert.equal(env.lastMessages, undefined);
});

test("chat rejects oversized questions and does not invoke AI", async () => {
    const env = makeEnv();
    const response = await worker.fetch(request("/api/chat", {
        question: "x".repeat(1501)
    }), env);

    assert.equal(response.status, 400);
    assert.equal(env.lastMessages, undefined);
});

test("chat rejects a body over the byte limit before parsing", async () => {
    const env = makeEnv();
    const response = await worker.fetch(request("/api/chat", {
        question: "x".repeat(16 * 1024)
    }), env);

    assert.equal(response.status, 413);
    assert.equal(env.lastMessages, undefined);
});

test("chat stops before AI when the rate limit is exceeded", async () => {
    const env = makeEnv({
        CHAT_RATE_LIMITER: { limit: async () => ({ success: false }) }
    });
    const response = await worker.fetch(request("/api/chat", { question: "Hello" }), env);

    assert.equal(response.status, 429);
    assert.equal(env.lastMessages, undefined);
});

test("preflight allows only the configured site origin", async () => {
    const env = makeEnv();
    const response = await worker.fetch(new Request("https://worker.example/api/chat", {
        method: "OPTIONS",
        headers: { Origin: origin }
    }), env);

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
});

test("contact requires explicit consent before verification or storage", async () => {
    const env = makeEnv();
    const response = await worker.fetch(request("/api/contact", {
        name: "Recruiter",
        email: "recruiter@example.com",
        message: "Let's talk.",
        consent: false,
        turnstileToken: "test-token"
    }), env);

    assert.equal(response.status, 400);
    assert.equal(env.lastInsert, undefined);
});

test("contact rejects consent that is not the boolean true value", async () => {
    const env = makeEnv();
    const response = await worker.fetch(request("/api/contact", {
        name: "Recruiter",
        email: "recruiter@example.com",
        message: "Let's talk.",
        consent: "true",
        turnstileToken: "test-token"
    }), env);

    assert.equal(response.status, 400);
    assert.equal(env.lastInsert, undefined);
});

test("contact verifies Turnstile and stores only submitted details", async (context) => {
    const originalFetch = globalThis.fetch;
    context.after(() => {
        globalThis.fetch = originalFetch;
    });
    globalThis.fetch = async () => new Response(JSON.stringify({
        success: true,
        hostname: "jaws615.github.io"
    }), { status: 200, headers: { "Content-Type": "application/json" } });

    const env = makeEnv();
    const response = await worker.fetch(request("/api/contact", {
        name: "Recruiter",
        email: "recruiter@example.com",
        message: "Let's talk.",
        consent: true,
        turnstileToken: "test-token"
    }), env);

    assert.equal(response.status, 201);
    assert.deepEqual(env.lastInsert.values, ["Recruiter", "recruiter@example.com", "Let's talk."]);
    assert.doesNotMatch(env.lastInsert.sql, /history|conversation/i);
});

test("contact rejects a Turnstile token for another hostname", async (context) => {
    const originalFetch = globalThis.fetch;
    context.after(() => {
        globalThis.fetch = originalFetch;
    });
    globalThis.fetch = async () => new Response(JSON.stringify({
        success: true,
        hostname: "attacker.example"
    }), { status: 200, headers: { "Content-Type": "application/json" } });

    const env = makeEnv();
    const response = await worker.fetch(request("/api/contact", {
        name: "Recruiter",
        email: "recruiter@example.com",
        message: "Let's talk.",
        consent: true,
        turnstileToken: "test-token"
    }), env);

    assert.equal(response.status, 400);
    assert.equal(env.lastInsert, undefined);
});
