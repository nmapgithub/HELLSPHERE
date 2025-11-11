import { NextResponse } from "next/server";
import { spawn } from "child_process";

type HttpServerProcess = ReturnType<typeof spawn> | null;

let httpServerProcess: HttpServerProcess = null;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const port = typeof body.port === "number" ? body.port : 1339;

  if (httpServerProcess && !httpServerProcess.killed) {
    return NextResponse.json({ status: "already_running", port });
  }

  try {
    const process = spawn("python3", ["start_http_server.py", "--port", String(port)], {
      cwd: "/root/geointel",
      stdio: "ignore",
      detached: true,
    });

    process.unref();
    httpServerProcess = process;

    return NextResponse.json({ status: "started", port });
  } catch (error) {
    console.error("Failed to launch HTTP server", error);
    return NextResponse.json(
      { status: "error", message: (error as Error).message },
      { status: 500 },
    );
  }
}
