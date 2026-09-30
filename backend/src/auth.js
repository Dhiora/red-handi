import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {Session,User} from './models.js';
import {fail} from './policy.js';
export const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
export const secret=()=>crypto.randomBytes(32).toString('hex');
export async function authenticate(req,res,next){try{const token=req.cookies.rh_session;if(!token)return next();const session=await Session.findOne({tokenHash:hash(token),expiresAt:{$gt:new Date()}});if(session)req.user=await User.findOne({_id:session.userId,active:true}).lean();next()}catch(e){next(e)}}
export function requireAuth(req,res,next){if(!req.user)return res.status(401).json({error:'Please sign in to your admin account.'});next()}
export function requireSuper(req,res,next){if(req.user?.role!=='super_admin')return res.status(403).json({error:'Super admin access is required.'});next()}
export function outletScope(req,id){if(req.user.role!=='super_admin'&&String(req.user.outletId)!==String(id))fail(403,'You do not have access to this outlet.');return id}
export async function login(req,res){const email=String(req.body.email||'').toLowerCase().trim();const user=await User.findOne({email,active:true}).select('+passwordHash');if(!user||!await bcrypt.compare(String(req.body.password||''),user.passwordHash))fail(401,'Email or password is incorrect.');const token=secret();await Session.create({tokenHash:hash(token),userId:user.id,expiresAt:new Date(Date.now()+8*3600000)});res.cookie('rh_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:8*3600000,path:'/'});res.json({user:{id:user.id,email:user.email,name:user.name,role:user.role,outletId:user.outletId}})}
