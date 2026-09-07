import type { SyncOperationInput } from "@/lib/local/outbox/batch";
import type { SyncBatchInput, SyncOpResult } from "@/types/api";

export const SERVER_TIME = "2026-09-06T10:00:00.000Z";

// The engine sends the queue as one `POST /sync` (O-F5b), so a test that drives it answers a batch
// instead of a route: one result per operation, `applied` unless the test says otherwise.
export const operationsOf = (init: RequestInit | undefined): SyncOperationInput[] => {
  const body = typeof init?.body === "string" ? init.body : "{}";
  return (JSON.parse(body) as SyncBatchInput).operations;
};

type Reply = Partial<SyncOpResult>;

export function batchResponse(
  init: RequestInit | undefined,
  reply: (operation: SyncOperationInput) => Reply,
): Response {
  const results = operationsOf(init).map((operation) => ({
    opId: operation.opId,
    seq: operation.seq,
    entity: operation.entity,
    id: operation.id,
    status: "applied",
    ...reply(operation),
  }));
  return new Response(JSON.stringify({ serverTime: SERVER_TIME, results }), {
    headers: { "content-type": "application/json" },
  });
}

interface FetchMock {
  mockImplementation(
    implementation: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  ): unknown;
}

// Stubs `fetch` so every batch is answered by `reply`.
export function answerBatch(
  fetchMock: FetchMock,
  reply: (operation: SyncOperationInput) => Reply = () => ({}),
): void {
  fetchMock.mockImplementation((_input, init) => Promise.resolve(batchResponse(init, reply)));
}

const code = (value: string): NonNullable<SyncOpResult["code"]> =>
  value as NonNullable<SyncOpResult["code"]>;

export const applied = (result?: unknown): Reply => ({
  status: "applied",
  ...(result === undefined ? {} : { result: result as SyncOpResult["result"] }),
});

export const conflictWith = (reason: string, current?: unknown): Reply => ({
  status: "conflict",
  code: code(reason),
  message: "no",
  ...(current === undefined ? {} : { current: current as SyncOpResult["current"] }),
});

export const rejectedWith = (reason: string): Reply => ({
  status: "rejected",
  code: code(reason),
  message: "no",
});

export const blockedBy = (opId: string): Reply => ({ status: "blocked", blockedBy: opId });
