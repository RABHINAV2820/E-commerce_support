import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body as { message: string };

    const url = process.env.GPT5_API_URL;
    const key = process.env.GPT5_API_KEY;

    if (!url || !key) {
      return new Response(
        JSON.stringify({ error: "GPT-5 API not configured" }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`
      },
      body: JSON.stringify({ message })
    });

    const data = await r.json();
    return new Response(JSON.stringify(data), {
      status: r.ok ? 200 : r.status,
      headers: { "content-type": "application/json" }
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

