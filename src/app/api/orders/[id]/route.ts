export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { current_step, form_data } = body;

  // Map form data to schema
  const { meta, budget_min, budget_max, type, description } = mapFormDataToOrder(form_data);

  const updated = await prisma.order.update({
    where: { order_id: parseInt(params.id) },
    data: {
      type,
      budget_min,
      budget_max,
      description,
      meta,
      current_step,
      updated_at: new Date(),
    },
  });

  return NextResponse.json(updated);
}