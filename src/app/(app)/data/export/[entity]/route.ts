// CSV export for onboarding. ?template=1 returns the header row only,
// the same columns the import expects, so exports double as templates.

import { exportEntityCsv } from "@/lib/data-transfer";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity } = await params;
  const template = new URL(request.url).searchParams.has("template");
  const csv = await exportEntityCsv(entity, template);
  if (csv === null) {
    return new Response("Unknown entity", { status: 404 });
  }
  const filename = `${entity}${template ? "-template" : ""}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
