import { eventIcs } from '../../../../../lib/calendar';
import type { TeamEvent } from '../../../../../lib/content-types';
import { serverGet } from '../../../../../lib/server-api';
import { absoluteUrl } from '../../../../../lib/structured-data';

/** "Adicionar à agenda" (D4, DT-081): arquivo .ics do evento público, sem dado de quem baixa. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { slug } = await params;
  const event = await serverGet<TeamEvent>(`/public/events/${encodeURIComponent(slug)}`, 30);

  if (event === null) {
    return new Response('Evento não encontrado.', { status: 404 });
  }

  return new Response(eventIcs(event, absoluteUrl(`/eventos/${event.slug}`)), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
      'Cache-Control': 'public, max-age=300'
    }
  });
}
