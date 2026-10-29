import {z} from 'zod';
import {fail} from './policy.js';
export const id=z.string().regex(/^[a-f\d]{24}$/i);
export const money=z.number().int().min(0).max(100000000);
export const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const outletPatch=z.object({name:z.string().trim().min(2).max(100),address:z.string().trim().min(5).max(400),phone:z.string().max(20),areas:z.array(z.string().trim().min(1).max(80)).min(1).max(20),active:z.boolean(),deliveryEnabled:z.boolean(),pickupEnabled:z.boolean(),deliveryFee:money,opening:time,closing:time,leadMinutes:z.number().int().min(15).max(240),slotCapacity:z.number().int().min(1).max(200),cancellationPercent:z.number().min(0).max(100),gstEnabled:z.boolean(),gstin:z.string().trim().toUpperCase().max(15),gstRate:z.number().min(0).max(100),pricesIncludeGst:z.boolean()}).partial();
export const menuSchema=z.object({name:z.string().trim().min(2).max(100),description:z.string().trim().max(350),category:z.enum(['Biryani','Family packs','Sides & drinks']),price:money.refine(v=>v>=100,'Price must be at least ₹1.'),available:z.boolean(),veg:z.boolean(),serves:z.string().max(40),tag:z.string().max(40),image:z.enum(['/food.jpg','']),recipe:z.array(z.object({ingredientId:id,quantity:z.number().positive().max(10000)})).max(30)});
export const ingredientSchema=z.object({outletId:id,name:z.string().trim().min(2).max(80),unit:z.enum(['kg','L','pcs']),stock:z.number().min(0).max(100000),lowAt:z.number().min(0).max(100000)});
export function validateOutlet(merged){if(merged.gstEnabled&&(!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(merged.gstin||'')||!merged.gstRate))fail(400,'Add a valid GSTIN and a positive GST rate before enabling GST.');if(merged.closing<=merged.opening)fail(400,'Closing time must be after opening time on the same day.');}
export const adjustSchema=z.object({quantity:z.number().positive().max(100000),type:z.enum(['purchase','wastage','adjustment']),note:z.string().trim().min(3).max(200)});
