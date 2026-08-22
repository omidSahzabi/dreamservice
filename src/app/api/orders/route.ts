export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const draft = await prisma.order.create({
    data: {
      client_id: session.user.id,
      type: 'WEBSITE', // placeholder, updated on step 0
      status: 'DRAFT',
      budget_range: '',
      current_step: 0,
    },
  });

  return NextResponse.json(draft, { status: 201 });
}