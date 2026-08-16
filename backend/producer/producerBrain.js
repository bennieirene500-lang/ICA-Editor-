import educational from '../knowledge/educational.json' with { type: 'json' };
import sales from '../knowledge/sales.json' with { type: 'json' };
import story from '../knowledge/story.json' with { type: 'json' };
import motivation from '../knowledge/motivation.json' with { type: 'json' };
const PROFILES=Object.freeze({educational,sales,story,motivation});
export function getProducerProfile(goal){const key=String(goal||'').trim().toLowerCase();if(!PROFILES[key])throw new Error('Please choose what kind of video you are creating.');return structuredClone(PROFILES[key]);}
export function createProducerDecision({goal}){const profile=getProducerProfile(goal);return{version:3,goal:profile.id,label:profile.label,purpose:profile.purpose,pacing:profile.pacing,captions:profile.captions,camera:profile.camera,principles:profile.principles};}
