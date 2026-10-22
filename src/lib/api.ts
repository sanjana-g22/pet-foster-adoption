// Tiny wrapper so every route handler is: auth check -> validate -> DB call -> JSON, with one error path.
import { NextResponse } from "next/server";
import { ApiError, toResponse } from "./errors";

export type IdCtx = { params: Promise<{ id: string }> };

export async function idOf(ctx: IdCtx): Promise<number> {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, "Not found");
  return id;
}

export function api<C = unknown>(fn: (req: Request, ctx: C) => Promise<unknown>, status = 200) {
  return async (req: Request, ctx: C) => {
    try {
      return NextResponse.json({ data: await fn(req, ctx) }, { status });
    } catch (e) {
      return toResponse(e);
    }
  };
}