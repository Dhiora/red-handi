import mongoose from 'mongoose';
export async function transaction(fn){const session=await mongoose.startSession();try{let result;await session.withTransaction(async()=>{result=await fn(session)});return result}finally{await session.endSession()}}
export async function connectDb(uri){await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});}
