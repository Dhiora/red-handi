import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
const lan=process.env.HOST_LAN==='1';
export default defineConfig({plugins:[react()],server:{host:lan?true:'127.0.0.1',port:5173,strictPort:true,...(lan?{allowedHosts:true}:{}),proxy:{'/api':'http://127.0.0.1:4000'}},build:{outDir:'dist'}});
