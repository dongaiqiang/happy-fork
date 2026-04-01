import fastify from "fastify";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Fastify } from "../types";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type SessionRecord = {
    id: string;
    accountId: string;
    seq: number;
    controller: 'mobile' | 'mac';
    controllerLeaseVersion: number;
    handoffState: 'idle' | 'switching' | 'failed';
    handoffReason: string | null;
    controllerUpdatedAt: Date;
};

type MessageRecord = {
    id: string;
    sessionId: string;
    seq: number;
    localId: string | null;
    content: unknown;
    createdAt: Date;
    updatedAt: Date;
};

type MachineRecord = {
    id: string;
    accountId: string;
    dataEncryptionKey: Uint8Array | null;
    active: boolean;
};

const {
    state,
    emitUpdateMock,
    dbMock,
    resetState,
    seedSession,
    seedMachine,
    seedMessage
} = vi.hoisted(() => {
    const state = {
        sessions: [] as SessionRecord[],
        messages: [] as MessageRecord[],
        machines: [] as MachineRecord[],
        accountSeqById: new Map<string, number>(),
        nextMessageId: 1,
        nowMs: 1700000000000,
        connections: new Set<any>()
    };

    const resetState = () => {
        state.sessions = [];
        state.messages = [];
        state.machines = [];
        state.accountSeqById = new Map<string, number>();
        state.nextMessageId = 1;
        state.nowMs = 1700000000000;
        state.connections = new Set<any>();
    };

    const seedSession = (input: Partial<SessionRecord> & Pick<SessionRecord, "id" | "accountId">) => {
        state.sessions.push({
            id: input.id,
            accountId: input.accountId,
            seq: input.seq ?? 0,
            controller: input.controller ?? 'mobile',
            controllerLeaseVersion: input.controllerLeaseVersion ?? 0,
            handoffState: input.handoffState ?? 'idle',
            handoffReason: input.handoffReason ?? null,
            controllerUpdatedAt: input.controllerUpdatedAt ?? new Date(state.nowMs)
        });
        if (!state.accountSeqById.has(input.accountId)) {
            state.accountSeqById.set(input.accountId, 0);
        }
    };

    const seedMachine = (input: MachineRecord) => {
        state.machines.push(input);
    };

    const seedMessage = (input: {
        sessionId: string;
        seq: number;
        localId: string | null;
        content: unknown;
    }) => {
        const createdAt = new Date(state.nowMs);
        state.nowMs += 1;
        const msg: MessageRecord = {
            id: `seed-${state.nextMessageId}`,
            sessionId: input.sessionId,
            seq: input.seq,
            localId: input.localId,
            content: input.content,
            createdAt,
            updatedAt: createdAt
        };
        state.nextMessageId += 1;
        state.messages.push(msg);
    };

    const selectFields = <T extends Record<string, unknown>>(row: T, select?: Record<string, boolean>) => {
        if (!select) {
            return { ...row };
        }
        const picked: Record<string, unknown> = {};
        for (const [key, enabled] of Object.entries(select)) {
            if (enabled) {
                picked[key] = row[key];
            }
        }
        return picked;
    };

    const sessionFindFirst = vi.fn(async (args: any) => {
        const row = state.sessions.find((session) => (
            session.id === args?.where?.id &&
            session.accountId === args?.where?.accountId
        ));
        if (!row) {
            return null;
        }
        return selectFields(row as unknown as Record<string, unknown>, args?.select) as SessionRecord;
    });

    const sessionUpdate = vi.fn(async (args: any) => {
        const session = state.sessions.find((item) => item.id === args?.where?.id);
        if (!session) {
            throw new Error("Session not found");
        }
        const increment = args?.data?.seq?.increment ?? 0;
        session.seq += increment;
        return selectFields(session as unknown as Record<string, unknown>, args?.select);
    });

    const sessionUpdateMany = vi.fn(async (args: any) => {
        const where = args?.where ?? {};
        const data = args?.data ?? {};
        let count = 0;

        for (const session of state.sessions) {
            if (where.id && session.id !== where.id) continue;
            if (where.accountId && session.accountId !== where.accountId) continue;
            if (typeof where.controllerLeaseVersion === 'number' && session.controllerLeaseVersion !== where.controllerLeaseVersion) continue;
            if (typeof where.controller === 'string' && session.controller !== where.controller) continue;
            if (typeof where.handoffState === 'string' && session.handoffState !== where.handoffState) continue;
            if (where.handoffState?.not && session.handoffState === where.handoffState.not) continue;

            if (data.controller !== undefined) {
                session.controller = data.controller;
            }
            if (data.controllerLeaseVersion !== undefined) {
                session.controllerLeaseVersion = data.controllerLeaseVersion;
            }
            if (data.handoffState !== undefined) {
                session.handoffState = data.handoffState;
            }
            if (data.handoffReason !== undefined) {
                session.handoffReason = data.handoffReason;
            }
            if (data.controllerUpdatedAt !== undefined) {
                session.controllerUpdatedAt = data.controllerUpdatedAt;
            }
            count += 1;
        }

        return { count };
    });

    const accountUpdate = vi.fn(async (args: any) => {
        const accountId = args?.where?.id as string;
        const current = state.accountSeqById.get(accountId) ?? 0;
        const increment = args?.data?.seq?.increment ?? 0;
        const next = current + increment;
        state.accountSeqById.set(accountId, next);
        return selectFields({ seq: next }, args?.select);
    });

    const sessionMessageFindMany = vi.fn(async (args: any) => {
        let rows = [...state.messages];

        if (args?.where?.sessionId) {
            rows = rows.filter((message) => message.sessionId === args.where.sessionId);
        }
        if (typeof args?.where?.seq?.gt === "number") {
            rows = rows.filter((message) => message.seq > args.where.seq.gt);
        }
        if (Array.isArray(args?.where?.localId?.in)) {
            const localIds = new Set(args.where.localId.in);
            rows = rows.filter((message) => localIds.has(message.localId));
        }
        if (args?.orderBy?.seq === "asc") {
            rows.sort((a, b) => a.seq - b.seq);
        }
        if (args?.orderBy?.createdAt === "desc") {
            rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (typeof args?.take === "number") {
            rows = rows.slice(0, args.take);
        }

        return rows.map((row) => selectFields(row as unknown as Record<string, unknown>, args?.select));
    });

    const sessionMessageCreate = vi.fn(async (args: any) => {
        const createdAt = new Date(state.nowMs);
        state.nowMs += 1;
        const row: MessageRecord = {
            id: `msg-${state.nextMessageId}`,
            sessionId: args?.data?.sessionId,
            seq: args?.data?.seq,
            localId: args?.data?.localId ?? null,
            content: args?.data?.content,
            createdAt,
            updatedAt: createdAt
        };
        state.nextMessageId += 1;
        state.messages.push(row);
        return selectFields(row as unknown as Record<string, unknown>, args?.select);
    });

    const machineFindFirst = vi.fn(async (args: any) => {
        const row = state.machines.find((machine) => (
            machine.id === args?.where?.id &&
            machine.accountId === args?.where?.accountId
        ));
        if (!row) {
            return null;
        }
        return selectFields(row as unknown as Record<string, unknown>, args?.select);
    });

    const txClient = {
        session: {
            update: sessionUpdate
        },
        sessionMessage: {
            findMany: sessionMessageFindMany,
            create: sessionMessageCreate
        },
        account: {
            update: accountUpdate
        }
    };

    const dbMock = {
        session: {
            findFirst: sessionFindFirst,
            update: sessionUpdate,
            updateMany: sessionUpdateMany
        },
        account: {
            update: accountUpdate
        },
        machine: {
            findFirst: machineFindFirst
        },
        sessionMessage: {
            findMany: sessionMessageFindMany,
            create: sessionMessageCreate
        },
        $transaction: vi.fn(async (fn: any) => fn(txClient))
    };

    const emitUpdateMock = vi.fn();

    return {
        state,
        emitUpdateMock,
        dbMock,
        resetState,
        seedSession,
        seedMachine,
        seedMessage
    };
});

vi.mock("@/storage/db", () => ({
    db: dbMock
}));

vi.mock("@/utils/randomKeyNaked", () => ({
    randomKeyNaked: vi.fn(() => "update-id")
}));

vi.mock("@/app/events/eventRouter", () => ({
    eventRouter: {
        emitUpdate: emitUpdateMock,
        getConnections: vi.fn(() => state.connections)
    },
    buildNewMessageUpdate: vi.fn((message: unknown, sessionId: string, updateSeq: number, updateId: string) => ({
        id: updateId,
        seq: updateSeq,
        body: {
            t: "new-message",
            sid: sessionId,
            message
        },
        createdAt: Date.now()
    })),
    buildSessionControlUpdate: vi.fn((sessionId: string, updateSeq: number, updateId: string, controlState: Record<string, unknown>) => ({
        id: updateId,
        seq: updateSeq,
        body: {
            t: "update-session",
            id: sessionId,
            ...controlState
        },
        createdAt: Date.now()
    }))
}));

import { v3SessionRoutes } from "./v3SessionRoutes";

async function createApp() {
    const app = fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const typed = app.withTypeProvider<ZodTypeProvider>() as unknown as Fastify;

    typed.decorate("authenticate", async (request: any, reply: any) => {
        const userId = request.headers["x-user-id"];
        if (typeof userId !== "string") {
            return reply.code(401).send({ error: "Unauthorized" });
        }
        request.userId = userId;
    });

    v3SessionRoutes(typed);
    await typed.ready();
    return typed;
}

function encryptRpcPayload(payload: unknown, key: Uint8Array): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    const plaintext = Buffer.from(JSON.stringify(payload));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const bundle = Buffer.concat([Buffer.from([0]), nonce, ciphertext, authTag]);
    return bundle.toString('base64');
}

function decryptRpcPayload(payload: string, key: Uint8Array): any {
    const bundle = Buffer.from(payload, 'base64');
    const nonce = bundle.subarray(1, 13);
    const authTag = bundle.subarray(bundle.length - 16);
    const ciphertext = bundle.subarray(13, bundle.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
}

describe("v3SessionRoutes", () => {
    let app: Fastify;

    beforeEach(() => {
        resetState();
        emitUpdateMock.mockClear();
    });

    afterEach(async () => {
        if (app) {
            await app.close();
        }
    });

    it("reads messages in seq order from the beginning", async () => {
        seedSession({ id: "session-1", accountId: "user-1" });
        seedMessage({ sessionId: "session-1", seq: 2, localId: "l2", content: { t: "encrypted", c: "b" } });
        seedMessage({ sessionId: "session-1", seq: 1, localId: "l1", content: { t: "encrypted", c: "a" } });

        app = await createApp();
        const response = await app.inject({
            method: "GET",
            url: "/v3/sessions/session-1/messages",
            headers: { "x-user-id": "user-1" }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.hasMore).toBe(false);
        expect(body.messages.map((message: any) => message.seq)).toEqual([1, 2]);
    });

    it("supports cursor pagination with hasMore", async () => {
        seedSession({ id: "session-1", accountId: "user-1" });
        for (let seq = 1; seq <= 5; seq += 1) {
            seedMessage({ sessionId: "session-1", seq, localId: `l${seq}`, content: { t: "encrypted", c: String(seq) } });
        }

        app = await createApp();
        const page1 = await app.inject({
            method: "GET",
            url: "/v3/sessions/session-1/messages?after_seq=0&limit=2",
            headers: { "x-user-id": "user-1" }
        });
        const body1 = page1.json();
        expect(body1.messages.map((message: any) => message.seq)).toEqual([1, 2]);
        expect(body1.hasMore).toBe(true);

        const page2 = await app.inject({
            method: "GET",
            url: "/v3/sessions/session-1/messages?after_seq=2&limit=2",
            headers: { "x-user-id": "user-1" }
        });
        const body2 = page2.json();
        expect(body2.messages.map((message: any) => message.seq)).toEqual([3, 4]);
        expect(body2.hasMore).toBe(true);

        const page3 = await app.inject({
            method: "GET",
            url: "/v3/sessions/session-1/messages?after_seq=4&limit=2",
            headers: { "x-user-id": "user-1" }
        });
        const body3 = page3.json();
        expect(body3.messages.map((message: any) => message.seq)).toEqual([5]);
        expect(body3.hasMore).toBe(false);
    });

    it("returns empty results for empty sessions and after_seq beyond latest", async () => {
        seedSession({ id: "session-1", accountId: "user-1" });
        seedMessage({ sessionId: "session-1", seq: 1, localId: "l1", content: { t: "encrypted", c: "a" } });

        app = await createApp();
        const emptyResponse = await app.inject({
            method: "GET",
            url: "/v3/sessions/session-1/messages?after_seq=1",
            headers: { "x-user-id": "user-1" }
        });

        expect(emptyResponse.statusCode).toBe(200);
        const body = emptyResponse.json();
        expect(body.messages).toEqual([]);
        expect(body.hasMore).toBe(false);
    });

    it("allows readonly mobile clients to fetch messages while mac is the controller", async () => {
        seedSession({ id: "session-1", accountId: "user-1", controller: "mac", handoffState: "idle" });
        seedMessage({ sessionId: "session-1", seq: 1, localId: "l1", content: { t: "encrypted", c: "a" } });

        app = await createApp();
        const response = await app.inject({
            method: "GET",
            url: "/v3/sessions/session-1/messages",
            headers: { "x-user-id": "user-1" }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.messages.map((message: any) => message.seq)).toEqual([1]);
        expect(body.hasMore).toBe(false);
    });

    it("enforces read query bounds and auth/session ownership", async () => {
        seedSession({ id: "session-1", accountId: "owner-user" });
        app = await createApp();

        const invalidLimit = await app.inject({
            method: "GET",
            url: "/v3/sessions/session-1/messages?limit=0",
            headers: { "x-user-id": "owner-user" }
        });
        expect(invalidLimit.statusCode).toBe(400);

        const tooLargeLimit = await app.inject({
            method: "GET",
            url: "/v3/sessions/session-1/messages?limit=501",
            headers: { "x-user-id": "owner-user" }
        });
        expect(tooLargeLimit.statusCode).toBe(400);

        const unauthorized = await app.inject({
            method: "GET",
            url: "/v3/sessions/session-1/messages"
        });
        expect(unauthorized.statusCode).toBe(401);

        const wrongOwner = await app.inject({
            method: "GET",
            url: "/v3/sessions/session-1/messages",
            headers: { "x-user-id": "another-user" }
        });
        expect(wrongOwner.statusCode).toBe(404);
    });

    it("sends a single message and emits a new-message update", async () => {
        seedSession({ id: "session-1", accountId: "user-1", seq: 0 });

        app = await createApp();
        const response = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/messages",
            headers: { "x-user-id": "user-1" },
            payload: {
                messages: [
                    { localId: "l1", content: "enc-content-1" }
                ]
            }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.messages).toHaveLength(1);
        expect(body.messages[0].seq).toBe(1);
        expect(body.messages[0].localId).toBe("l1");

        expect(state.messages).toHaveLength(1);
        expect(state.messages[0].content).toEqual({ t: "encrypted", c: "enc-content-1" });
        expect(emitUpdateMock).toHaveBeenCalledTimes(1);
    });

    it("sends multiple messages with sequential seq numbers", async () => {
        seedSession({ id: "session-1", accountId: "user-1", seq: 0 });

        app = await createApp();
        const response = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/messages",
            headers: { "x-user-id": "user-1" },
            payload: {
                messages: [
                    { localId: "l1", content: "enc-1" },
                    { localId: "l2", content: "enc-2" },
                    { localId: "l3", content: "enc-3" }
                ]
            }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.messages.map((message: any) => message.seq)).toEqual([1, 2, 3]);
        expect(emitUpdateMock).toHaveBeenCalledTimes(3);
    });

    it("deduplicates by localId and returns mixed existing/new messages sorted by seq", async () => {
        seedSession({ id: "session-1", accountId: "user-1", seq: 1 });
        seedMessage({ sessionId: "session-1", seq: 1, localId: "existing", content: { t: "encrypted", c: "old" } });

        app = await createApp();
        const response = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/messages",
            headers: { "x-user-id": "user-1" },
            payload: {
                messages: [
                    { localId: "new-1", content: "new-content" },
                    { localId: "existing", content: "ignored" }
                ]
            }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.messages.map((message: any) => message.localId)).toEqual(["existing", "new-1"]);
        expect(body.messages.map((message: any) => message.seq)).toEqual([1, 2]);
        expect(state.messages).toHaveLength(2);
        expect(emitUpdateMock).toHaveBeenCalledTimes(1);
    });

    it("enforces send validation limits and auth/session ownership", async () => {
        seedSession({ id: "session-1", accountId: "owner-user" });
        app = await createApp();

        const emptyBatch = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/messages",
            headers: { "x-user-id": "owner-user" },
            payload: { messages: [] }
        });
        expect(emptyBatch.statusCode).toBe(400);

        const overLimitBatch = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/messages",
            headers: { "x-user-id": "owner-user" },
            payload: {
                messages: Array.from({ length: 101 }, (_, index) => ({
                    localId: `l-${index}`,
                    content: `enc-${index}`
                }))
            }
        });
        expect(overLimitBatch.statusCode).toBe(400);

        const unauthorized = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/messages",
            payload: {
                messages: [{ localId: "l1", content: "enc-1" }]
            }
        });
        expect(unauthorized.statusCode).toBe(401);

        const wrongOwner = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/messages",
            headers: { "x-user-id": "another-user" },
            payload: {
                messages: [{ localId: "l1", content: "enc-1" }]
            }
        });
        expect(wrongOwner.statusCode).toBe(404);
    });

    it("rejects sending messages when mobile is not the controller", async () => {
        seedSession({ id: "session-1", accountId: "user-1", controller: "mac", handoffState: "idle" });
        app = await createApp();

        const response = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/messages",
            headers: { "x-user-id": "user-1" },
            payload: {
                messages: [{ localId: "l1", content: "enc-1" }]
            }
        });

        expect(response.statusCode).toBe(409);
        expect(response.json()).toEqual({ error: "mobile-controller-required" });
        expect(state.messages).toHaveLength(0);
    });

    it("allows cli-originated message uploads while mac is the controller", async () => {
        seedSession({ id: "session-1", accountId: "user-1", controller: "mac", handoffState: "idle" });
        app = await createApp();

        const response = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/messages",
            headers: {
                "x-user-id": "user-1",
                "x-happy-message-source": "cli"
            },
            payload: {
                messages: [{ localId: "l1", content: "enc-1" }]
            }
        });

        expect(response.statusCode).toBe(200);
        expect(state.messages).toHaveLength(1);
        expect(state.messages[0]?.sessionId).toBe("session-1");
    });

    it("rejects sending messages while handoff is switching", async () => {
        seedSession({ id: "session-1", accountId: "user-1", controller: "mobile", handoffState: "switching" });
        app = await createApp();

        const response = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/messages",
            headers: { "x-user-id": "user-1" },
            payload: {
                messages: [{ localId: "l1", content: "enc-1" }]
            }
        });

        expect(response.statusCode).toBe(409);
        expect(response.json()).toEqual({ error: "switching-in-progress" });
        expect(state.messages).toHaveLength(0);
    });

    it("switches controller to mac after successful Open in Mac handoff", async () => {
        const machineKey = new Uint8Array(32).fill(7);
        seedSession({
            id: "session-1",
            accountId: "user-1",
            controller: "mobile",
            controllerLeaseVersion: 3,
            handoffState: "idle"
        });
        seedMachine({
            id: "machine-1",
            accountId: "user-1",
            dataEncryptionKey: machineKey,
            active: true
        });

        const emitWithAck = vi.fn(async () => {
            return encryptRpcPayload({
                type: "success",
                sessionId: "session-1"
            }, machineKey);
        });
        state.connections = new Set([{
            connectionType: 'machine-scoped',
            machineId: 'machine-1',
            socket: {
                connected: true,
                timeout: () => ({
                    emitWithAck
                })
            }
        }]);

        app = await createApp();
        const response = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/handoff/mac",
            headers: { "x-user-id": "user-1" },
            payload: {
                expectedLeaseVersion: 3,
                machineId: "machine-1",
                directory: "/tmp/demo",
                claudeSessionId: "claude-1",
                tmuxSessionId: "happy:window-1",
                openTerminal: true,
                terminalCarrierMode: "hosted"
            }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.success).toBe(true);
        expect(body.state.controller).toBe("mac");
        expect(body.state.leaseVersion).toBe(4);
        expect(body.state.handoffState).toBe("idle");

        const session = state.sessions.find((item) => item.id === "session-1");
        expect(session?.controller).toBe("mac");
        expect(session?.controllerLeaseVersion).toBe(4);
        expect(session?.handoffState).toBe("idle");
        const firstRpcCall = emitWithAck.mock.calls[0];
        expect(firstRpcCall).toBeTruthy();
        if (!firstRpcCall) {
            throw new Error("Missing RPC call");
        }
        const [, rpcRequest] = firstRpcCall as unknown as [string, { params: string }];
        const rpcPayload = decryptRpcPayload(rpcRequest.params, machineKey);
        expect(rpcPayload.tmuxSessionId).toBe("happy:window-1");
        expect(rpcPayload.terminalCarrierMode).toBe("hosted");
    });

    it("switches controller through controller-switch endpoint", async () => {
        seedSession({
            id: "session-1",
            accountId: "user-1",
            controller: "mobile",
            controllerLeaseVersion: 2,
            handoffState: "idle"
        });

        app = await createApp();
        const response = await app.inject({
            method: "POST",
            url: "/v3/sessions/session-1/controller-switch",
            headers: { "x-user-id": "user-1" },
            payload: {
                expectedLeaseVersion: 2,
                targetController: "mac"
            }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.success).toBe(true);
        expect(body.state.controller).toBe("mac");
        expect(body.state.leaseVersion).toBe(3);
        expect(body.state.handoffState).toBe("idle");
    });
});
