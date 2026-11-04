import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  achievement: { type: String, required: true, trim: true, maxlength: 240 },
  title: { type: String, default: '', maxlength: 240 },
  description: { type: String, default: '', maxlength: 2000 },
  className: { type: String, default: '', maxlength: 80 },
  achievementYear: { type: Number, min: 1900, max: 2200, default: null },
  image: { type: new mongoose.Schema({ url: String, fileName: String, originalName: String, mimeType: String }, { _id: false }), default: null },
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null },
  seedKey: { type: String },
  seedOrder: { type: Number, default: 0 },
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ isPublished: 1, publishedAt: -1, seedOrder: 1, _id: -1 });
schema.index({ seedKey: 1 }, { unique: true, sparse: true });
export const PrideAchievement = mongoose.models.PrideAchievement || mongoose.model('PrideAchievement', schema);
