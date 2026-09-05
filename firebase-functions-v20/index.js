"use strict";

const {onRequest}=require("firebase-functions/v2/https");
const {defineSecret}=require("firebase-functions/params");
const {initializeApp}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getFirestore}=require("firebase-admin/firestore");
const crypto=require("crypto");
const OpenAI=require("openai");

initializeApp();
const OPENAI_API_KEY=defineSecret("OPENAI_API_KEY");

function bearer(req){const h=String(req.headers.authorization||"");return h.startsWith("Bearer ")?h.slice(7):""}
function cleanJson(text){return String(text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"")}
function clamp(n,a,b){n=Number(n)||0;return Math.max(a,Math.min(b,n))}
function arr(v){return Array.isArray(v)?v:[]}
function baseLanguageCode(code){return String(code||"").trim().toLowerCase().split(/[-_]/)[0]||""}
function normaliseLanguageUse(x,b){
  const raw=x&&typeof x==="object"?x:{};
  const evidence=b?.languageEvidence&&typeof b.languageEvidence==="object"?b.languageEvidence:{};
  const classification=["target","mostly_target_mixed","mixed","mostly_wrong","wrong","uncertain"].includes(raw.classification)?raw.classification:(evidence.classification||"uncertain");
  const compliance=raw.compliance===null||raw.compliance===undefined?null:Math.round(clamp(raw.compliance,0,100));
  return {
    classification,
    compliance,
    expectedTargetLanguage:baseLanguageCode(raw.expectedTargetLanguage||b?.targetLanguage),
    detectedPrimaryLanguage:baseLanguageCode(raw.detectedPrimaryLanguage||""),
    targetLanguageShare:raw.targetLanguageShare===null||raw.targetLanguageShare===undefined?null:clamp(raw.targetLanguageShare,0,1),
    sourceLanguageShare:raw.sourceLanguageShare===null||raw.sourceLanguageShare===undefined?null:clamp(raw.sourceLanguageShare,0,1),
    untranslatedSourcePhrases:arr(raw.untranslatedSourcePhrases).map(String).slice(0,5),
    notes:arr(raw.notes).map(String).slice(0,4)
  };
}
function normalise(x,model,b){
  const score=Math.round(clamp(x.meaningTransfer,0,100));
  const languageUse=normaliseLanguageUse(x.targetLanguageUse,b);
  const evidenceWrong=Boolean(b?.languageEvidence?.deterministicWrong);
  const wrongTargetLanguage=Boolean(x.wrongTargetLanguage)||evidenceWrong||languageUse.classification==="mostly_wrong"||languageUse.classification==="wrong";
  if(evidenceWrong){
    languageUse.classification="mostly_wrong";
    languageUse.expectedTargetLanguage=baseLanguageCode(b?.targetLanguage);
    languageUse.detectedPrimaryLanguage=languageUse.detectedPrimaryLanguage||baseLanguageCode(b?.sourceLanguage);
    if(languageUse.compliance===null||languageUse.compliance===undefined){languageUse.compliance=Math.round(clamp((Number(b?.languageEvidence?.targetScriptShare)||0)*100,0,100));}
    languageUse.targetLanguageShare=Number.isFinite(Number(b?.languageEvidence?.targetScriptShare))?clamp(b.languageEvidence.targetScriptShare,0,1):languageUse.targetLanguageShare;
    languageUse.sourceLanguageShare=Number.isFinite(Number(b?.languageEvidence?.sourceScriptShare))?clamp(b.languageEvidence.sourceScriptShare,0,1):languageUse.sourceLanguageShare;
  }
  let status=wrongTargetLanguage?"major":(["excellent","good","review","major"].includes(x.status)?x.status:(score>=90?"excellent":score>=75?"good":score>=55?"review":"major"));
  if(!wrongTargetLanguage&&languageUse.compliance!==null&&languageUse.compliance!==undefined){
    if(languageUse.compliance<70&&["excellent","good"].includes(status))status="review";
    else if(languageUse.compliance<90&&status==="excellent")status="good";
  }
  const missing=arr(x.missingOrUnclear).map(String);
  if(wrongTargetLanguage&&!missing.some(v=>/target language/i.test(v)))missing.unshift(`Wrong target language: ${baseLanguageCode(b?.targetLanguage)||"target language"} was required.`);
  return {meaningTransfer:score,status,wrongTargetLanguage,targetLanguageUse:languageUse,confidence:clamp(x.confidence||.78,0,1),meaningPreserved:arr(x.meaningPreserved).slice(0,6),missingOrUnclear:missing.slice(0,6),languageImprovements:arr(x.languageImprovements).slice(0,5),criticalDetails:arr(x.criticalDetails).slice(0,8),meaningPoints:arr(x.meaningPoints).slice(0,8),delivery:x.delivery&&typeof x.delivery==="object"?x.delivery:{rating:"Not assessed",notes:[]},shortNotes:String(x.shortNotes||"").slice(0,180),noteTip:String(x.noteTip||"").slice(0,260),improvedInterpretation:String(x.improvedInterpretation||"").slice(0,900),nextSteps:arr(x.nextSteps).slice(0,4),provider:"openai",model,assessedAt:new Date().toISOString()};
}

exports.assessAttempt=onRequest({region:"australia-southeast1",cors:true,secrets:[OPENAI_API_KEY],timeoutSeconds:60,memory:"512MiB"},async(req,res)=>{
  if(req.method==="OPTIONS"){res.status(204).send("");return}
  if(req.method!=="POST"){res.status(405).json({error:"Method not allowed"});return}
  try{
    const token=bearer(req);if(!token){res.status(401).json({error:"Sign in required"});return}
    await getAuth().verifyIdToken(token);
    const b=req.body||{};const transcript=String(b.studentTranscript||"").trim();
    if(!transcript){res.status(400).json({error:"Student transcript is required"});return}
    const model=process.env.OPENAI_ASSESSMENT_MODEL||"gpt-5.6-luna";
    const client=new OpenAI({apiKey:OPENAI_API_KEY.value()});
    const prompt=`You are the semantic assessment engine for APS NAATI CCL Practice. Assess meaning transfer, not exact wording. The sample answer is an example, never an exact answer key. Accept natural synonyms, paraphrases, different word order, and active/passive changes when meaning is preserved. Separate meaning accuracy from grammar/naturalness. Names, numbers, dates, amounts, negation, conditions, modality, speaker intent and who-did-what-to-whom are critical when present. Do not punish harmless grammar twice. Never claim an official NAATI score.

TARGET-LANGUAGE RULE — this is mandatory:
1. First identify the REQUIRED target language from Target language below and determine what language(s) the student actually used.
2. Natural borrowed terms, proper nouns, names, addresses, numbers, acronyms and commonly used loanwords do NOT by themselves make an answer wrong-language.
3. If the response is substantially in the required target language but contains a few source-language/untranslated words or short phrases, CONTINUE the full semantic assessment. Preserve the meaningTransfer score according to meaning actually transferred. Record the untranslated/source-language wording in targetLanguageUse and languageImprovements, and reduce target-language compliance rather than automatically destroying the meaning score.
4. If the response is materially mixed, still assess meaning. Mark targetLanguageUse as mixed and give specific improvement feedback.
5. If the response is PREDOMINANTLY in the source language or another wrong language rather than the required target language, set wrongTargetLanguage=true, targetLanguageUse.classification="mostly_wrong", and status="major". Do not describe it as an excellent/good interpretation even if the semantic content repeats the source accurately. meaningTransfer may reflect that the underlying meaning was understood, but this was not a valid transfer into the required target language.
6. Use supplied languageEvidence only as conservative supporting evidence. It is script-based and may be uncertain. Do not penalize reasonable code-switching or common borrowed terms solely because scripts differ.

Return ONLY valid JSON with this exact top-level shape:
{
  "meaningTransfer": 0-100 integer,
  "status": "excellent"|"good"|"review"|"major",
  "wrongTargetLanguage": true|false,
  "targetLanguageUse": {
    "classification": "target"|"mostly_target_mixed"|"mixed"|"mostly_wrong"|"uncertain",
    "compliance": 0-100 integer,
    "expectedTargetLanguage": "language code",
    "detectedPrimaryLanguage": "language code or empty string",
    "targetLanguageShare": 0-1 number or null,
    "sourceLanguageShare": 0-1 number or null,
    "untranslatedSourcePhrases": ["short exact or near-exact phrases"],
    "notes": ["short language-use notes"]
  },
  "confidence": 0-1,
  "meaningPreserved": [short specific strings],
  "missingOrUnclear": [short specific strings],
  "languageImprovements": [{"original":"student wording","improved":"natural wording","reason":"short explanation"}],
  "criticalDetails": [{"label":"detail","status":"preserved"|"missing"|"unclear","type":"name|number|date|amount|negation|condition|modality|agent|other","severity":"major"|"minor"}],
  "meaningPoints": [{"label":"one concise meaning unit","status":"preserved"|"missing"|"unclear"}],
  "delivery": {"rating":"Good|Needs practice|Not assessed","notes":["short notes"]},
  "shortNotes":"genuine interpreter shorthand, ideally 3-7 chunks separated by •, not a full sentence",
  "noteTip":"one segment-specific note-taking tip",
  "improvedInterpretation":"one natural target-language interpretation",
  "nextSteps":["specific actions"]
}

Source language: ${b.sourceLanguage}
Target language: ${b.targetLanguage}
Source segment: ${JSON.stringify(b.source||"")}
Student transcript: ${JSON.stringify(transcript)}
Sample interpretation: ${JSON.stringify(b.sampleAnswer||"")}
Accepted alternatives: ${JSON.stringify(b.acceptedAlternatives||[])}
Verified meaning units: ${JSON.stringify(b.meaningUnits||[])}
Critical details: ${JSON.stringify(b.criticalDetails||[])}
Semantic policy: ${JSON.stringify(b.semanticPolicy||{})}
Language evidence: ${JSON.stringify(b.languageEvidence||{})}
Delivery timing: ${JSON.stringify(b.delivery||{})}

Calibration: a response that clearly preserves most of the message but has awkward grammar should normally retain a strong meaning-transfer score while receiving separate language feedback. Missing one secondary detail should not collapse the score. A missing/incorrect critical detail can reduce it substantially depending on impact. Limited natural code-switching should not erase meaning credit; predominantly answering in the wrong language is a major interpretation failure.`
    const response=await client.responses.create({model,input:prompt,max_output_tokens:1600});
    const text=response.output_text||"";let parsed;
    try{parsed=JSON.parse(cleanJson(text))}catch{throw new Error("Assessment model returned invalid JSON")}
    res.json({assessment:normalise(parsed,model,b)});
  }catch(error){console.error("assessAttempt",error);res.status(500).json({error:"assessment_failed",message:error?.message||"Assessment failed"})}
});


// V21.3 — privacy-preserving student-reported "Recently Appeared" topic signals.
// Clients never read/write these collections directly. A signed-in user may maintain
// at most one current report per dialogue; aggregate counts expose no user identity.
function recentDateKey(value){
  const s=String(value||"").trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return "";
  const d=new Date(`${s}T12:00:00Z`);
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)return "";
  return s;
}
function recentDialogueId(value){
  const s=String(value||"").trim(),m=/^(dialogue|original)-(\d{3})$/.exec(s);
  if(!m)return "";
  const n=Number(m[2]),max=m[1]==="dialogue"?107:87;
  return n>=1&&n<=max?s:"";
}
function recentUserHash(uid){return crypto.createHash("sha256").update(String(uid||"")).digest("hex")}
function recentReportId(uid,dialogueId){return crypto.createHash("sha256").update(`${uid}|${dialogueId}`).digest("hex")}
function todayUtcKey(){return new Date().toISOString().slice(0,10)}
function dateDiffDays(a,b){return Math.round((Date.parse(`${b}T12:00:00Z`)-Date.parse(`${a}T12:00:00Z`))/86400000)}
async function verifiedRecentUser(req){const token=bearer(req);if(!token)throw Object.assign(new Error("Sign in required"),{status:401});return await getAuth().verifyIdToken(token)}
function recentError(res,error,label){console.error(label,error);const status=Number(error?.status)||500;res.status(status).json({error:status===401?"sign_in_required":"recent_dialogue_error",message:error?.message||"Request failed"})}

exports.reportRecentDialogue=onRequest({region:"australia-southeast1",cors:true,timeoutSeconds:30,memory:"256MiB"},async(req,res)=>{
  if(req.method==="OPTIONS"){res.status(204).send("");return}
  if(req.method!=="POST"){res.status(405).json({error:"Method not allowed"});return}
  try{
    const user=await verifiedRecentUser(req),b=req.body||{},dialogueId=recentDialogueId(b.dialogueId),reported=Boolean(b.reported);
    if(!dialogueId){res.status(400).json({error:"Invalid dialogue id"});return}
    let reportedOn=recentDateKey(b.reportedOn||todayUtcKey());
    if(reported){
      if(!reportedOn){res.status(400).json({error:"Invalid report date"});return}
      const today=todayUtcKey();
      if(dateDiffDays(today,reportedOn)>1){res.status(400).json({error:"Report date cannot be in the future"});return}
      if(dateDiffDays(reportedOn,today)>1825){res.status(400).json({error:"Report date is too old"});return}
    }
    const db=getFirestore(),reportRef=db.collection("recentDialogueReports").doc(recentReportId(user.uid,dialogueId));
    await db.runTransaction(async tx=>{
      const reportSnap=await tx.get(reportRef),old=reportSnap.exists?reportSnap.data():null;
      const oldDate=recentDateKey(old?.reportedOn),newDate=reported?reportedOn:"";
      const changes=[];
      if(oldDate&&(!reported||oldDate!==newDate))changes.push({date:oldDate,delta:-1});
      if(reported&&(!oldDate||oldDate!==newDate))changes.push({date:newDate,delta:1});

      // Aggregate by dialogue + month. This keeps Recent reads small (about 194 docs
      // per month instead of up to 194 docs per day) while retaining exact day filters.
      const refs=new Map();
      for(const c of changes){
        const month=c.date.slice(0,7),key=`${month}__${dialogueId}`;
        if(!refs.has(key))refs.set(key,{month,ref:db.collection("recentDialogueMonthly").doc(key),changes:[]});
        refs.get(key).changes.push(c);
      }
      // Firestore transactions require all reads before writes.
      const entries=[...refs.values()],snaps=entries.length?await Promise.all(entries.map(x=>tx.get(x.ref))):[];
      entries.forEach((entry,i)=>{
        const current=snaps[i].exists?(snaps[i].data()||{}):{},days={...(current.days||{})};
        let total=Math.max(0,Number(current.total)||0);
        for(const c of entry.changes){
          const before=Math.max(0,Number(days[c.date])||0),after=Math.max(0,before+c.delta);
          total=Math.max(0,total+(after-before));
          if(after>0)days[c.date]=after;else delete days[c.date];
        }
        if(total<=0||Object.keys(days).length===0)tx.delete(entry.ref);
        else tx.set(entry.ref,{month:entry.month,dialogueId,days,total,updatedAt:new Date()},{merge:false});
      });
      if(!reported){if(reportSnap.exists)tx.delete(reportRef);return;}
      tx.set(reportRef,{userHash:recentUserHash(user.uid),dialogueId,reportedOn:newDate,updatedAt:new Date(),createdAt:old?.createdAt||new Date()},{merge:true});
    });
    res.json({ok:true,dialogueId,reported,reportedOn:reported?reportedOn:null});
  }catch(error){recentError(res,error,"reportRecentDialogue")}
});

exports.getRecentDialogueStats=onRequest({region:"australia-southeast1",cors:true,timeoutSeconds:30,memory:"256MiB"},async(req,res)=>{
  if(req.method==="OPTIONS"){res.status(204).send("");return}
  if(req.method!=="POST"){res.status(405).json({error:"Method not allowed"});return}
  try{
    const user=await verifiedRecentUser(req),b=req.body||{},to=recentDateKey(b.to||todayUtcKey()),from=recentDateKey(b.from||"");
    if(!from||!to||from>to){res.status(400).json({error:"Valid from/to dates are required"});return}
    if(dateDiffDays(from,to)>366){res.status(400).json({error:"Date range cannot exceed 366 days"});return}
    const fromMonth=from.slice(0,7),toMonth=to.slice(0,7),db=getFirestore();
    const q=await db.collection("recentDialogueMonthly").where("month",">=",fromMonth).where("month","<=",toMonth).get();
    const map=new Map();
    q.forEach(doc=>{
      const x=doc.data()||{},id=recentDialogueId(x.dialogueId);if(!id)return;
      for(const [rawDate,rawCount] of Object.entries(x.days||{})){
        const date=recentDateKey(rawDate),n=Math.max(0,Number(rawCount)||0);if(!date||date<from||date>to||!n)continue;
        const cur=map.get(id)||{dialogueId:id,count:0,lastReportedOn:""};cur.count+=n;
        if(!cur.lastReportedOn||date>cur.lastReportedOn)cur.lastReportedOn=date;map.set(id,cur);
      }
    });
    const mineSnap=await db.collection("recentDialogueReports").where("userHash","==",recentUserHash(user.uid)).get(),myReports={};
    mineSnap.forEach(doc=>{const x=doc.data()||{},id=recentDialogueId(x.dialogueId),date=recentDateKey(x.reportedOn);if(id&&date)myReports[id]={reportedOn:date}});
    res.json({ok:true,from,to,stats:[...map.values()].sort((a,b)=>b.count-a.count||String(b.lastReportedOn).localeCompare(String(a.lastReportedOn))),myReports});
  }catch(error){recentError(res,error,"getRecentDialogueStats")}
});
