import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { ApiError, toResponse } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireRole("adopter");
    const result = await query(
      `SELECT user_id, home_type, has_children, has_other_pets, experience,
              activity_level, lifestyle_text, preferred_species, preferred_size
       FROM adopter_profiles WHERE user_id = $1`,
      [user.id]
    );
    return NextResponse.json({ profile: result.rows[0] ?? null });
  } catch (error) { return toResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireRole("adopter");
    const body = await request.json();
    const homeType = ["apartment","house_small_yard","house_large_yard","farm"].includes(body.home_type) ? body.home_type : null;
    const experience = ["first_time","some","experienced"].includes(body.experience) ? body.experience : null;
    const activity = Number(body.activity_level);
    const lifestyle = String(body.lifestyle_text ?? "").trim().slice(0, 4000);
    if (!homeType || !experience || !Number.isInteger(activity) || activity < 1 || activity > 5) {
      throw new ApiError(400, "Invalid home type, experience, or activity level");
    }
    await withTransaction(user.id, async (client) => {
      await client.query(
        `INSERT INTO adopter_profiles
          (user_id, home_type, has_children, has_other_pets, experience, activity_level, lifestyle_text, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,now())
         ON CONFLICT (user_id) DO UPDATE SET home_type=EXCLUDED.home_type,
          has_children=EXCLUDED.has_children, has_other_pets=EXCLUDED.has_other_pets,
          experience=EXCLUDED.experience, activity_level=EXCLUDED.activity_level,
          lifestyle_text=EXCLUDED.lifestyle_text, updated_at=now()`,
        [user.id, homeType, Boolean(body.has_children), Boolean(body.has_other_pets), experience, activity, lifestyle]
      );
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return toResponse(error); }
}
