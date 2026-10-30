import "server-only";
import {prisma} from "@/lib/prisma";
import {sendOrderStatusSms} from "@/lib/auth/sms";
import type {Principal} from "@/lib/auth/authorization";
import {authorizeMutation} from "@/lib/auth/mutation";

export async function deliverOrderNotification(id: string, actor?: Principal) {
  // A committed claim is never automatically reclaimed: a process/network failure
  // after provider acceptance cannot safely be retried without provider deduplication.
  const now = new Date();
  const claim = (db: Pick<typeof prisma, "orderStatusHistory">) => db.orderStatusHistory.updateMany({where: {
    id, notificationState: {in: ["PENDING", "FAILED"]}, notificationAttempts: {lt: 3}, notificationNextAttemptAt: {lte: now},
  }, data: {notificationState: "CLAIMED", notificationAttempts: {increment: 1}, notificationUpdatedAt: now}});
  // A retry is authorized at its durable claim. Delivery stays outside the
  // transaction; a committed claim is never reclaimed after an ambiguous send.
  const claimed = actor ? await prisma.$transaction(async tx => {
    await authorizeMutation(tx, actor, true);
    return claim(tx);
  }, {isolationLevel: "ReadCommitted"}) : await claim(prisma);
  if (claimed.count !== 1) return false;
  const history = await prisma.orderStatusHistory.findUnique({where: {id}, select: {order: {select: {client: {select: {contact: true, contactVerifiedAt: true}}}}}});
  const phone = history?.order.client.contact;
  // Only account identity verified through the real OTP flow is eligible.
  const verified = phone && /^09\d{9}$/.test(phone) && history?.order.client.contactVerifiedAt;
  let state = "SKIPPED";
  if (verified && phone) {
    try { state = await sendOrderStatusSms(phone); }
    catch { state = "UNKNOWN"; }
  }
  await prisma.orderStatusHistory.updateMany({where: {id, notificationState: "CLAIMED"}, data: {
    notificationState: state, notificationUpdatedAt: new Date(), notificationNextAttemptAt: new Date(Date.now() + 60000),
  }});
  return true;
}
