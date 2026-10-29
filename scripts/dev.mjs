import {spawn} from 'node:child_process';
import os from 'node:os';
const lan=process.argv.includes('--lan');
const npm=process.platform==='win32'?'npm.cmd':'npm';
const env={...process.env,...(lan?{HOST_LAN:'1'}:{})};
if(lan){
 const ips=Object.values(os.networkInterfaces()).flat().filter(net=>net&&net.family==='IPv4'&&!net.internal).map(net=>net.address);
 console.log(ips.length?`Wi-Fi: open ${ips.map(ip=>`http://${ip}:5173/`).join(' or ')} on devices connected to this network.`:'HOST_LAN is on, but this computer has no network address.');
}
const run=dir=>spawn(npm,['run','dev','--prefix',dir],{stdio:'inherit',env});
const jobs=[run('frontend')];
if(process.env.FRONTEND_ONLY!=='true')jobs.push(run('backend'));
function stop(){for(const p of jobs)p.kill('SIGTERM');process.exit()}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
