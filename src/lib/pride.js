import connectDB from '@/server/config/database';
import { PrideAchievement, SeedState, SiteContent } from '@/lib/models';
import { getSeed } from '@/lib/db';
import { PRIDE_SORT, pridePage, seedPrideRecords } from './pride-core.mjs';

export async function seedOurPride() {
  await connectDB();
  const [source, current] = await Promise.all([getSeed(), SiteContent.findOne({ key: 'public' }).lean()]);
  await seedPrideRecords(PrideAchievement, SeedState, source.achievers, current?.content?.achievers);
}
export async function getPride({ page = '1', limit = 9, admin = false, search = '' } = {}) {
  await seedOurPride();
  const filter = admin ? {} : { isPublished: true };
  if (admin && search) {
    const escaped = search.slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['name', 'achievement', 'title', 'description', 'className'].map((key) => ({ [key]: { $regex: escaped, $options: 'i' } }));
  }
  const total = await PrideAchievement.countDocuments(filter);
  const pagination = pridePage(page, total, limit);
  const items = await PrideAchievement.find(filter).sort(PRIDE_SORT).skip((pagination.page - 1) * limit).limit(limit).lean();
  return { ...pagination, items: JSON.parse(JSON.stringify(items)) };
}
