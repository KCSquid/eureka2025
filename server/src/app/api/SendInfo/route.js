import { NextResponse } from "next/server";
import { setFEN, getFEN } from "../../store/fenStore";

export async function POST(request) {
  try {
    const body = await request.json();
    console.log("Player One data received:", body);

    if (body.fen) {
      setFEN(body.fen);
      console.log("FEN updated to:", body.fen);
    }

    return NextResponse.json({
      message: "Player One data received",
      data: body,
      currentFEN: getFEN(),
    });
  } catch (error) {
    console.error("Error in playerOne POST route:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
