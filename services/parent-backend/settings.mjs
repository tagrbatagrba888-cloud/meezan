// Effective report controls. Missing/unversioned settings pause all reports.
export const REPORT_TYPES=['exam_result','homework_result','homework_published','homework_unsolved'];
export const CHANNELS=['inSite','email','whatsapp','telegram'];
export function reportSettings(value){
 const valid=value?.schemaVersion===1;
 const types=Object.fromEntries(REPORT_TYPES.map(k=>[k,valid&&value.types?.[k]===true]));
 const channels=Object.fromEntries(CHANNELS.map(k=>[k,valid&&value.channels?.[k]===true]));
 return {schemaVersion:1,enabled:valid&&value.enabled===true,types,channels,unsolvedHomeworkDelayHours:48,historyPolicy:'future_only'};
}
export const settingsDocument='parent_report_settings/global';
