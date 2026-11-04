import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { hashPassword } from '../src/lib/password.mjs';
import { PrideAchievement } from '../src/lib/pride-model.mjs';
import { seedPrideRecords } from '../src/lib/pride-core.mjs';

const uri = process.env.MONGODB_URI;
const username = (process.env.ADMIN_INITIAL_USERNAME || '').trim().toLowerCase();
const password = process.env.ADMIN_INITIAL_PASSWORD;
async function main() {
  if (!uri || !username || !password) throw new Error('Set MONGODB_URI, ADMIN_INITIAL_USERNAME and ADMIN_INITIAL_PASSWORD in .env.local.');
  if (!/^[a-z0-9._-]{4,64}$/.test(username)) throw new Error('Username must be 4-64 lowercase letters, digits, dot, dash or underscore');
  if (password.length < 16) throw new Error('Admin password must be at least 16 characters');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const adminSchema = new mongoose.Schema({ username:String,passwordHash:String,role:String,active:Boolean,sessionVersion:Number },{timestamps:true});
  const siteSchema = new mongoose.Schema({key:String,content:mongoose.Schema.Types.Mixed,revision:Number},{timestamps:true,minimize:false});
  const stateSchema = new mongoose.Schema({key:{type:String,unique:true,required:true}},{timestamps:true});
  const docSchema = new mongoose.Schema({}, {strict:false,timestamps:true});
  const Admin = mongoose.models.AdminUser || mongoose.model('AdminUser',adminSchema);
  const Site = mongoose.models.SiteContent || mongoose.model('SiteContent',siteSchema);
  const State = mongoose.models.SeedState || mongoose.model('SeedState',stateSchema);
  const Gallery = mongoose.models.Gallery || mongoose.model('Gallery',docSchema);
  const Cbse = mongoose.models.CbseDocument || mongoose.model('CbseDocument',docSchema);
  const Circular = mongoose.models.Circular || mongoose.model('Circular',docSchema);
  const existing = await Admin.findOne({username});
  if (process.argv.includes('--reset-password')) {
    if (!existing || !existing.active || existing.role !== 'admin') throw new Error('Only an active administrator can have its password reset');
    existing.passwordHash=hashPassword(password);existing.sessionVersion=(existing.sessionVersion||0)+1;await existing.save();
    console.log('Password reset; previous sessions invalidated.');
  } else if (!existing) {
    if (await Admin.exists({role:'admin'})) throw new Error('Another administrator exists. Provisioning a second account automatically is disabled.');
    await Admin.create({username,passwordHash:hashPassword(password),role:'admin',active:true,sessionVersion:1});
    console.log('Administrator provisioned.');
  } else { console.log('Administrator already exists; password unchanged.'); }
  const source = JSON.parse(await fs.readFile(path.join(process.cwd(),'data','seed-content.json'),'utf8'));
  await Site.updateOne({key:'public'},{$setOnInsert:{key:'public',content:source,revision:1}},{upsert:true});
  const currentSite = await Site.findOne({key:'public'}).lean();
  await seedPrideRecords(PrideAchievement, State, source.achievers, currentSite?.content?.achievers);
  const entries = [
    ['galleries',Gallery,(source.albums||[]).map((a)=>({title:a.title,photos:a.images.map((url)=>({originalName:path.basename(url),url,fileName:'',mimeType:'image/jpeg'}))}))],
    ['cbse',Cbse,(source.documents||[]).map((d)=>({title:d.title,description:'',originalName:path.basename(decodeURIComponent(d.url)),fileName:'',url:d.url,mimeType:'application/pdf'}))],
    ['circulars',Circular,[]], // No circulars in the original ZIP; admin will publish real ones.
  ];
  for (const [key,Model,items] of entries) {
    const marker = await State.findOne({key});
    if (!marker) {if(items.length) await Model.insertMany(items);await State.create({key});console.log(`Seeded ${items.length} ${key}.`);}
  }
  console.log('Seed completed. No existing website content was overwritten.');
}
main().catch(()=>{console.error('Seed failed: verify MongoDB connectivity, environment variables and administrator policy.');process.exitCode=1;}).finally(()=>mongoose.disconnect().catch(()=>{}));
