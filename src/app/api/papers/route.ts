import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Read-only adapter for the platform's Next.js visual preview.
 * The real endpoint is backend/app/routers/papers.py and uses SQLAlchemy.
 */
export function GET() {
  return NextResponse.json([]);
}

export function POST() {
  return NextResponse.json(
    {
      detail:
        "Uploads are handled by the FastAPI application. Follow README.md to run the complete stack.",
    },
    { status: 503 },
  );
}
