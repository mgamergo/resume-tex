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
} catch {
  process.exitCode = 1;
}
