import { extractPdf } from "../lib/server/pdf-extract";
let input = Buffer.alloc(0);
try {
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (input.length + bytes.length > 10_485_760)
      throw new Error("PDF input limit");
    input = Buffer.concat([input, bytes]);
  }
  const result = await extractPdf(input);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(
    JSON.stringify({
      event: "pdf_extract_error",
      name: error instanceof Error ? error.name : "UnknownError",
      message:
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Unknown PDF extraction failure",
    }),
  );
  process.exitCode = 1;
}
