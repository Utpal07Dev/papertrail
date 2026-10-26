import { readFileSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

function buildPreviewDocument() {
  const projectRoot = process.cwd();
  const htmlPath = path.join(projectRoot, "frontend", "index.html");
  const scriptPath = path.join(projectRoot, "frontend", "app.js");
  const applicationScript = readFileSync(scriptPath, "utf8").replace(
    /<\/script/gi,
    "<\\/script",
  );

  return readFileSync(htmlPath, "utf8")
    .replace(
      '<meta name="api-base-url" content="" />',
      '<meta name="api-base-url" content="/api" />',
    )
    .replace(
      '<script src="app.js" defer></script>',
      `<script type="module">${applicationScript}</script>`,
    );
}

/**
 * Platform preview only.
 *
 * The deliverable itself lives in frontend/ and backend/. Reading those exact
 * files here keeps the managed Next.js preview visually synchronized without
 * replacing the requested FastAPI architecture.
 */
export default function HomePage() {
  return (
    <main className="h-screen w-full overflow-hidden bg-[#f6f4ed]">
      <iframe
        className="h-full w-full border-0"
        srcDoc={buildPreviewDocument()}
        title="PaperVault application preview"
      />
    </main>
  );
}
