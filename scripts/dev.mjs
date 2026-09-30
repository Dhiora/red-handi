import {spawn} from 'node:child_process';
const npm=process.platform==='win32'?'npm.cmd':'npm';
const run=dir=>spawn(npm,['run','dev','--prefix',dir],{stdio:'inherit'});
const jobs=[run('frontend')];
if(process.env.FRONTEND_ONLY!=='true')jobs.push(run('backend'));
function stop(){for(const p of jobs)p.kill('SIGTERM');process.exit()}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
