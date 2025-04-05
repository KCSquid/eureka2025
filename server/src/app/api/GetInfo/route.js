import { NextResponse } from "next/server";
import { setFEN, getFEN } from "../../store/fenStore";

export async function GET() {
  try {
    const currentFEN = getFEN();
    console.log("Player One record requested, current FEN:", currentFEN);
    return NextResponse.json({
      score: 0,
      fen: currentFEN,
    });
  } catch (error) {
    console.error("Error in playerOneRec GET route:", error);
    return NextResponse.json(
      { error: "Failed to fetch player one record" },
      { status: 500 },
    );
  }
}
