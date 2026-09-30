import bcrypt from 'bcryptjs';
import {Restaurant,Outlet,MenuItem,Ingredient,User} from './models.js';
export async function seed(){
 if(await Restaurant.countDocuments()===0){
 const r=await Restaurant.create({name:'RedHandi'});
 const o=await Outlet.create({restaurantId:r.id,name:'RedHandi · KPHB',address:'KPHB, Hyderabad — update your pickup address',phone:'',areas:['KPHB','JNTUH','Pragathi Nagar'],active:process.env.NODE_ENV!=='production',deliveryEnabled:false,cancellationPercent:10});
 const ingredients=await Ingredient.insertMany([{name:'Basmati rice',unit:'kg',stock:30,lowAt:5},{name:'Chicken',unit:'kg',stock:20,lowAt:4},{name:'Biryani masala',unit:'kg',stock:5,lowAt:1},{name:'Vegetables',unit:'kg',stock:10,lowAt:2},{name:'Curd',unit:'kg',stock:10,lowAt:2},{name:'Takeaway boxes',unit:'pcs',stock:150,lowAt:25}].map(i=>({...i,outletId:o.id})));
 const recipe=(rice,chicken,veg,boxes=1)=>[{ingredientId:ingredients[0].id,quantity:rice},...(chicken?[{ingredientId:ingredients[1].id,quantity:chicken}]:[]),{ingredientId:ingredients[2].id,quantity:.025*boxes},...(veg?[{ingredientId:ingredients[3].id,quantity:veg}]:[]),{ingredientId:ingredients[5].id,quantity:boxes}];
 await MenuItem.insertMany([
 {name:'Chicken Dum Biryani',description:'Aromatic basmati, tender chicken, and the unmistakable warmth of dum spices.',category:'Biryani',price:24900,serves:'Serves 1',tag:'THE SIGNATURE',recipe:recipe(.25,.25,0)},
 {name:'Chicken Family Handi',description:'One generous handi. A table full of happy people. Made for sharing.',category:'Family packs',price:79900,serves:'Serves 3–4',tag:'BETTER TOGETHER',recipe:recipe(.9,.9,0,3)},
 {name:'Vegetable Dum Biryani',description:'Seasonal vegetables and fragrant rice, layered with our signature spices.',category:'Biryani',price:19900,serves:'Serves 1',tag:'VEG FAVOURITE',veg:true,recipe:recipe(.25,0,.2)},
 {name:'Chicken Double Masala',description:'For the ones who like their biryani with a little extra fire.',category:'Biryani',price:27900,serves:'Serves 1',tag:'TURN UP THE HEAT',recipe:recipe(.25,.3,0)},
 {name:'Cooling Raita',description:'Creamy curd with a refreshing crunch. Your biryani’s best friend.',category:'Sides & drinks',price:3900,serves:'150 ml',tag:'ON THE SIDE',veg:true,image:'',recipe:[{ingredientId:ingredients[4].id,quantity:.15}]},
 {name:'Weekend Special Handi',description:'A little something special from our kitchen. Back on the menu soon.',category:'Family packs',price:89900,serves:'Serves 3–4',tag:'WORTH THE WAIT',available:false,recipe:recipe(1,1,0,3)}
 ].map(i=>({...i,outletId:o.id})));
 }
 const email=(process.env.SUPER_ADMIN_EMAIL||'admin@redhandi.com').toLowerCase();
 if(process.env.BOOTSTRAP_PASSWORD&&!await User.exists({email})){await User.create({email,name:'RedHandi Owner',role:'super_admin',passwordHash:await bcrypt.hash(process.env.BOOTSTRAP_PASSWORD,12)});}
}
