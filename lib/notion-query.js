export async function queryNotionDatabase(databaseId, options = {}) {
  const token = process.env.NOTION_TOKEN || process.env.NOTION_SECRET || process.env.NOTION_API_KEY;
  if (!token) throw new Error("NOTION_TOKEN/NOTION_SECRET ausente.");

  const body = { page_size: options.page_size ?? 100 };
  if (options.start_cursor) body.start_cursor = options.start_cursor;
  if (options.filter) body.filter = options.filter;
  if (options.sorts) body.sorts = options.sorts;

  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Erro ao consultar Notion.");
  return data;
}
