export async function queryNotionDatabase(databaseId, options = {}) {
  const token = process.env.NOTION_TOKEN || process.env.NOTION_SECRET || process.env.NOTION_API_KEY;
  if (!token) throw new Error("NOTION_TOKEN/NOTION_SECRET ausente.");

  const body = { page_size: options.page_size ?? 100 };
  if (options.start_cursor) body.start_cursor = options.start_cursor;

  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Erro ao consultar Notion.");
  return data;
}
