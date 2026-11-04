import { LoginAttempt } from '@/lib/models';

export async function allowAdminAction(admin, action, maximum, duration) {
  const now = new Date();
  const counter = await LoginAttempt.findOneAndUpdate({ key: `${action}:${admin._id}` }, [
    { $set: {
      attempts: { $add: [{ $cond: [{ $gt: ['$expiresAt', now] }, '$attempts', 0] }, 1] },
      expiresAt: { $cond: [{ $gt: ['$expiresAt', now] }, '$expiresAt', new Date(Date.now() + duration)] },
    } },
  ], { upsert: true, returnDocument: 'after', updatePipeline: true });
  return counter.attempts <= maximum;
}
