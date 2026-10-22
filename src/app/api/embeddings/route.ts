import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ApiError, toResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

type FeatureExtractor = (text: string, options?: Record<string, unknown>) => Promise<{ data: ArrayLike<number> }>;
let extractorPromise: Promise<FeatureExtractor> | null = null;

async function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      return await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
        quantized: true,
      }) as unknown as FeatureExtractor;
    })();
  }
  return extractorPromise;
}

export async function POST(request: Request) {
  try {
    await requireRole("adopter", "staff", "admin");
    const body = await request.json();
    const text = String(body.text ?? "").trim();
    if (!text || text.length > 4000) throw new ApiError(400, "text is required and must be under 4000 characters");
    const extractor = await getExtractor();
    const output = await extractor(text, { pooling: "mean", normalize: true });
    const embedding = Array.from(output.data);
    if (embedding.length !== 384) throw new Error(`Expected 384 dimensions, received ${embedding.length}`);
    return NextResponse.json({ embedding, model: "Xenova/all-MiniLM-L6-v2", dimensions: embedding.length });
  } catch (error) { return toResponse(error); }
}
