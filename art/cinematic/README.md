# Silent AI restaurant video

Branch: `feat/silent-waiter-video`.

## Status

The user explicitly rejected video rendered from the Blender models. The Blender render was stopped. No Blender movie has been installed or activated. Generate the final clips from `frontend/public/cinema/waiter-keyframe.png`, the detailed AI artwork based on the supplied restaurant blueprint.

Runway is available but not connected. No AI video has been generated or paid video job submitted. This is a connection blocker, not finished video work.

The ordering page now uses a silent HTML video player with a static artwork fallback. It does not import the Three.js restaurant renderer. While final media is pending, it displays the detailed keyframe with working order controls. There is no audio button or speech synthesis.

## Welcome prompt

Use the provided image as the visual identity reference. Premium stylized 3D animated film quality, a warm Red Handi restaurant with red upholstery, wooden furniture, copper handi pots, dark green kitchen tiles, and a friendly bearded chef cooking biryani behind the counter. Preserve the young adult Indian waiter's face, red cap and polo, black Red Handi apron, hair, expressive eyes and detailed clothing. At seated customer's eye level, he walks naturally from the counter toward our table, stops comfortably, makes eye contact, smiles and tilts his head in greeting. He holds an order pad in one hand and makes a small welcoming gesture with the other, inviting us to order. Finish in an attentive waiting pose. Real articulated body motion and planted footsteps, stable face and branding, subtly rising steam. A steady camera, not an animated zoom of a still image. No audio, dialogue, lip-sync, subtitles, baked-in UI, or text overlays. 8–10 seconds, 16:9, 1080p, MP4.

## Confirmation prompt

Same reference character, identity, clothing, restaurant and customer-eye-level framing as the welcome. The waiter looks down and makes a short note on his pad, looks back at the customer, smiles and nods. He takes the order slip, turns naturally and walks back to the chef at the kitchen counter. Keep the paper blank; the website separately displays the actual order number. Natural foot contact and arm motion, detailed face and clothing, stable environment. No audio, dialogue, lip-sync, subtitles, baked-in UI, or customer details. 8–10 seconds, 16:9, 1080p, MP4.

## Integration

Save the approved videos as `frontend/public/cinema/welcome.mp4` and `confirmation.mp4`. An optional attentive idle loop can be added. Strip audio tracks; use H.264 and fast-start metadata. Add the local paths to `manifest.json` and enable it only after both actual films exist. Use separate portrait clips when available. Menu access must remain immediate during playback; show the confirmation only after a successful server response. Keep order number and receipt in live HTML.

Video failures or reduced-motion preferences leave a still with working ordering controls. They never fall back to live 3D. Verify desktop/mobile, autoplay, pause/replay, successful-order routing, silent tracks and network failure when media is supplied.
