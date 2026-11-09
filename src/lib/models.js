import mongoose from "mongoose";
export { PrideAchievement } from "./pride-model.mjs";

const photoSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    fileName: { type: String, default: "" },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
  },
  { timestamps: true },
);

const gallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", maxlength: 3000 },
    photos: { type: [photoSchema], default: [] },
  },
  { timestamps: true, optimisticConcurrency: true },
);

gallerySchema.index({ createdAt: -1 });

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    originalName: { type: String, required: true },
    fileName: { type: String, default: "" },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);

documentSchema.index({ createdAt: -1 });

export const Gallery =
  mongoose.models.Gallery || mongoose.model("Gallery", gallerySchema);
export const CbseDocument =
  mongoose.models.CbseDocument ||
  mongoose.model("CbseDocument", documentSchema);

const siteSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    revision: { type: Number, default: 1 },
  },
  { timestamps: true, minimize: false },
);
const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin"], default: "admin" },
    active: { type: Boolean, default: true },
    sessionVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);
const loginAttemptSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const auditSchema = new mongoose.Schema(
  {
    adminId: { type: String, required: true },
    action: { type: String, required: true },
    summary: { type: String, default: "" },
  },
  { timestamps: true },
);
auditSchema.index({ createdAt: -1 });
export const SiteContent =
  mongoose.models.SiteContent || mongoose.model("SiteContent", siteSchema);
export const AdminUser =
  mongoose.models.AdminUser || mongoose.model("AdminUser", adminSchema);
export const LoginAttempt =
  mongoose.models.LoginAttempt ||
  mongoose.model("LoginAttempt", loginAttemptSchema);
export const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditSchema);
const circularSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, default: "", maxlength: 3000 },
    url: { type: String, default: "" },
    fileName: { type: String, default: "" },
    originalName: { type: String, default: "" },
    publishedAt: { type: Date, default: Date.now },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);
circularSchema.index({ pinned: -1, publishedAt: -1 });
const seedStateSchema = new mongoose.Schema(
  { key: { type: String, unique: true, required: true } },
  { timestamps: true },
);
export const Circular =
  mongoose.models.Circular || mongoose.model("Circular", circularSchema);
export const SeedState =
  mongoose.models.SeedState || mongoose.model("SeedState", seedStateSchema);

const previewDraftSchema = new mongoose.Schema(
  {
    adminId: { type: String, required: true },
    sessionId: { type: String, required: true },
    sequence: { type: Number, default: 0 },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, minimize: false },
);
previewDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
previewDraftSchema.index({ adminId: 1, sessionId: 1 }, { unique: true });
export const PreviewDraft =
  mongoose.models.PreviewDraft ||
  mongoose.model("PreviewDraft", previewDraftSchema);
