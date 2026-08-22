export async function POST(req: Request, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { order_id: parseInt(params.id) },
  });

  // Server-side validation
  const result = orderServerSchema.safeParse(order);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  const submitted = await prisma.order.update({
    where: { order_id: parseInt(params.id) },
    data: {
      status: 'SUBMITTED',
      submitted_at: new Date(),
    },
  });
   await notifyTeam(submitted);

  return NextResponse.json(submitted);
}