export const dynamic = "force-dynamic";

const VIRADA_DATA_URL = "https://amplify-club-retencao.netlify.app/dashboard-data.json";

export async function GET() {
  try {
    const response = await fetch(VIRADA_DATA_URL, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return Response.json(
        { error: `Erro ao carregar dashboard da virada: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error?.message || "Erro ao carregar dashboard da virada." },
      { status: 500 }
    );
  }
}
